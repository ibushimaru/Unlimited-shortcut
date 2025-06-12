// マウスイベントベースのドラッグ&ドロップ実装
class MouseDragManager {
    constructor(shortcutManager) {
        this.shortcutManager = shortcutManager;
        this.draggedElement = null;
        this.draggedIndex = null;
        this.placeholder = null;
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;
        this.offsetX = 0;
        this.offsetY = 0;
        this.dragThreshold = 5; // ドラッグと判定する最小移動距離
        this.hasMoved = false; // 実際にドラッグ移動が発生したかのフラグ
        this.insertMarker = null; // 挿入位置を示すマーカー
        this.currentDropMode = null; // 'reorder', 'folder', null
        this.isDisabled = false; // 範囲選択時などにドラッグを無効化
    }

    init() {
        console.log('=== MouseDragManager initialized ===');
        this.attachEventListeners();
    }

    attachEventListeners() {
        const grid = document.getElementById('shortcutsGrid');
        if (!grid) return;

        // 各ショートカットアイテムにイベントを設定
        const items = grid.querySelectorAll('.shortcut-item');
        items.forEach(item => {
            // マウスダウンでドラッグ開始
            item.addEventListener('mousedown', (e) => this.handleMouseDown(e, item));
        });

        // グローバルイベント
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    }

    handleMouseDown(e, item) {
        // 右クリックやケバブメニューは無視
        if (e.button !== 0 || e.target.closest('.kebab-menu')) {
            return;
        }
        
        // ドラッグが無効化されている場合は処理しない
        if (this.isDisabled) {
            return;
        }
        
        // 範囲選択マネージャーが範囲選択モードの場合は処理しない
        if (window.rangeSelectionManager && window.rangeSelectionManager.isInRangeSelectionMode()) {
            return;
        }

        // ドラッグの準備だけ行い、実際のドラッグはまだ開始しない
        this.draggedElement = item;
        this.draggedIndex = parseInt(item.dataset.index);
        this.hasMoved = false;
        
        // マウス位置を記録
        this.startX = e.clientX;
        this.startY = e.clientY;
        
        // 要素の位置を記録
        const rect = item.getBoundingClientRect();
        this.offsetX = e.clientX - rect.left;
        this.offsetY = e.clientY - rect.top;
        
        e.preventDefault();
        console.log('Mouse down on item:', this.draggedIndex);
    }

    handleMouseMove(e) {
        if (!this.draggedElement) return;

        // ドラッグ開始の閾値チェック
        if (!this.isDragging) {
            const distance = Math.sqrt(
                Math.pow(e.clientX - this.startX, 2) + 
                Math.pow(e.clientY - this.startY, 2)
            );
            
            if (distance > this.dragThreshold) {
                // 閾値を超えたらドラッグを開始
                this.isDragging = true;
                this.hasMoved = true;
                
                // ドラッグ中のスタイルを適用
                this.draggedElement.style.position = 'fixed';
                this.draggedElement.style.zIndex = '9999';
                this.draggedElement.style.opacity = '0.8';
                this.draggedElement.style.cursor = 'grabbing';
                this.draggedElement.style.left = `${e.clientX - this.offsetX}px`;
                this.draggedElement.style.top = `${e.clientY - this.offsetY}px`;
                this.draggedElement.style.transform = 'scale(1.05)';
                this.draggedElement.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
                
                console.log('Drag started after threshold');
            }
        }

        if (this.isDragging) {
            // ドラッグ中の要素を移動
            this.draggedElement.style.left = `${e.clientX - this.offsetX}px`;
            this.draggedElement.style.top = `${e.clientY - this.offsetY}px`;

            // ホバー中の要素を検出
            const elementBelow = this.getElementBelow(e.clientX, e.clientY);
            if (elementBelow) {
                if (elementBelow.classList.contains('shortcut-item')) {
                    const targetIndex = parseInt(elementBelow.dataset.index);
                    
                    if (targetIndex !== this.draggedIndex) {
                        const rect = elementBelow.getBoundingClientRect();
                        const dropX = e.clientX - rect.left;
                        const dropXPercent = dropX / rect.width;
                        
                        // ドロップ位置に基づいてモードを判定
                        if (dropXPercent < 0.3 || dropXPercent > 0.7) {
                            // 並び替えモード
                            this.currentDropMode = 'reorder';
                            this.clearHoverEffects();
                            this.showInsertMarker(elementBelow, dropXPercent < 0.5);
                        } else {
                            // フォルダー作成/追加モード
                            this.currentDropMode = 'folder';
                            this.clearHoverEffects();
                            this.hideInsertMarker();
                            elementBelow.classList.add('drag-over');
                            
                            // フォルダーの場合は特別なエフェクトを追加
                            const targetShortcut = this.shortcutManager.shortcuts[targetIndex];
                            if (targetShortcut && targetShortcut.isFolder) {
                                elementBelow.classList.add('folder-hover');
                            }
                        }
                    }
                } else if (elementBelow.classList.contains('folder-item')) {
                    // フォルダーにホバー
                    this.clearHoverEffects();
                    elementBelow.classList.add('folder-drag-over');
                }
            } else {
                this.clearHoverEffects();
                this.hideInsertMarker();
            }
        }
    }

    handleMouseUp(e) {
        if (!this.draggedElement) return;

        // 実際にドラッグが発生した場合のみ処理
        if (this.isDragging && this.hasMoved) {
            console.log('Mouse drag ended');

            // ドロップ先を検出
            const elementBelow = this.getElementBelow(e.clientX, e.clientY);
            
            // フォルダーにドロップした場合
            if (elementBelow && elementBelow.classList.contains('folder-item')) {
                const folderId = elementBelow.dataset.folderId;
                if (folderId) {
                    console.log('Dropping on folder:', folderId);
                    this.shortcutManager.moveShortcutToFolder(this.draggedIndex, folderId);
                }
            }
            // ショートカットにドロップした場合
            else if (elementBelow && elementBelow.classList.contains('shortcut-item')) {
                const targetIndex = parseInt(elementBelow.dataset.index);
                
                if (targetIndex !== this.draggedIndex) {
                    console.log('=== MOUSE DROP DETECTED ===');
                    console.log('From:', this.draggedIndex, 'To:', targetIndex);
                    
                    // 常に最後に記録された挿入位置を使用
                    if (this.pendingInsertIndex !== null && this.pendingInsertIndex !== undefined && 
                        this.pendingInsertIndex !== this.draggedIndex) {
                        // アイテムがスライドした位置にドロップ
                        console.log('Reordering to slide position:', this.pendingInsertIndex);
                        this.shortcutManager.reorder(this.draggedIndex, this.pendingInsertIndex);
                    } else if (this.currentDropMode === 'folder') {
                        // フォルダー作成/追加処理
                        const draggedShortcut = this.shortcutManager.shortcuts[this.draggedIndex];
                        const targetShortcut = this.shortcutManager.shortcuts[targetIndex];
                        
                        if (draggedShortcut && targetShortcut) {
                            // 両方がショートカットの場合はフォルダー作成
                            if (!draggedShortcut.isFolder && !targetShortcut.isFolder) {
                                console.log('Creating folder from shortcuts');
                                this.shortcutManager.createFolderFromShortcuts(this.draggedIndex, targetIndex);
                            }
                            // フォルダーにショートカットを追加
                            else if (targetShortcut.isFolder && !draggedShortcut.isFolder) {
                                console.log('Adding shortcut to folder');
                                console.log('DraggedIndex:', this.draggedIndex, 'TargetIndex:', targetIndex);
                                console.log('TargetShortcut:', targetShortcut);
                                console.log('Total shortcuts before:', this.shortcutManager.shortcuts.length);
                                // ドラッグインデックスが範囲内か確認
                                if (this.draggedIndex < this.shortcutManager.shortcuts.length) {
                                    this.shortcutManager.addShortcutToFolder(this.draggedIndex, targetShortcut.folderId);
                                } else {
                                    console.error('Dragged index out of range:', this.draggedIndex);
                                }
                            }
                        }
                    }
                }
            }
        }

        // クリーンアップ
        this.cleanup();
    }

    getElementBelow(x, y) {
        // ドラッグ中の要素を一時的に非表示
        this.draggedElement.style.display = 'none';
        let elementBelow = document.elementFromPoint(x, y);
        this.draggedElement.style.display = '';
        
        // フォルダー内の要素にホバーしている場合、親のショートカットアイテムを取得
        if (elementBelow && !elementBelow.classList.contains('shortcut-item')) {
            const parentItem = elementBelow.closest('.shortcut-item');
            if (parentItem) {
                elementBelow = parentItem;
            }
        }
        
        return elementBelow;
    }


    clearHoverEffects() {
        document.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
        document.querySelectorAll('.folder-drag-over').forEach(el => {
            el.classList.remove('folder-drag-over');
        });
        document.querySelectorAll('.folder-hover').forEach(el => {
            el.classList.remove('folder-hover');
        });
    }
    
    showInsertMarker(targetElement, insertBefore) {
        this.hideInsertMarker();
        
        const grid = document.getElementById('shortcutsGrid');
        const items = Array.from(grid.querySelectorAll('.shortcut-item'));
        const targetIndex = parseInt(targetElement.dataset.index);
        
        // 挿入位置を記録（ドロップ時に使用）
        this.pendingInsertIndex = insertBefore ? targetIndex : targetIndex + 1;
        if (this.draggedIndex < this.pendingInsertIndex) {
            this.pendingInsertIndex--;
        }
        
        // アイコンをシフトする（Transformを使用）
        items.forEach((item, index) => {
            const itemIndex = parseInt(item.dataset.index);
            
            // ドラッグ中のアイテムは半透明に
            if (itemIndex === this.draggedIndex) {
                item.style.opacity = '0.3';
                item.style.transform = 'scale(0.8)';
                return;
            }
            
            // アイテムの位置調整
            let translateX = 0;
            const itemWidth = 112 + 16; // アイテム幅 + gap
            
            if (this.draggedIndex < this.pendingInsertIndex) {
                // ドラッグアイテムが挿入位置より前にある場合
                if (itemIndex > this.draggedIndex && itemIndex < this.pendingInsertIndex) {
                    translateX = -itemWidth;
                }
            } else {
                // ドラッグアイテムが挿入位置より後にある場合
                if (itemIndex >= this.pendingInsertIndex && itemIndex < this.draggedIndex) {
                    translateX = itemWidth;
                }
            }
            
            if (translateX !== 0) {
                item.style.transform = `translateX(${translateX}px)`;
            } else {
                item.style.transform = '';
            }
            
            item.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        });
    }
    
    hideInsertMarker() {
        // アイテムのスタイルをリセット
        const grid = document.getElementById('shortcutsGrid');
        if (grid) {
            const items = grid.querySelectorAll('.shortcut-item');
            items.forEach(item => {
                item.style.transform = '';
                item.style.opacity = '';
            });
        }
        
        this.pendingInsertIndex = null;
    }

    cleanup() {
        if (this.draggedElement) {
            // スタイルをリセット
            this.draggedElement.style.position = '';
            this.draggedElement.style.zIndex = '';
            this.draggedElement.style.opacity = '';
            this.draggedElement.style.cursor = '';
            this.draggedElement.style.left = '';
            this.draggedElement.style.top = '';
            this.draggedElement.style.transform = '';
            this.draggedElement.style.boxShadow = '';
        }


        // ホバーエフェクトをクリア
        this.clearHoverEffects();
        
        // 挿入マーカーを削除
        this.hideInsertMarker();

        // ドラッグ後のクリックを防ぐため、少し遅延してからフラグをリセット
        if (this.hasMoved) {
            setTimeout(() => {
                this.hasMoved = false;
            }, 100);
        }

        // 状態をリセット
        this.draggedElement = null;
        this.draggedIndex = null;
        this.placeholder = null;
        this.isDragging = false;
        this.currentDropMode = null;
    }
}

// グローバルに公開
window.MouseDragManager = MouseDragManager;