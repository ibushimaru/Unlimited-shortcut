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
        this.dragThreshold = 3; // ドラッグと判定する最小移動距離（より敏感に）
        this.hasMoved = false; // 実際にドラッグ移動が発生したかのフラグ
        this.insertMarker = null; // 挿入位置を示すマーカー
        this.currentDropMode = null; // 'reorder', 'folder', null
        this.isDisabled = false; // 範囲選択時などにドラッグを無効化
        this.dragClone = null; // ドラッグ中のクローン要素
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
        
        // エスケープキーでドラッグをキャンセル
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isDragging) {
                this.cancelDrag();
            }
        });
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
        
        // マウスポインタの位置から要素の左上までのオフセットを記録
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
                
                // 要素の現在の位置を正確に取得
                const rect = this.draggedElement.getBoundingClientRect();
                const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                
                // クローン要素を作成してドラッグ（元の要素は位置を保持）
                if (!this.dragClone) {
                    this.dragClone = this.draggedElement.cloneNode(true);
                    this.dragClone.style.transition = 'opacity 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease';
                    this.dragClone.style.position = 'fixed';
                    this.dragClone.style.zIndex = '9999';
                    this.dragClone.style.opacity = '0.7';
                    this.dragClone.style.cursor = 'grabbing';
                    this.dragClone.style.pointerEvents = 'none';
                    this.dragClone.style.transform = 'scale(1.02)';
                    this.dragClone.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
                    document.body.appendChild(this.dragClone);
                }
                
                // クローンの位置を設定
                this.dragClone.style.left = `${e.clientX - this.offsetX}px`;
                this.dragClone.style.top = `${e.clientY - this.offsetY}px`;
                
                // 元の要素を半透明に
                this.draggedElement.style.opacity = '0.3';
                
                console.log('Drag started after threshold');
            }
        }

        if (this.isDragging && this.dragClone) {
            // ドラッグ中のクローン要素を移動
            this.dragClone.style.left = `${e.clientX - this.offsetX}px`;
            this.dragClone.style.top = `${e.clientY - this.offsetY}px`;

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
                        const targetShortcut = this.shortcutManager.shortcuts[targetIndex];
                        const draggedShortcut = this.shortcutManager.shortcuts[this.draggedIndex];
                        
                        // フォルダーへのドロップは中央50%のみ
                        if (targetShortcut && targetShortcut.isFolder && 
                            dropXPercent >= 0.25 && dropXPercent <= 0.75) {
                            // フォルダーに追加モード
                            this.currentDropMode = 'folder';
                            this.clearHoverEffects();
                            this.hideInsertMarker();
                            elementBelow.classList.add('drag-over');
                            elementBelow.classList.add('folder-hover');
                        } 
                        // 通常のショートカット同士の場合
                        else if (!targetShortcut.isFolder && !draggedShortcut.isFolder &&
                                 dropXPercent >= 0.4 && dropXPercent <= 0.6) {
                            // フォルダー作成モード（中央20%のみ）
                            this.currentDropMode = 'folder';
                            this.clearHoverEffects();
                            this.hideInsertMarker();
                            elementBelow.classList.add('drag-over');
                        }
                        else {
                            // それ以外はすべて並び替えモード
                            this.currentDropMode = 'reorder';
                            this.clearHoverEffects();
                            
                            // グリッドのレイアウト情報を取得して端の検出を改善
                            const grid = document.getElementById('shortcutsGrid');
                            const gridRect = grid.getBoundingClientRect();
                            const gridStyle = window.getComputedStyle(grid);
                            const columns = Math.floor((gridRect.width + parseInt(gridStyle.gap || 16)) / (112 + 16));
                            
                            // ターゲット要素のDOM上の位置を取得
                            const allVisibleItems = Array.from(grid.children).filter(child => 
                                child.classList.contains('shortcut-item') && 
                                !child.dataset.isAddButton
                            );
                            
                            const targetDomIndex = allVisibleItems.indexOf(elementBelow);
                            const targetColumn = targetDomIndex % columns;
                            const isRightEdge = targetColumn === columns - 1;
                            
                            // 右端でのドロップの場合、次の行の最初に移動
                            if (isRightEdge && dropXPercent > 0.5) {
                                // 次の行の最初にプレースホルダーを表示
                                this.showInsertMarker(elementBelow, false);
                            } else {
                                this.showInsertMarker(elementBelow, dropXPercent < 0.5);
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
            
            if (!elementBelow) {
                console.log('No element below, cancelling drop');
                this.cleanup();
                return;
            }
            
            // フォルダーにドロップした場合
            if (elementBelow.classList.contains('folder-item')) {
                const folderId = elementBelow.dataset.folderId;
                if (folderId) {
                    console.log('Dropping on folder:', folderId);
                    this.shortcutManager.moveShortcutToFolder(this.draggedIndex, folderId);
                }
            }
            // プレースホルダー（ドロップゾーン）にドロップした場合
            else if (elementBelow === this.placeholder || elementBelow.classList.contains('drop-zone')) {
                console.log('Dropped on placeholder/drop zone');
                if (this.pendingInsertIndex !== null && this.pendingInsertIndex !== undefined && 
                    this.pendingInsertIndex !== this.draggedIndex) {
                    console.log('Reordering to drop zone position:', this.pendingInsertIndex);
                    this.shortcutManager.reorder(this.draggedIndex, this.pendingInsertIndex);
                }
            }
            // ショートカットにドロップした場合
            else if (elementBelow.classList.contains('shortcut-item')) {
                const targetIndex = parseInt(elementBelow.dataset.index);
                
                if (targetIndex !== this.draggedIndex) {
                    console.log('=== MOUSE DROP DETECTED ===');
                    console.log('From:', this.draggedIndex, 'To:', targetIndex);
                    console.log('Current drop mode:', this.currentDropMode);
                    console.log('Pending insert index:', this.pendingInsertIndex);
                    
                    // ドロップモードに基づいて処理
                    if (this.currentDropMode === 'reorder') {
                        // 並び替え処理
                        if (this.pendingInsertIndex !== null && this.pendingInsertIndex !== undefined) {
                            // ビジュアル位置からデータインデックスに変換
                            const visualIndex = this.pendingInsertIndex;
                            const dataIndex = this.convertVisualIndexToDataIndex(visualIndex);
                            
                            if (dataIndex !== this.draggedIndex) {
                                console.log('Reordering from', this.draggedIndex, 'to', dataIndex);
                                this.shortcutManager.reorder(this.draggedIndex, dataIndex);
                            }
                        }
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
        // ドラッグ中のクローンを一時的に非表示
        if (this.dragClone) {
            this.dragClone.style.display = 'none';
        }
        let elementBelow = document.elementFromPoint(x, y);
        if (this.dragClone) {
            this.dragClone.style.display = '';
        }
        
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
        document.querySelectorAll('.reorder-ready').forEach(el => {
            el.classList.remove('reorder-ready');
        });
    }
    
    showInsertMarker(targetElement, insertBefore) {
        const grid = document.getElementById('shortcutsGrid');
        
        // プレースホルダーを作成
        if (!this.placeholder) {
            this.placeholder = document.createElement('div');
            this.placeholder.className = 'shortcut-placeholder drop-zone';
            this.placeholder.style.width = '112px';
            this.placeholder.style.height = '112px';
        }
        
        // DOM上の位置に基づいてプレースホルダーを挿入
        this.insertPlaceholderAtTarget(grid, targetElement, insertBefore);
        
        // アイテムを移動
        this.moveItemsForPlaceholder(grid);
    }
    
    insertPlaceholderAtTarget(grid, targetElement, insertBefore) {
        // 既存のプレースホルダーを削除
        if (this.placeholder.parentNode) {
            this.placeholder.parentNode.removeChild(this.placeholder);
        }
        
        // ドラッグ中の要素の場合は何もしない
        if (parseInt(targetElement.dataset.index) === this.draggedIndex) {
            return;
        }
        
        // 挿入位置を決定
        if (insertBefore) {
            // ターゲットの前に挿入
            grid.insertBefore(this.placeholder, targetElement);
        } else {
            // ターゲットの後に挿入
            const nextSibling = targetElement.nextElementSibling;
            if (nextSibling && !nextSibling.dataset.isAddButton) {
                grid.insertBefore(this.placeholder, nextSibling);
            } else {
                // 最後の要素の場合、追加ボタンの前に挿入
                const addButton = grid.querySelector('[data-is-add-button="true"]');
                if (addButton) {
                    grid.insertBefore(this.placeholder, addButton);
                } else {
                    grid.appendChild(this.placeholder);
                }
            }
        }
        
        // データ並び替えのための位置を計算（実際の並び替え時に使用）
        this.calculatePendingIndex(grid);
    }
    
    calculatePendingIndex(grid) {
        // プレースホルダーの現在のDOM位置を取得
        const allChildren = Array.from(grid.children);
        const placeholderPos = allChildren.indexOf(this.placeholder);
        
        // ショートカットアイテムのみをフィルタ（追加ボタンとプレースホルダーを除外）
        const shortcutItems = allChildren.filter(child => 
            child.classList.contains('shortcut-item') && 
            !child.dataset.isAddButton &&
            child !== this.placeholder
        );
        
        // プレースホルダーより前にあるアイテムの数を数える
        let itemsBeforePlaceholder = 0;
        for (let i = 0; i < placeholderPos; i++) {
            if (allChildren[i].classList.contains('shortcut-item') && 
                !allChildren[i].dataset.isAddButton &&
                allChildren[i] !== this.placeholder) {
                itemsBeforePlaceholder++;
            }
        }
        
        // ドラッグ中のアイテムの元の位置を考慮
        const draggedItem = grid.querySelector(`[data-index="${this.draggedIndex}"]`);
        if (draggedItem) {
            const draggedPos = allChildren.indexOf(draggedItem);
            if (draggedPos < placeholderPos) {
                // ドラッグアイテムがプレースホルダーより前にある場合
                this.pendingInsertIndex = itemsBeforePlaceholder - 1;
            } else {
                // ドラッグアイテムがプレースホルダーより後にある場合
                this.pendingInsertIndex = itemsBeforePlaceholder;
            }
        } else {
            this.pendingInsertIndex = itemsBeforePlaceholder;
        }
        
        console.log('Pending insert index:', this.pendingInsertIndex);
    }
    
    convertVisualIndexToDataIndex(visualIndex) {
        // ビジュアルインデックス（表示位置）をデータインデックス（shortcuts配列の位置）に変換
        const shortcuts = this.shortcutManager.shortcuts;
        let visibleCount = 0;
        
        for (let i = 0; i < shortcuts.length; i++) {
            const shortcut = shortcuts[i];
            // 表示されるアイテムのみカウント（フォルダー内のアイテムは除外）
            if (!shortcut.folderId || shortcut.isFolder) {
                if (visibleCount === visualIndex) {
                    return i;
                }
                visibleCount++;
            }
        }
        
        // 最後の位置
        return shortcuts.length;
    }
    
    moveItemsForPlaceholder(grid) {
        // グリッドのレイアウト情報を取得
        const gridRect = grid.getBoundingClientRect();
        const gridStyle = window.getComputedStyle(grid);
        const columns = Math.floor((gridRect.width + parseInt(gridStyle.gap || 16)) / (112 + 16));
        
        // プレースホルダーを一時的に削除してオリジナルの位置を取得
        const placeholderParent = this.placeholder.parentNode;
        const placeholderNextSibling = this.placeholder.nextSibling;
        if (placeholderParent) {
            placeholderParent.removeChild(this.placeholder);
        }
        
        // オリジナルの状態でアイテムを取得
        const allItems = Array.from(grid.children).filter(child => 
            child.classList.contains('shortcut-item') && 
            !child.dataset.isAddButton
        );
        
        // 各アイテムのオリジナル位置を記録
        const originalPositions = new Map();
        allItems.forEach((item, index) => {
            originalPositions.set(item, index);
        });
        
        // プレースホルダーを元に戻す
        if (placeholderParent) {
            if (placeholderNextSibling) {
                placeholderParent.insertBefore(this.placeholder, placeholderNextSibling);
            } else {
                placeholderParent.appendChild(this.placeholder);
            }
        }
        
        // 現在の状態で再度アイテムを取得
        const currentItems = Array.from(grid.children).filter(child => 
            child.classList.contains('shortcut-item') && 
            !child.dataset.isAddButton
        );
        
        // 各アイテムの移動を計算
        currentItems.forEach((item, newIndex) => {
            const itemIndex = parseInt(item.dataset.index);
            
            // ドラッグ中のアイテムは透明にするだけ
            if (itemIndex === this.draggedIndex) {
                item.style.pointerEvents = 'none';
                return;
            }
            
            // オリジナル位置を取得
            const originalIndex = originalPositions.get(item);
            if (originalIndex === undefined) return;
            
            // プレースホルダーによる影響を計算
            let adjustedNewIndex = newIndex;
            
            // プレースホルダーの位置を取得
            const allChildren = Array.from(grid.children);
            const placeholderPos = allChildren.indexOf(this.placeholder);
            const itemPos = allChildren.indexOf(item);
            
            // プレースホルダーがアイテムより前にある場合、位置を調整
            if (placeholderPos !== -1 && placeholderPos < itemPos) {
                adjustedNewIndex = newIndex - 1;
            }
            
            // 移動量を計算
            const oldRow = Math.floor(originalIndex / columns);
            const oldCol = originalIndex % columns;
            const newRow = Math.floor(adjustedNewIndex / columns);
            const newCol = adjustedNewIndex % columns;
            
            const deltaX = (newCol - oldCol) * (112 + 16);
            const deltaY = (newRow - oldRow) * (112 + 16);
            
            // アニメーション適用
            if (deltaX !== 0 || deltaY !== 0) {
                item.style.transition = 'transform 0.4s cubic-bezier(0.4, 0.0, 0.2, 1)';
                item.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            } else {
                item.style.transform = '';
            }
        });
    }
    
    hideInsertMarker() {
        // アイテムのスタイルをリセット
        const grid = document.getElementById('shortcutsGrid');
        if (grid) {
            const items = grid.querySelectorAll('.shortcut-item');
            items.forEach(item => {
                item.style.transform = '';
                item.style.pointerEvents = '';
                item.classList.remove('moving');
                // 透明度は元の要素のみリセット（クローンとは別）
                if (!this.dragClone || item !== this.draggedElement) {
                    item.style.opacity = '';
                }
            });
        }
        
        // プレースホルダーを削除
        if (this.placeholder && this.placeholder.parentNode) {
            this.placeholder.parentNode.removeChild(this.placeholder);
        }
        
        this.pendingInsertIndex = null;
    }

    cleanup() {
        // クローンを削除
        if (this.dragClone && this.dragClone.parentNode) {
            this.dragClone.parentNode.removeChild(this.dragClone);
            this.dragClone = null;
        }
        
        if (this.draggedElement) {
            // 元の要素をスムーズにリセット
            this.draggedElement.style.transition = 'opacity 0.3s ease';
            this.draggedElement.style.opacity = '1';
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
        this.dragClone = null;
        this.isDragging = false;
        this.currentDropMode = null;
    }
    
    cancelDrag() {
        console.log('Drag cancelled');
        this.cleanup();
    }
}

// グローバルに公開
window.MouseDragManager = MouseDragManager;