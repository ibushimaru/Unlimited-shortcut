// ショートカット管理クラス
class ShortcutManager {
    constructor() {
        this.shortcuts = [];
        this.folders = [];
        this.currentEditIndex = null;
        this.init();
    }

    async init() {
        // ストレージから既存のデータを読み込み
        const result = await chrome.storage.sync.get(['shortcuts', 'folders']);
        
        // フォルダーデータがない場合は、カテゴリから移行
        if (!result.folders) {
            await this.migrateFromCategories(result.shortcuts);
        } else {
            this.shortcuts = result.shortcuts || this.getDefaultShortcuts();
            this.folders = result.folders || [];
        }
        
        // 既存のショートカットのファビコンを更新
        await this.updateAllFavicons();
        
        this.render();
        
        // フォルダーフィルターを更新
        if (window.updateFolderFilter) {
            window.updateFolderFilter();
        }
    }
    
    // すべてのショートカットのファビコンを更新
    async updateAllFavicons() {
        let updated = false;
        
        for (let i = 0; i < this.shortcuts.length; i++) {
            const shortcut = this.shortcuts[i];
            // フォルダーはスキップ
            if (shortcut.isFolder || !shortcut.url || shortcut.url.startsWith('#')) {
                continue;
            }
            if (!shortcut.icon || shortcut.icon.includes('chrome://favicon/')) {
                // 古い形式のアイコンURLまたはアイコンがない場合は更新
                try {
                    const newIcon = await FaviconManager.getFavicon(shortcut.url);
                    if (newIcon) {
                        this.shortcuts[i].icon = newIcon;
                        updated = true;
                    }
                } catch (error) {
                    console.error('Failed to get favicon for:', shortcut.url, error);
                }
            }
        }
        
        if (updated) {
            await this.save();
        }
    }

    // カテゴリからフォルダーへの移行
    async migrateFromCategories(shortcuts) {
        if (!shortcuts) {
            this.shortcuts = this.getDefaultShortcuts();
            this.folders = [];
            return;
        }

        // カテゴリごとにグループ化
        const categories = new Set();
        shortcuts.forEach(shortcut => {
            categories.add(shortcut.category || 'General');
        });

        // カテゴリをフォルダーに変換
        this.folders = [];
        categories.forEach(category => {
            this.folders.push({
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                name: category,
                isOpen: true
            });
        });

        // ショートカットにfolderId を設定
        this.shortcuts = shortcuts.map(shortcut => {
            const folder = this.folders.find(f => f.name === (shortcut.category || 'General'));
            return {
                ...shortcut,
                folderId: folder ? folder.id : null,
                category: undefined // カテゴリプロパティを削除
            };
        });

        await this.save();
    }

    // デフォルトのショートカット
    getDefaultShortcuts() {
        return [
            { name: 'Google', url: 'https://www.google.com', icon: null, folderId: null, isFolder: false },
            { name: 'YouTube', url: 'https://www.youtube.com', icon: null, folderId: null, isFolder: false },
            { name: 'Gmail', url: 'https://mail.google.com', icon: null, folderId: null, isFolder: false },
            { name: 'Google Drive', url: 'https://drive.google.com', icon: null, folderId: null, isFolder: false },
            { name: 'Google Maps', url: 'https://maps.google.com', icon: null, folderId: null, isFolder: false }
        ];
    }

    // ショートカットの保存
    async save() {
        await chrome.storage.sync.set({ 
            shortcuts: this.shortcuts,
            folders: this.folders 
        });
    }

    // ショートカットの追加
    async add(name, url, folderId = null) {
        const shortcut = {
            name,
            url,
            icon: null,
            folderId,
            id: Date.now().toString(),
            isFolder: false
        };
        
        // ファビコンを取得
        shortcut.icon = await FaviconManager.getFavicon(url);
        
        this.shortcuts.push(shortcut);
        await this.save();
        this.render();
    }

    // ショートカットの編集
    async edit(index, name, url, folderId) {
        if (index >= 0 && index < this.shortcuts.length) {
            this.shortcuts[index].name = name;
            this.shortcuts[index].url = url;
            if (folderId !== undefined) {
                this.shortcuts[index].folderId = folderId;
            }
            // フォルダーでない場合のみアイコンを更新
            if (!this.shortcuts[index].isFolder) {
                this.shortcuts[index].icon = await FaviconManager.getFavicon(url);
            }
            await this.save();
            this.render();
        }
    }

    // ショートカットの削除
    async delete(index) {
        if (index >= 0 && index < this.shortcuts.length) {
            this.shortcuts.splice(index, 1);
            await this.save();
            this.render();
        }
    }

    // ショートカットの並び替え
    async reorder(fromIndex, toIndex) {
        if (fromIndex !== toIndex && fromIndex >= 0 && toIndex >= 0) {
            console.log('Reordering from', fromIndex, 'to', toIndex);
            
            // fromIndexがtoIndexより大きい場合、削除後のtoIndexを調整
            if (fromIndex < toIndex) {
                toIndex--;
            }
            
            const item = this.shortcuts.splice(fromIndex, 1)[0];
            this.shortcuts.splice(toIndex, 0, item);
            await this.save();
            
            // アニメーション付きで再描画
            const grid = document.getElementById('shortcutsGrid');
            grid.classList.add('animating');
            this.render();
        }
    }

    // 2つのショートカットからフォルダーを作成
    async createFolderFromShortcuts(index1, index2) {
        console.log('=== createFolderFromShortcuts START ===');
        console.log('Parameters:', { index1, index2 });
        console.log('Current shortcuts count:', this.shortcuts.length);
        
        // インデックスの検証
        if (typeof index1 !== 'number' || typeof index2 !== 'number' ||
            isNaN(index1) || isNaN(index2) ||
            index1 < 0 || index1 >= this.shortcuts.length ||
            index2 < 0 || index2 >= this.shortcuts.length ||
            index1 === index2) {
            console.error('Invalid indices for folder creation:', index1, index2);
            return;
        }
        
        // コピーを作成して元のデータを保持
        const shortcut1 = {...this.shortcuts[index1]};
        const shortcut2 = {...this.shortcuts[index2]};
        
        if (!shortcut1 || !shortcut2 || shortcut1.isFolder || shortcut2.isFolder) {
            console.error('Cannot create folder from invalid shortcuts');
            return;
        }
        
        // 新しいフォルダーIDを生成
        const folderId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        
        // フォルダーを表すショートカットを作成
        const folderShortcut = {
            name: chrome.i18n.getMessage('newFolder') || 'New Folder',
            url: '#folder-' + folderId,
            icon: null,
            folderId: folderId,
            isFolder: true,
            id: folderId
        };
        
        // コピーしたショートカットをフォルダーに割り当て
        shortcut1.folderId = folderId;
        shortcut2.folderId = folderId;
        
        // 新しい配列を作成
        const newShortcuts = [];
        for (let i = 0; i < this.shortcuts.length; i++) {
            if (i === index1 || i === index2) {
                // ドラッグされたアイテムはスキップ
                continue;
            }
            newShortcuts.push(this.shortcuts[i]);
        }
        
        // フォルダーをindex2の位置に挿入
        const insertIndex = Math.min(index1, index2);
        newShortcuts.splice(insertIndex, 0, folderShortcut);
        
        // フォルダーに入れるショートカットを追加
        newShortcuts.push(shortcut1);
        newShortcuts.push(shortcut2);
        
        this.shortcuts = newShortcuts;
        
        await this.save();
        console.log('=== FOLDER CREATED SUCCESSFULLY ===');
        console.log('New shortcuts count:', this.shortcuts.length);
        this.render();
    }

    // ショートカットをフォルダーに追加
    async addShortcutToFolder(shortcutIndex, folderId) {
        // より厳密な範囲チェック
        if (typeof shortcutIndex !== 'number' || isNaN(shortcutIndex) || 
            shortcutIndex < 0 || shortcutIndex >= this.shortcuts.length) {
            console.error('Invalid shortcut index in addShortcutToFolder:', shortcutIndex);
            return;
        }
        
        const shortcut = this.shortcuts[shortcutIndex];
        if (!shortcut) {
            console.error('Shortcut not found at index:', shortcutIndex);
            return;
        }
        
        shortcut.folderId = folderId;
        await this.save();
        this.render();
    }

    // フォルダーを開く
    openFolder(folderId) {
        const folder = this.shortcuts.find(s => s.isFolder && s.folderId === folderId);
        if (folder && window.openFolderModal) {
            window.openFolderModal(folderId, folder.name);
        }
    }

    // フォルダーの追加
    async addFolder(name) {
        const folder = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name,
            isOpen: true
        };
        this.folders.push(folder);
        await this.save();
        this.render();
        return folder;
    }

    // フォルダーの編集
    async editFolder(folderId, name) {
        const folder = this.folders.find(f => f.id === folderId);
        if (folder) {
            folder.name = name;
            await this.save();
            this.render();
        }
    }

    // フォルダーの削除
    async deleteFolder(folderId) {
        // フォルダーを削除
        this.folders = this.folders.filter(f => f.id !== folderId);
        
        // フォルダー内のショートカットをルートに移動
        this.shortcuts.forEach(shortcut => {
            if (shortcut.folderId === folderId) {
                shortcut.folderId = null;
            }
        });
        
        await this.save();
        this.render();
    }

    // フォルダーの開閉を切り替え
    toggleFolder(folderId) {
        const folder = this.folders.find(f => f.id === folderId);
        if (folder) {
            folder.isOpen = !folder.isOpen;
            this.save();
            this.render();
        }
    }

    // 現在のフィルターフォルダー
    filterFolderId = null;
    
    // 現在の検索キーワード
    searchKeyword = '';

    // フォルダーでフィルター
    setFilterFolder(folderId) {
        this.filterFolderId = folderId;
        this.render();
    }
    
    // 検索キーワードを設定
    setSearchKeyword(keyword) {
        this.searchKeyword = keyword.toLowerCase();
        this.render();
    }

    // ショートカットの描画
    render() {
        const grid = document.getElementById('shortcutsGrid');
        const wasAnimating = grid.classList.contains('animating');
        
        // アニメーションフラグを追加
        if (wasAnimating) {
            grid.classList.add('animating');
        }
        
        grid.innerHTML = '';
        
        // ドラッグ状態をリセット
        this.draggedElement = null;
        this.draggedIndex = null;

        console.log('Render called. Total shortcuts:', this.shortcuts.length);
        console.log('Shortcuts data:', this.shortcuts.map(s => ({
            name: s.name,
            isFolder: s.isFolder,
            folderId: s.folderId,
            url: s.url
        })));

        // データの整合性チェック
        this.shortcuts = this.shortcuts.filter(s => s && s.name && s.url);

        // 検索中の場合はすべてのフォルダーを開く
        if (this.searchKeyword) {
            this.folders.forEach(folder => {
                folder.isOpen = true;
            });
        }

        // ルートレベルのショートカットを表示
        const rootShortcuts = this.shortcuts.filter((shortcut, index) => {
            // フォルダー内のアイテムは表示しない（フォルダー自体は表示）
            if (shortcut.folderId && !shortcut.isFolder) {
                return false;
            }
            
            // 検索フィルター
            if (this.searchKeyword) {
                const nameMatch = shortcut.name.toLowerCase().includes(this.searchKeyword);
                const urlMatch = shortcut.url.toLowerCase().includes(this.searchKeyword);
                if (!nameMatch && !urlMatch) {
                    return false;
                }
            }
            
            return true;
        });

        // ルートレベルのショートカットを表示
        rootShortcuts.forEach((shortcut, index) => {
            const realIndex = this.shortcuts.indexOf(shortcut);
            const item = this.createShortcutElement(shortcut, realIndex);
            grid.appendChild(item);
        });

        // 追加ボタンを最後に追加（必ず最後になるように）
        const addButton = document.createElement('div');
        addButton.className = 'add-shortcut';
        addButton.id = 'addShortcut';
        addButton.draggable = false; // ドラッグを無効化
        addButton.innerHTML = `
            <div class="add-icon">+</div>
            <span data-i18n="addShortcut">${chrome.i18n.getMessage('addShortcut') || 'Add shortcut'}</span>
        `;
        // データ属性を追加して識別しやすくする
        addButton.dataset.isAddButton = 'true';
        grid.appendChild(addButton);
        
        // 追加ボタンのクリックイベント
        addButton.addEventListener('click', () => {
            const event = new Event('click');
            const modalTrigger = document.getElementById('addShortcut');
            if (modalTrigger && window.openModal) {
                window.openModal();
            }
        });
        
        // アニメーション完了後にフラグを削除
        if (wasAnimating) {
            setTimeout(() => {
                grid.classList.remove('animating');
            }, 300);
        }

        // ドラッグ&ドロップの設定
        this.setupDragAndDrop();
        
        // マウスドラッグも同時に使用
        if (window.MouseDragManager) {
            this.mouseDragManager = new MouseDragManager(this);
            this.mouseDragManager.init();
            // グローバルに公開（範囲選択機能との連携のため）
            window.mouseDragManager = this.mouseDragManager;
        }
    }

    // ショートカット要素の作成
    createShortcutElement(shortcut, index) {
        const item = document.createElement('div');
        item.className = 'shortcut-item';
        if (shortcut.isFolder) {
            item.className += ' shortcut-folder';
        }
        item.draggable = true;
        item.dataset.index = index;
        
        // デバッグ用：draggable属性が設定されているか確認
        console.log(`Created element: index=${index}, draggable=${item.draggable}`);

        const icon = document.createElement('div');
        icon.className = 'shortcut-icon';
        icon.draggable = false; // アイコンのドラッグを無効化
        
        if (shortcut.isFolder) {
            // フォルダーの場合はプレビューアイコンを表示
            icon.classList.add('folder-preview');
            const folderItems = this.shortcuts.filter(s => s.folderId === shortcut.folderId && !s.isFolder);
            const previewCount = Math.min(folderItems.length, 4);
            
            // グリッドレイアウトでアイコンを表示
            const iconGrid = document.createElement('div');
            iconGrid.className = 'folder-icon-grid';
            
            for (let i = 0; i < previewCount; i++) {
                const miniIcon = document.createElement('div');
                miniIcon.className = 'mini-icon';
                
                if (folderItems[i] && folderItems[i].icon) {
                    const img = document.createElement('img');
                    img.src = folderItems[i].icon;
                    img.draggable = false;
                    miniIcon.appendChild(img);
                } else if (folderItems[i] && folderItems[i].name) {
                    miniIcon.textContent = folderItems[i].name.charAt(0).toUpperCase();
                }
                
                iconGrid.appendChild(miniIcon);
            }
            
            // 残りのアイテム数を表示
            if (folderItems.length > 4) {
                const moreCount = document.createElement('div');
                moreCount.className = 'folder-more-count';
                moreCount.textContent = `+${folderItems.length - 4}`;
                iconGrid.appendChild(moreCount);
            }
            
            icon.appendChild(iconGrid);
        } else if (shortcut.icon) {
            const img = document.createElement('img');
            img.src = shortcut.icon;
            img.draggable = false; // 画像のドラッグを無効化
            img.onerror = async () => {
                // アイコン読み込みエラー時は再取得を試みる
                const newIcon = await FaviconManager.getFavicon(shortcut.url);
                if (newIcon && newIcon !== shortcut.icon) {
                    img.src = newIcon;
                    shortcut.icon = newIcon;
                    this.save();
                } else {
                    // それでも失敗したらデフォルトアイコンを生成
                    const defaultIcon = FaviconManager.generateDefaultIcon(shortcut.name, shortcut.url);
                    if (defaultIcon) {
                        img.src = defaultIcon;
                    } else {
                        img.style.display = 'none';
                        icon.innerHTML = shortcut.name.charAt(0).toUpperCase();
                    }
                }
            };
            icon.appendChild(img);
        } else {
            // アイコンがない場合はデフォルトアイコンを生成
            const defaultIcon = FaviconManager.generateDefaultIcon(shortcut.name, shortcut.url);
            if (defaultIcon) {
                const img = document.createElement('img');
                img.src = defaultIcon;
                img.draggable = false;
                icon.appendChild(img);
            } else {
                icon.innerHTML = shortcut.name.charAt(0).toUpperCase();
            }
        }

        const name = document.createElement('div');
        name.className = 'shortcut-name';
        name.textContent = shortcut.name;
        name.draggable = false; // 名前のドラッグを無効化
        
        // フォルダーの場合はダブルクリックで名前を編集可能に
        if (shortcut.isFolder) {
            name.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.enableInlineEdit(name, shortcut, index);
            });
        }

        item.appendChild(icon);
        item.appendChild(name);

        // ケバブメニューボタンを追加
        const kebabButton = document.createElement('button');
        kebabButton.className = 'kebab-menu';
        kebabButton.draggable = false; // ドラッグを無効化
        kebabButton.innerHTML = `
            <svg viewBox="0 0 24 24">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
        `;
        
        // ケバブメニュークリックイベント
        kebabButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showContextMenu(e, index);
        });
        
        // ドラッグイベントをブロック
        kebabButton.addEventListener('dragstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        
        item.appendChild(kebabButton);

        // クリックイベント
        item.addEventListener('click', (e) => {
            // ドラッグマネージャーがドラッグ中またはドラッグ直後の場合はクリックを無視
            if (this.mouseDragManager && (this.mouseDragManager.isDragging || this.mouseDragManager.hasMoved)) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Click prevented due to drag state');
                return;
            }
            
            if (!e.defaultPrevented) {
                if (shortcut.isFolder) {
                    // フォルダーをクリックしたら開く
                    this.openFolder(shortcut.folderId);
                } else {
                    window.location.href = shortcut.url;
                }
            }
        });

        // 右クリックイベント
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e, index);
        });

        return item;
    }

    // フォルダー要素の作成
    createFolderElement(folder) {
        const item = document.createElement('div');
        item.className = 'folder-item';
        item.draggable = true;
        item.dataset.folderId = folder.id;

        const icon = document.createElement('div');
        icon.className = 'folder-icon';
        
        // フォルダーアイコン（SVG）
        icon.innerHTML = folder.isOpen ? 
            '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/></svg>' :
            '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>';

        const name = document.createElement('div');
        name.className = 'folder-name';
        name.textContent = folder.name;

        // フォルダー内のアイテム数を表示
        const count = this.shortcuts.filter(s => s.folderId === folder.id).length;
        const countBadge = document.createElement('span');
        countBadge.className = 'folder-count';
        countBadge.textContent = `(${count})`;
        name.appendChild(countBadge);

        // 開閉ボタン
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'folder-toggle';
        toggleBtn.innerHTML = folder.isOpen ? '▼' : '▶';
        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            this.toggleFolder(folder.id);
        };

        item.appendChild(toggleBtn);
        item.appendChild(icon);
        item.appendChild(name);

        // クリックでフォルダーを開閉
        item.addEventListener('click', (e) => {
            if (e.target !== toggleBtn) {
                this.toggleFolder(folder.id);
            }
        });

        // 右クリックでコンテキストメニュー
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showFolderContextMenu(e, folder.id);
        });

        // ドラッグオーバーでハイライト
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            item.classList.add('folder-drag-over');
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('folder-drag-over');
        });

        // ドロップでショートカットを移動
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('folder-drag-over');
            
            const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
            if (!isNaN(draggedIndex) && draggedIndex >= 0 && draggedIndex < this.shortcuts.length) {
                this.moveShortcutToFolder(draggedIndex, folder.id);
            } else {
                console.error('Invalid drag index from folder drop:', draggedIndex);
            }
        });

        return item;
    }

    // ショートカットをフォルダーに移動
    async moveShortcutToFolder(shortcutIndex, folderId) {
        console.log('moveShortcutToFolder called:', { shortcutIndex, folderId });
        console.log('Call stack:', new Error().stack);
        
        // より厳密な範囲チェック
        if (typeof shortcutIndex !== 'number' || isNaN(shortcutIndex) || 
            shortcutIndex < 0 || shortcutIndex >= this.shortcuts.length) {
            console.error('Invalid shortcut index:', shortcutIndex, 'Total shortcuts:', this.shortcuts.length);
            console.error('Shortcuts array:', this.shortcuts);
            return;
        }
        
        const shortcut = this.shortcuts[shortcutIndex];
        if (!shortcut) {
            console.error('Shortcut not found at index:', shortcutIndex);
            return;
        }
        
        console.log('Moving shortcut:', JSON.stringify(shortcut));
        
        // フォルダーをフォルダーに入れようとした場合は無視
        if (shortcut.isFolder) {
            console.log('Cannot move folder into folder');
            return;
        }
        
        // フォルダーから外に出す場合、空のフォルダーを削除
        const oldFolderId = shortcut.folderId;
        shortcut.folderId = folderId;
            
        // フォルダーから外に出す場合、isFolderフラグをfalseに設定
        if (folderId === null) {
            shortcut.isFolder = false;
            // フォルダー用のURLを通常のURLに変更する必要がある場合
            if (shortcut.url && shortcut.url.startsWith('#folder-')) {
                // フォルダーURLの場合は、元のURLがないので修正が必要
                console.warn('Shortcut has folder URL but being moved out:', shortcut);
            }
        }
            
        if (folderId === null && oldFolderId) {
            // フォルダーから外に出した場合
            console.log('Moving out of folder:', oldFolderId);
            
            // 元のフォルダーに他のアイテムがないか確認
            const remainingInFolder = this.shortcuts.filter(s => 
                s.folderId === oldFolderId && !s.isFolder && s !== shortcut
            ).length;
            
            console.log('Remaining items in folder:', remainingInFolder);
            
            if (remainingInFolder === 0) {
                // フォルダーが空になった場合、フォルダーを削除
                console.log('Removing empty folder');
                const folderIndex = this.shortcuts.findIndex(s => 
                    s.isFolder && s.folderId === oldFolderId
                );
                if (folderIndex !== -1 && folderIndex < this.shortcuts.length) {
                    this.shortcuts.splice(folderIndex, 1);
                }
            }
        }
        
        console.log('Updated folderId to:', folderId);
        console.log('Updated isFolder to:', shortcut.isFolder);
        
        await this.save();
        this.render();
        console.log('Move complete');
    }

    // フォルダーコンテキストメニューの表示
    showFolderContextMenu(event, folderId) {
        // TODO: フォルダー用のコンテキストメニューを実装
        console.log('Folder context menu for:', folderId);
    }

    // コンテキストメニューの表示
    showContextMenu(event, index) {
        const menu = document.getElementById('contextMenu');
        const shortcut = this.shortcuts[index];
        
        // フォルダーの場合は名前変更メニューを表示
        if (shortcut.isFolder) {
            // 既存のメニューを一時的に保存
            const editItem = document.getElementById('editShortcut');
            const originalText = editItem.textContent;
            editItem.textContent = chrome.i18n.getMessage('renameFolder') || 'Rename Folder';
            
            menu.style.left = `${event.pageX}px`;
            menu.style.top = `${event.pageY}px`;
            menu.classList.add('show');
            
            this.currentEditIndex = index;
            
            // メニュー外クリックで閉じる
            document.addEventListener('click', () => {
                menu.classList.remove('show');
                editItem.textContent = originalText;
            }, { once: true });
        } else {
            menu.style.left = `${event.pageX}px`;
            menu.style.top = `${event.pageY}px`;
            menu.classList.add('show');
            
            this.currentEditIndex = index;

            // メニュー外クリックで閉じる
            document.addEventListener('click', () => {
                menu.classList.remove('show');
            }, { once: true });
        }
    }

    // ドラッグ&ドロップの設定
    setupDragAndDrop() {
        console.log('=== setupDragAndDrop START ===');
        const grid = document.getElementById('shortcutsGrid');
        if (!grid) {
            console.error('Grid element not found!');
            return;
        }
        
        // ドラッグ状態の初期化
        this.draggedElement = null;
        this.draggedIndex = null;
        
        // グリッド全体にdragoverイベントを設定（ドロップを許可するため）
        grid.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        }, false);
        
        // 各アイテムに直接イベントを設定
        this.attachItemEventListeners();
        
        // イベント委譲を使用してグリッドレベルでイベントを処理
        grid.addEventListener('dragstart', (e) => {
            // 範囲選択モード中はドラッグを無効化
            if (window.rangeSelectionManager && window.rangeSelectionManager.isInRangeSelectionMode()) {
                e.preventDefault();
                return;
            }
            
            console.log('Grid dragstart event, target:', e.target);
            const shortcutItem = e.target.closest('.shortcut-item');
            if (!shortcutItem || !shortcutItem.draggable) {
                console.log('Not a draggable shortcut item');
                return;
            }
            
            console.log('Dragstart event on grid, target:', e.target);
            const indexStr = shortcutItem.dataset.index;
            console.log('Item index:', indexStr);
            
            if (!indexStr) {
                console.error('No index attribute on shortcut element');
                return;
            }
            
            this.draggedElement = shortcutItem;
            this.draggedIndex = parseInt(indexStr);
            
            // NaNチェック
            if (isNaN(this.draggedIndex)) {
                console.error('Invalid drag index:', indexStr);
                return;
            }
            
            // 範囲チェック
            if (this.draggedIndex < 0 || this.draggedIndex >= this.shortcuts.length) {
                console.error('Drag index out of range:', this.draggedIndex, 'Total:', this.shortcuts.length);
                return;
            }
            
            shortcutItem.classList.add('dragging');
            
            console.log('Drag started successfully, index:', this.draggedIndex);
            
            // ドラッグデータを設定
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', this.draggedIndex.toString());
            e.dataTransfer.setData('shortcutIndex', this.draggedIndex.toString());
        });
        
        grid.addEventListener('dragend', (e) => {
            const shortcutItem = e.target.closest('.shortcut-item');
            if (shortcutItem) {
                shortcutItem.classList.remove('dragging');
            }
            // ドラッグ状態をクリア
            this.draggedElement = null;
            this.draggedIndex = null;
            console.log('Drag ended');
        });

        // アイテム上でのdragoverハンドリング
        grid.addEventListener('dragover', (e) => {
            const targetItem = e.target.closest('.shortcut-item');
            if (!targetItem || targetItem === this.draggedElement) {
                return;
            }
            
            const targetIndex = parseInt(targetItem.dataset.index);
            
            // 別のアイテム上にドラッグしている場合
            if (this.draggedIndex !== null && 
                this.draggedIndex !== targetIndex && 
                targetIndex >= 0 && 
                targetIndex < this.shortcuts.length) {
                
                const draggedShortcut = this.shortcuts[this.draggedIndex];
                const targetShortcut = this.shortcuts[targetIndex];
                
                if (draggedShortcut && targetShortcut) {
                    // ターゲットがフォルダーの場合
                    if (targetShortcut.isFolder && !draggedShortcut.isFolder) {
                        targetItem.classList.add('drag-over');
                    }
                    // 両方がショートカットの場合
                    else if (!draggedShortcut.isFolder && !targetShortcut.isFolder) {
                        targetItem.classList.add('drag-over');
                    }
                }
            }
        });
        
        grid.addEventListener('dragleave', (e) => {
            const targetItem = e.target.closest('.shortcut-item');
            if (targetItem) {
                targetItem.classList.remove('drag-over');
                targetItem.classList.remove('drag-reorder');
            }
        });

        // dropイベントの処理
        grid.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('=== GRID DROP EVENT FIRED ===');
            console.log('Drop target:', e.target);
            console.log('Dragged index:', this.draggedIndex);
            
            const dropTarget = e.target.closest('.shortcut-item');
            if (!dropTarget || this.draggedIndex === null) {
                console.log('No valid drop target or dragged item');
                return;
            }
            dropTarget.classList.remove('drag-over');
            dropTarget.classList.remove('drag-reorder');
            
            console.log('Drop event on item:', dropTarget);
            console.log('Drop target index:', dropTarget.dataset.index);
            console.log('Current dragged index:', this.draggedIndex);
            
            const dropIndex = parseInt(dropTarget.dataset.index);
            const dropRect = dropTarget.getBoundingClientRect();
            const dropX = e.clientX - dropRect.left;
            const dropXPercent = dropX / dropRect.width;
            
            console.log('Drop position:', {
                draggedIndex: this.draggedIndex,
                dropIndex: dropIndex,
                dropXPercent: dropXPercent
            });
            
            if (typeof this.draggedIndex === 'number' && !isNaN(this.draggedIndex) &&
                this.draggedIndex >= 0 && this.draggedIndex < this.shortcuts.length &&
                typeof dropIndex === 'number' && !isNaN(dropIndex) &&
                dropIndex >= 0 && dropIndex < this.shortcuts.length &&
                this.draggedIndex !== dropIndex) {
                
                const draggedShortcut = this.shortcuts[this.draggedIndex];
                const targetShortcut = this.shortcuts[dropIndex];
                
                if (!draggedShortcut || !targetShortcut) {
                    console.error('Shortcut not found');
                    return;
                }
                
                console.log('Drop detected:', {
                    dragged: draggedShortcut.name,
                    target: targetShortcut.name,
                    draggedIsFolder: draggedShortcut.isFolder,
                    targetIsFolder: targetShortcut.isFolder
                });
                
                // ドロップ位置がアイテムの左端または右端近くの場合は並び替え
                if (dropXPercent < 0.2 || dropXPercent > 0.8) {
                    console.log('=== REORDERING ITEMS ===');
                    const newIndex = dropXPercent < 0.5 ? dropIndex : dropIndex + 1;
                    this.reorder(this.draggedIndex, newIndex);
                }
                // ターゲットがフォルダーで、ドラッグしているのがショートカットの場合
                else if (targetShortcut.isFolder && !draggedShortcut.isFolder) {
                    console.log('=== ADDING TO FOLDER ===');
                    this.addShortcutToFolder(this.draggedIndex, targetShortcut.folderId);
                }
                // 両方がショートカットの場合
                else if (!draggedShortcut.isFolder && !targetShortcut.isFolder) {
                    console.log('=== CREATING FOLDER ===');
                    console.log('Calling createFolderFromShortcuts with:', this.draggedIndex, dropIndex);
                    this.createFolderFromShortcuts(this.draggedIndex, dropIndex);
                }
            } else {
                console.log('Drop conditions not met:', {
                    draggedIndex: this.draggedIndex,
                    dropIndex,
                    draggedValid: typeof this.draggedIndex === 'number' && !isNaN(this.draggedIndex),
                    dropValid: typeof dropIndex === 'number' && !isNaN(dropIndex),
                    sameIndex: this.draggedIndex === dropIndex
                });
            }
        });
        
        // モーダルからのドラッグ用のハンドラー
        grid.addEventListener('dragover', (e) => {
            // アイテム上でない場合のみドロップを許可（モーダルからのドラッグ用）
            if (!e.target.closest('.shortcut-item')) {
                e.preventDefault();
            }
        });
        
        grid.addEventListener('drop', (e) => {
            // アイテム上でない場合のみ処理（モーダルからのドラッグ）
            if (!e.target.closest('.shortcut-item')) {
                e.preventDefault();
                
                // モーダルからのドラッグ中の場合
                if (window.isDraggingFromModal && window.currentModalDragIndex !== null) {
                    this.moveShortcutToFolder(window.currentModalDragIndex, null);
                    setTimeout(() => {
                        if (window.closeFolderModal) {
                            window.closeFolderModal();
                        }
                    }, 100);
                }
            }
        });
        
        console.log('=== setupDragAndDrop END ===');
    }
    
    // アイテムレベルのイベントリスナーを設定
    attachItemEventListeners() {
        const items = document.querySelectorAll('.shortcut-item');
        items.forEach((item) => {
            // ドラッグオーバー
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                // console.log('Item dragover:', item.dataset.index);
            });
            
            // ドロップ
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('=== ITEM DROP EVENT ===');
                console.log('Dropped on item:', item.dataset.index);
                console.log('Dragged index:', this.draggedIndex);
                
                const dropIndex = parseInt(item.dataset.index);
                if (this.draggedIndex !== null && this.draggedIndex !== dropIndex) {
                    const draggedShortcut = this.shortcuts[this.draggedIndex];
                    const targetShortcut = this.shortcuts[dropIndex];
                    
                    if (draggedShortcut && targetShortcut && 
                        !draggedShortcut.isFolder && !targetShortcut.isFolder) {
                        console.log('Creating folder!');
                        this.createFolderFromShortcuts(this.draggedIndex, dropIndex);
                    }
                }
            });
        });
    }

    // インポート機能
    async importFromBookmarks() {
        const bookmarks = await chrome.bookmarks.getTree();
        const flatBookmarks = this.flattenBookmarks(bookmarks);
        
        for (const bookmark of flatBookmarks) {
            if (bookmark.url) {
                await this.add(bookmark.title, bookmark.url);
            }
        }
    }

    // ブックマークをフラット化
    flattenBookmarks(nodes, result = []) {
        for (const node of nodes) {
            if (node.url) {
                result.push(node);
            }
            if (node.children) {
                this.flattenBookmarks(node.children, result);
            }
        }
        return result;
    }

    // エクスポート機能
    exportToJSON() {
        const data = JSON.stringify(this.shortcuts, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'shortcuts-backup.json';
        a.click();
        
        URL.revokeObjectURL(url);
    }

    // インポート機能
    async importFromJSON(file) {
        const text = await file.text();
        try {
            const shortcuts = JSON.parse(text);
            this.shortcuts = shortcuts;
            await this.save();
            this.render();
        } catch (error) {
            console.error('Invalid JSON file:', error);
            alert('無効なファイル形式です。');
        }
    }

    // インライン編集を有効にする
    enableInlineEdit(element, shortcut, index) {
        const originalText = element.textContent;
        element.contentEditable = true;
        element.classList.add('editing');
        
        // テキストを選択
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // フォーカスを設定
        element.focus();
        
        const saveEdit = () => {
            const newName = element.textContent.trim();
            if (newName && newName !== originalText) {
                shortcut.name = newName;
                this.save();
                this.render();
            } else {
                element.textContent = originalText;
            }
            element.contentEditable = false;
            element.classList.remove('editing');
        };
        
        // Enterキーで保存
        element.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                element.textContent = originalText;
                element.contentEditable = false;
                element.classList.remove('editing');
            }
        }, { once: true });
        
        // フォーカスが外れたら保存
        element.addEventListener('blur', saveEdit, { once: true });
    }
}

// グローバル変数として初期化
window.shortcutManager = new ShortcutManager();

// 範囲選択マネージャーの初期化
if (window.RangeSelectionManager) {
    window.rangeSelectionManager = new RangeSelectionManager(window.shortcutManager);
    window.rangeSelectionManager.init();
}

// ドラッグイベントのデバッグ関数
window.debugDragEvents = function() {
    console.log('=== Debugging Drag Events ===');
    
    const container = document.querySelector('.shortcuts-container');
    const wrapper = document.querySelector('.shortcuts-wrapper');
    const grid = document.getElementById('shortcutsGrid');
    
    if (!grid) {
        console.error('Grid not found!');
        return;
    }
    
    // documentレベルでイベントをキャッチ
    const elements = [document, document.body, container, wrapper, grid].filter(Boolean);
    
    elements.forEach(elem => {
        const name = elem === document ? 'document' : 
                     elem === document.body ? 'body' : 
                     elem.className || elem.id || 'element';
        
        elem.addEventListener('dragover', (e) => {
            console.log(`dragover on ${name}`);
            e.preventDefault();
        }, true);
        
        elem.addEventListener('drop', (e) => {
            console.log(`DROP on ${name}!`);
            e.preventDefault();
            e.stopPropagation();
        }, true);
    });
    
    console.log('Debug handlers added to:', elements.length, 'elements');
};

// HTML5ドラッグを強制的に有効化
window.forceHTML5Drag = function() {
    console.log('=== Forcing HTML5 Drag ===');
    const manager = window.shortcutManager;
    
    // マウスドラッグを無効化
    if (manager.mouseDragManager) {
        manager.mouseDragManager.cleanup();
    }
    
    // HTML5ドラッグを再有効化
    const items = document.querySelectorAll('.shortcut-item');
    items.forEach(item => {
        item.draggable = true;
    });
    
    manager.setupDragAndDrop();
    console.log('HTML5 drag re-enabled. Try dragging now.');
};

// 最小限のドラッグテスト
window.minimalDragTest = function() {
    console.log('=== Minimal Drag Test ===');
    
    const items = document.querySelectorAll('.shortcut-item');
    if (items.length < 2) {
        console.error('Need at least 2 items to test');
        return;
    }
    
    let draggedItem = null;
    
    // すべてのアイテムにシンプルなイベントを追加
    items.forEach((item, index) => {
        item.addEventListener('dragstart', (e) => {
            draggedItem = item;
            console.log('Drag start:', index);
        });
        
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            console.log('Drag over:', index);
        });
        
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            console.log('DROP SUCCESS on item:', index);
            
            if (draggedItem && draggedItem !== item) {
                const fromIndex = parseInt(draggedItem.dataset.index);
                const toIndex = parseInt(item.dataset.index);
                console.log('Would create folder from', fromIndex, 'to', toIndex);
                
                // 実際にフォルダーを作成
                window.shortcutManager.createFolderFromShortcuts(fromIndex, toIndex);
            }
        });
    });
    
    console.log('Minimal drag test ready. Try dragging now.');
};

// シンプルなドラッグテスト
window.simpleDragTest = function() {
    console.log('=== Simple Drag Test ===');
    const manager = window.shortcutManager;
    
    // 通常のドラッグを無効化してマウスドラッグを使用
    const items = document.querySelectorAll('.shortcut-item');
    items.forEach(item => {
        item.draggable = false;
    });
    
    // マウスドラッグを再初期化
    if (manager.mouseDragManager) {
        manager.mouseDragManager.init();
        console.log('Mouse drag initialized. Try dragging with mouse now.');
    } else {
        console.log('MouseDragManager not found. Make sure mouse-drag.js is loaded.');
    }
};

// CSSでドラッグをブロックしているかチェック
window.checkDragCSS = function() {
    console.log('=== Checking CSS for Drag Issues ===');
    
    const items = document.querySelectorAll('.shortcut-item');
    items.forEach((item, i) => {
        const style = window.getComputedStyle(item);
        console.log(`Item ${i}:`);
        console.log('  pointer-events:', style.pointerEvents);
        console.log('  user-select:', style.userSelect);
        console.log('  -webkit-user-drag:', style.webkitUserDrag);
    });
    
    // ドラッグ中のCSSも確認
    const draggingItems = document.querySelectorAll('.dragging');
    if (draggingItems.length > 0) {
        console.log('\nDragging items:');
        draggingItems.forEach((item, i) => {
            const style = window.getComputedStyle(item);
            console.log(`Dragging item ${i}:`);
            console.log('  pointer-events:', style.pointerEvents);
        });
    }
};

// デバッグ用：データ復旧関数
window.restoreShortcuts = async function() {
    const manager = window.shortcutManager;
    console.log('Current shortcuts:', manager.shortcuts);
    
    // フォルダー内のショートカットも含めてすべて表示
    const allShortcuts = manager.shortcuts.map(s => ({
        name: s.name,
        url: s.url,
        isFolder: s.isFolder,
        folderId: s.folderId
    }));
    console.table(allShortcuts);
    
    // デフォルトに戻す場合は以下のコメントを外す
    // manager.shortcuts = manager.getDefaultShortcuts();
    // await manager.save();
    // manager.render();
};

// データクリーンアップ関数
window.cleanupShortcuts = async function() {
    const manager = window.shortcutManager;
    
    // 不正なデータを削除
    manager.shortcuts = manager.shortcuts.filter(s => {
        // 必須フィールドがない場合は削除
        if (!s || !s.name || !s.url) {
            console.log('Removing invalid shortcut:', s);
            return false;
        }
        
        // isFolderフラグが未定義の場合は設定
        if (s.isFolder === undefined) {
            s.isFolder = s.url.startsWith('#folder-');
        }
        
        // フォルダーでないのにfolderIdが自分自身を指している場合は修正
        if (!s.isFolder && s.folderId === s.id) {
            console.log('Fixing self-referencing shortcut:', s);
            s.folderId = null;
        }
        
        return true;
    });
    
    await manager.save();
    manager.render();
    console.log('Cleanup complete. Total shortcuts:', manager.shortcuts.length);
};

// デバッグ用：ドラッグ&ドロップのチェック
window.checkDragDrop = function() {
    const manager = window.shortcutManager;
    console.log('=== Drag & Drop Status Check ===');
    
    // ドラッグ状態を確認
    console.log('Dragged element:', manager.draggedElement);
    console.log('Dragged index:', manager.draggedIndex);
    
    // DOM要素を確認
    const items = document.querySelectorAll('.shortcut-item');
    console.log('Total shortcut items:', items.length);
    
    // 各アイテムのdraggable属性を確認
    items.forEach((item, i) => {
        console.log(`Item ${i}: draggable=${item.draggable}, index=${item.dataset.index}`);
        
        // イベントリスナーが登録されているか確認
        const listeners = getEventListeners ? getEventListeners(item) : null;
        if (listeners) {
            console.log(`  Event listeners:`, Object.keys(listeners));
        }
    });
    
    // グリッドのイベントリスナーを確認
    const grid = document.getElementById('shortcutsGrid');
    if (grid) {
        const gridListeners = getEventListeners ? getEventListeners(grid) : null;
        if (gridListeners) {
            console.log('Grid event listeners:', Object.keys(gridListeners));
        }
    }
};

// デバッグ用：ドラッグ&ドロップの使い方
window.testDragDrop = function() {
    const manager = window.shortcutManager;
    console.log('=== ドラッグ&ドロップの使い方 ===');
    
    console.log('\n📁 フォルダー作成:');
    console.log('  ショートカットを別のショートカットの中央にドロップ');
    
    console.log('\n🔄 並び替え:');
    console.log('  アイテムを別のアイテムの左端または右端にドロップ');
    console.log('  （左端20%または右端20%の範囲）');
    
    console.log('\n➕ フォルダーに追加:');
    console.log('  ショートカットをフォルダーの中央にドロップ');
    
    console.log('\n❌ フォルダーから削除:');
    console.log('  フォルダー内のショートカットをモーダル外にドラッグ');
    
    console.log('\n現在のアイテム:');
    const shortcuts = manager.shortcuts.filter(s => !s.folderId || s.isFolder);
    shortcuts.forEach((s, i) => {
        const realIndex = manager.shortcuts.indexOf(s);
        console.log(`  [${realIndex}] ${s.name} ${s.isFolder ? '📁' : '🔗'}`);
    });
};

// デバッグ用：フォルダー構造を表示
window.debugFolders = function() {
    const manager = window.shortcutManager;
    console.log('=== Folder Structure Debug ===');
    
    // フォルダーを表示
    const folders = manager.shortcuts.filter(s => s.isFolder);
    console.log('Total folders:', folders.length);
    console.log('Folders:', folders.map(f => ({
        name: f.name,
        id: f.id,
        folderId: f.folderId,
        url: f.url
    })));
    
    // 各フォルダー内のアイテムを表示
    folders.forEach(folder => {
        const items = manager.shortcuts.filter(s => s.folderId === folder.folderId && !s.isFolder);
        console.log(`Folder "${folder.name}" (${folder.folderId}) contains:`, items.map(i => ({
            name: i.name,
            url: i.url,
            isFolder: i.isFolder
        })));
    });
    
    // ルートレベルのアイテムを表示
    const rootItems = manager.shortcuts.filter(s => !s.folderId || (s.isFolder && s.folderId === s.id));
    console.log('Root level items:', rootItems.map(i => ({
        name: i.name,
        url: i.url,
        isFolder: i.isFolder,
        folderId: i.folderId
    })));
};

// フォルダー作成テスト
window.testFolderCreation = async function() {
    const manager = window.shortcutManager;
    console.log('=== Testing Folder Creation ===');
    
    // 現在のショートカットを表示
    const nonFolderShortcuts = manager.shortcuts.filter(s => !s.isFolder && !s.folderId);
    console.log('Available shortcuts for folder creation:');
    nonFolderShortcuts.forEach((s, i) => {
        const realIndex = manager.shortcuts.indexOf(s);
        console.log(`  [${realIndex}] ${s.name}`);
    });
    
    if (nonFolderShortcuts.length >= 2) {
        const index1 = manager.shortcuts.indexOf(nonFolderShortcuts[0]);
        const index2 = manager.shortcuts.indexOf(nonFolderShortcuts[1]);
        console.log('\nTesting createFolderFromShortcuts with indices:', index1, index2);
        await manager.createFolderFromShortcuts(index1, index2);
        
        // 結果を確認
        setTimeout(() => {
            console.log('\nAfter folder creation:');
            debugFolders();
        }, 1000);
    } else {
        console.log('Not enough shortcuts to create a folder. Need at least 2.');
    }
};