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
        this.originalItemPositions = new Map(); // ドラッグ開始時の各アイテムの位置
    }

    init() {
        console.log('=== MouseDragManager initialized ===');
        // グローバルイベントは一度だけ登録
        if (!this.globalEventsAttached) {
            document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
            
            // エスケープキーでドラッグをキャンセル
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isDragging) {
                    this.cancelDrag();
                }
            });
            
            this.globalEventsAttached = true;
        }
        
        this.attachEventListeners();
    }

    attachEventListeners() {
        const grid = document.getElementById('shortcutsGrid');
        if (!grid) return;

        // 各ショートカットアイテムにイベントを設定
        const items = grid.querySelectorAll('.shortcut-item');
        console.log(`[MouseDragManager] Attaching listeners to ${items.length} items`);
        items.forEach((item, index) => {
            // 追加ボタンはスキップ
            if (item.dataset.isAddButton === 'true') {
                console.log(`[MouseDragManager] Skipping add button`);
                return;
            }
            // マウスダウンでドラッグ開始
            item.addEventListener('mousedown', (e) => this.handleMouseDown(e, item));
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
        

        // ドラッグの準備だけ行い、実際のドラッグはまだ開始しない
        this.draggedElement = item;
        this.draggedIndex = parseInt(item.dataset.index);
        this.hasMoved = false;
        
        // インデックスの検証
        if (isNaN(this.draggedIndex) || this.draggedIndex < 0 || 
            this.draggedIndex >= this.shortcutManager.shortcuts.length) {
            console.error('Invalid drag index:', this.draggedIndex, 'Total items:', this.shortcutManager.shortcuts.length);
            this.draggedElement = null;
            this.draggedIndex = null;
            return;
        }
        
        // ドラッグ開始時の各アイテムの位置を記録
        const grid = document.getElementById('shortcutsGrid');
        if (grid) {
            this.originalItemPositions.clear();
            const items = Array.from(grid.children).filter(child => 
                child.classList.contains('shortcut-item') && 
                !child.dataset.isAddButton
            );
            items.forEach((item, index) => {
                const itemIndex = parseInt(item.dataset.index);
                this.originalItemPositions.set(itemIndex, index);
            });
        }
        
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
                    this.dragClone.style.transition = 'opacity 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), box-shadow 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                    this.dragClone.style.position = 'fixed';
                    this.dragClone.style.zIndex = '9999';
                    this.dragClone.style.opacity = '0.85';
                    this.dragClone.style.cursor = 'grabbing';
                    this.dragClone.style.pointerEvents = 'none';
                    this.dragClone.style.transform = 'scale(1.05)';
                    this.dragClone.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
                    document.body.appendChild(this.dragClone);
                }
                
                // クローンの位置を設定
                this.dragClone.style.left = `${e.clientX - this.offsetX}px`;
                this.dragClone.style.top = `${e.clientY - this.offsetY}px`;
                
                // 元の要素を完全に隠す（グリッドアイテムとして扱われないようにする）
                this.draggedElement.classList.remove('shortcut-item');
                this.draggedElement.classList.add('dragging-hidden');
                this.draggedElement.style.position = 'fixed';
                this.draggedElement.style.left = '-9999px';
                this.draggedElement.style.top = '-9999px';
                this.draggedElement.style.width = '0';
                this.draggedElement.style.height = '0';
                this.draggedElement.style.margin = '0';
                this.draggedElement.style.opacity = '0';
                this.draggedElement.style.pointerEvents = 'none';
                
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
                            const gap = parseInt(gridStyle.gap || gridStyle.gridGap || '16');
                            const itemWidth = 112; // ショートカットアイテムの幅
                            const columns = Math.floor((gridRect.width + gap) / (itemWidth + gap));
                            
                            console.log(`[MouseDrag] Grid columns: ${columns}, width: ${gridRect.width}, gap: ${gap}`);
                            
                            // ターゲット要素のDOM上の位置を取得
                            const allVisibleItems = Array.from(grid.children).filter(child => 
                                child.classList.contains('shortcut-item') && 
                                !child.dataset.isAddButton
                            );
                            
                            const targetDomIndex = allVisibleItems.indexOf(elementBelow);
                            const targetColumn = targetDomIndex % columns;
                            const isRightEdge = targetColumn === columns - 1;
                            const isLastItem = targetDomIndex === allVisibleItems.length - 1;
                            
                            console.log(`[MouseDrag] Target: index=${targetDomIndex}, column=${targetColumn}, isRightEdge=${isRightEdge}, isLastItem=${isLastItem}`);
                            
                            // ドラッグ元とターゲットのインデックスを比較
                            const draggedDomIndex = allVisibleItems.findIndex(item => 
                                parseInt(item.dataset.index) === this.draggedIndex
                            );
                            
                            // 挿入位置の決定
                            let insertBefore;
                            
                            // 最後のアイテムかつ右側にドロップする場合
                            if (isLastItem && dropXPercent > 0.5) {
                                insertBefore = false;
                            }
                            // 右端でのドロップの場合
                            else if (isRightEdge && dropXPercent > 0.5) {
                                insertBefore = false;
                            }
                            // ドラッグ元がターゲットより左にある場合
                            else if (draggedDomIndex < targetDomIndex) {
                                // 左から右へのドラッグ：ドロップ位置で判定
                                insertBefore = dropXPercent < 0.5;
                            }
                            // ドラッグ元がターゲットより右にある場合
                            else if (draggedDomIndex > targetDomIndex) {
                                // 右から左へのドラッグ：通常通り
                                insertBefore = dropXPercent < 0.5;
                            }
                            // 同じ位置（または見つからない場合）
                            else {
                                insertBefore = dropXPercent < 0.5;
                            }
                            
                            this.showInsertMarker(elementBelow, insertBefore);
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

        // 実際にドラッグが発生した場合の処理
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
                    this.shortcutManager.moveShortcutToFolder(this.draggedIndex, folderId).then(() => {
                        console.log('Move to folder completed, cleaning up');
                        this.cleanup();
                    });
                    this.cleanupHandled = true;
                }
            }
            // プレースホルダー（ドロップゾーン）にドロップした場合
            else if (elementBelow === this.placeholder || elementBelow.classList.contains('drop-zone')) {
                console.log('Dropped on placeholder/drop zone');
                if (this.pendingInsertIndex !== null && this.pendingInsertIndex !== undefined) {
                    // ビジュアル位置からデータインデックスに変換
                    const visualIndex = this.pendingInsertIndex;
                    const dataIndex = this.convertVisualIndexToDataIndex(visualIndex);
                    
                    console.log(`Drop calculation: draggedIndex=${this.draggedIndex}, visualIndex=${visualIndex}, dataIndex=${dataIndex}`);
                    
                    // 同じ位置への移動でない場合のみ実行
                    if (dataIndex !== this.draggedIndex) {
                        console.log('Reordering from', this.draggedIndex, 'to', dataIndex);
                        // reorderを実行し、完了を待つ
                        this.shortcutManager.reorder(this.draggedIndex, dataIndex).then(() => {
                            console.log('Reorder completed, cleaning up');
                            this.cleanup();
                        });
                        // cleanup()の重複実行を防ぐためフラグを設定
                        this.cleanupHandled = true;
                    } else {
                        console.log('Same position drop, skipping reorder');
                    }
                } else {
                    console.log('No pending insert index, skipping drop');
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
                            
                            console.log(`[handleMouseUp] Reorder calculation:`, {
                                visualIndex,
                                dataIndex,
                                draggedIndex: this.draggedIndex,
                                totalItems: this.shortcutManager.shortcuts.length,
                                valid: dataIndex >= 0 && dataIndex <= this.shortcutManager.shortcuts.length,
                                dataIndexType: typeof dataIndex,
                                draggedIndexType: typeof this.draggedIndex
                            });
                            
                            // 同じ位置への移動の場合はスキップ
                            if (dataIndex === this.draggedIndex) {
                                console.log('Same position drop in reorder mode, skipping');
                            }
                            // インデックスの範囲チェック
                            else if (dataIndex >= 0 && 
                                dataIndex <= this.shortcutManager.shortcuts.length &&
                                this.draggedIndex >= 0 &&
                                this.draggedIndex < this.shortcutManager.shortcuts.length) {
                                console.log('Reordering from', this.draggedIndex, 'to', dataIndex);
                                // reorderを実行し、完了を待つ
                                this.shortcutManager.reorder(this.draggedIndex, dataIndex).then(() => {
                                    console.log('Reorder completed, cleaning up');
                                    this.cleanup();
                                });
                                // cleanup()の重複実行を防ぐためフラグを設定
                                this.cleanupHandled = true;
                            } else {
                                console.warn('Invalid reorder index:', dataIndex, 'Total items:', this.shortcutManager.shortcuts.length);
                                console.warn('Validation details:', {
                                    'dataIndex !== this.draggedIndex': dataIndex !== this.draggedIndex,
                                    'dataIndex >= 0': dataIndex >= 0,
                                    'dataIndex <= length': dataIndex <= this.shortcutManager.shortcuts.length,
                                    'draggedIndex >= 0': this.draggedIndex >= 0,
                                    'draggedIndex < length': this.draggedIndex < this.shortcutManager.shortcuts.length,
                                    'draggedIndex': this.draggedIndex,
                                    'dataIndex': dataIndex
                                });
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
                                // インデックスの範囲チェック
                                if (this.draggedIndex >= 0 && this.draggedIndex < this.shortcutManager.shortcuts.length &&
                                    targetIndex >= 0 && targetIndex < this.shortcutManager.shortcuts.length) {
                                    this.shortcutManager.createFolderFromShortcuts(this.draggedIndex, targetIndex).then(() => {
                                        console.log('Folder creation completed, cleaning up');
                                        this.cleanup();
                                    });
                                    this.cleanupHandled = true;
                                } else {
                                    console.error('Invalid indices for folder creation:', this.draggedIndex, targetIndex);
                                }
                            }
                            // フォルダーにショートカットを追加
                            else if (targetShortcut.isFolder && !draggedShortcut.isFolder) {
                                console.log('Adding shortcut to folder');
                                console.log('DraggedIndex:', this.draggedIndex, 'TargetIndex:', targetIndex);
                                console.log('TargetShortcut:', targetShortcut);
                                console.log('Total shortcuts before:', this.shortcutManager.shortcuts.length);
                                // ドラッグインデックスが範囲内か確認
                                if (this.draggedIndex < this.shortcutManager.shortcuts.length) {
                                    this.shortcutManager.addShortcutToFolder(this.draggedIndex, targetShortcut.folderId).then(() => {
                                        console.log('Add to folder completed, cleaning up');
                                        this.cleanup();
                                    });
                                    this.cleanupHandled = true;
                                } else {
                                    console.error('Dragged index out of range:', this.draggedIndex);
                                }
                            }
                        }
                    }
                }
            }
        }

        // クリーンアップ（reorder処理で既にcleanupが呼ばれる場合はスキップ）
        if (!this.cleanupHandled) {
            this.cleanup();
        }
        // フラグをリセット
        this.cleanupHandled = false;
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
        
        if (placeholderPos === -1) {
            return;
        }
        
        // プレースホルダーより前の表示されているアイテムをカウント（視覚的インデックス）
        let visualIndex = 0;
        let debugItems = [];
        
        for (let i = 0; i < placeholderPos; i++) {
            const child = allChildren[i];
            if (child.classList.contains('shortcut-item') && 
                !child.dataset.isAddButton) {
                
                const itemIndex = parseInt(child.dataset.index);
                // ドラッグ中のアイテムはカウントしない
                if (itemIndex !== this.draggedIndex) {
                    debugItems.push(itemIndex);
                    visualIndex++;
                }
            }
        }
        
        this.pendingInsertIndex = visualIndex;
        
        // デバッグ情報
        console.log(`[calculatePendingIndex] Visual index: ${visualIndex}, placeholder at DOM pos: ${placeholderPos}`);
        console.log(`[calculatePendingIndex] Items before placeholder:`, debugItems);
    }
    
    convertVisualIndexToDataIndex(visualIndex) {
        // ビジュアルインデックス（表示位置）をデータインデックス（shortcuts配列の位置）に変換
        const shortcuts = this.shortcutManager.shortcuts;
        let visibleCount = 0;
        let draggedItemVisualIndex = -1;
        
        // 入力検証
        if (visualIndex === null || visualIndex === undefined || isNaN(visualIndex) || visualIndex < 0) {
            console.error(`[convertVisualToData] Invalid visual index: ${visualIndex}`);
            return this.draggedIndex; // 安全なデフォルト値を返す
        }
        
        // まず、ドラッグ中のアイテムの視覚的位置を見つける
        let tempVisibleCount = 0;
        for (let i = 0; i < shortcuts.length; i++) {
            const shortcut = shortcuts[i];
            if (!shortcut.folderId || shortcut.isFolder) {
                if (i === this.draggedIndex) {
                    draggedItemVisualIndex = tempVisibleCount;
                    break;
                }
                tempVisibleCount++;
            }
        }
        
        console.log(`[convertVisualToData] Target visual index: ${visualIndex}, Dragged item visual index: ${draggedItemVisualIndex}`);
        
        // 左から右へのドラッグの場合（ドラッグアイテムが前にある）
        if (draggedItemVisualIndex < visualIndex) {
            visibleCount = 0;
            
            // ドラッグ中のアイテムを除外して、視覚インデックスに対応するデータインデックスを探す
            for (let i = 0; i < shortcuts.length; i++) {
                const shortcut = shortcuts[i];
                if (!shortcut.folderId || shortcut.isFolder) {
                    // ドラッグ中のアイテムは除外
                    if (i !== this.draggedIndex) {
                        // visualIndex - 1 の位置を探す（ドラッグアイテムが抜けた分を考慮）
                        if (visibleCount === visualIndex - 1) {
                            // デバッグ: 現在の計算を詳しく表示
                            console.log(`[convertVisualToData] Left-to-right calculation:`);
                            console.log(`  - Visual index: ${visualIndex}`);
                            console.log(`  - Current data index (i): ${i}`);
                            console.log(`  - Will return: ${i + 1} (i + 1 for proper placement)`);
                            // 左から右へのドラッグ時は i + 1 を返す
                            const result = i + 1;
                            // 最大値を超えないように制限
                            return Math.min(result, this.shortcutManager.shortcuts.length);
                        }
                        visibleCount++;
                    }
                }
            }
            // ループ内で見つからなかった場合（最後の位置）
            console.log(`[convertVisualToData] Left-to-right: not found in loop, returning end position`);
            return shortcuts.length;
        }
        // 右から左へのドラッグの場合（ドラッグアイテムが後にある）
        else if (draggedItemVisualIndex > visualIndex) {
            visibleCount = 0;
            
            for (let i = 0; i < shortcuts.length; i++) {
                const shortcut = shortcuts[i];
                if (!shortcut.folderId || shortcut.isFolder) {
                    if (visibleCount === visualIndex) {
                        console.log(`[convertVisualToData] Right-to-left: Visual ${visualIndex} → Data ${i}`);
                        return i;
                    }
                    
                    // ドラッグ中のアイテムはカウントしない
                    if (i !== this.draggedIndex) {
                        visibleCount++;
                    }
                }
            }
            // ループ内で見つからなかった場合
            console.log(`[convertVisualToData] Right-to-left: not found in loop, returning 0`);
            return 0;
        }
        // 同じ位置の場合
        else {
            console.log(`[convertVisualToData] Same position: returning dragged index ${this.draggedIndex}`);
            return this.draggedIndex;
        }
        
        // 最後の位置を返す場合
        console.log(`[convertVisualToData] Visual ${visualIndex} → Data ${shortcuts.length} (end of list)`);
        return shortcuts.length;
    }
    
    moveItemsForPlaceholder(grid) {
        // グリッドレイアウト情報を取得
        const gridRect = grid.getBoundingClientRect();
        const gridStyle = window.getComputedStyle(grid);
        const gap = parseInt(gridStyle.gap || '16');
        const itemWidth = 112;
        const itemHeight = 112;
        const columns = Math.floor((gridRect.width + gap) / (itemWidth + gap));
        
        // プレースホルダーを含む全要素を取得（dragging-hiddenクラスは除外される）
        const allChildren = Array.from(grid.children).filter(child => 
            child.classList.contains('shortcut-item') && 
            !child.dataset.isAddButton &&
            !child.classList.contains('dragging-hidden')
        );
        
        // プレースホルダーの位置を取得
        const placeholderIndex = allChildren.indexOf(this.placeholder);
        if (placeholderIndex === -1) return;
        
        // ドラッグ中のアイテムの元の位置を取得
        const draggedOriginalPos = this.originalItemPositions.get(this.draggedIndex);
        
        // console.log(`[moveItems] Placeholder at index ${placeholderIndex}, dragged from ${draggedOriginalPos}`);
        
        // 各アイテムの移動を計算
        allChildren.forEach((item, visualIndex) => {
            if (item === this.placeholder) return;
            
            const itemDataIndex = parseInt(item.dataset.index);
            
            // ドラッグ中のアイテムはスキップ（DOMから削除されているので通常は来ないはず）
            if (itemDataIndex === this.draggedIndex) {
                console.warn('Dragged item found in moveItemsForPlaceholder - this should not happen');
                return;
            }
            
            // このアイテムの元の位置を取得
            const originalPos = this.originalItemPositions.get(itemDataIndex);
            if (originalPos === undefined) return;
            
            // 移動方向を決定する新しいロジック
            let targetPosition = visualIndex;
            
            // シンプルな移動ロジック：プレースホルダーの位置のみで判定
            // ドラッグ中のアイテムはすでにグリッドから除外されている
            
            if (visualIndex >= placeholderIndex) {
                // プレースホルダー以降のアイテムは右に移動
                targetPosition = visualIndex + 1;
            } else {
                // プレースホルダーより前のアイテムは移動しない
                targetPosition = visualIndex;
            }
            
            // 移動量を計算
            const currentRow = Math.floor(visualIndex / columns);
            const currentCol = visualIndex % columns;
            const targetRow = Math.floor(targetPosition / columns);
            const targetCol = targetPosition % columns;
            
            const deltaX = (targetCol - currentCol) * (itemWidth + gap);
            const deltaY = (targetRow - currentRow) * (itemHeight + gap);
            
            // アニメーションを適用
            if (deltaX !== 0 || deltaY !== 0) {
                item.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
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
                // スムーズなリセットアニメーション
                item.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                item.style.transform = '';
                item.style.transitionDelay = '';
                // ドラッグ中のアイテムはDOMから削除されているのでスキップ
                if (parseInt(item.dataset.index) !== this.draggedIndex) {
                    item.style.pointerEvents = '';
                    item.classList.remove('moving');
                    // 表示状態と透明度をリセット
                    item.style.opacity = '';
                }
                
                // アニメーション完了後にトランジションをクリア
                setTimeout(() => {
                    item.style.transition = '';
                }, 300);
            });
        }
        
        // プレースホルダーを削除
        if (this.placeholder && this.placeholder.parentNode) {
            // フェードアウトアニメーション
            this.placeholder.style.transition = 'opacity 0.2s ease';
            this.placeholder.style.opacity = '0';
            setTimeout(() => {
                if (this.placeholder && this.placeholder.parentNode) {
                    this.placeholder.parentNode.removeChild(this.placeholder);
                }
            }, 200);
        }
        
        this.pendingInsertIndex = null;
    }

    cleanup() {
        console.log('[MouseDrag] Cleanup called - draggedIndex:', this.draggedIndex);
        
        // クローンを削除
        if (this.dragClone && this.dragClone.parentNode) {
            this.dragClone.parentNode.removeChild(this.dragClone);
            this.dragClone = null;
        }
        
        if (this.draggedElement) {
            // クラスとスタイルをリセット
            this.draggedElement.classList.remove('dragging-hidden');
            this.draggedElement.classList.add('shortcut-item');
            this.draggedElement.style.position = '';
            this.draggedElement.style.left = '';
            this.draggedElement.style.top = '';
            this.draggedElement.style.width = '';
            this.draggedElement.style.height = '';
            this.draggedElement.style.margin = '';
            this.draggedElement.style.opacity = '1';
            this.draggedElement.style.pointerEvents = '';
        }

        // ホバーエフェクトをクリア
        this.clearHoverEffects();
        
        // 挿入マーカーを削除
        this.hideInsertMarker();
        
        // すべてのプレースホルダーを強制的に削除
        const allPlaceholders = document.querySelectorAll('.shortcut-placeholder');
        allPlaceholders.forEach(placeholder => {
            if (placeholder.parentNode) {
                placeholder.parentNode.removeChild(placeholder);
            }
        });

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
        this.originalItemPositions.clear();
    }
    
    cancelDrag() {
        console.log('Drag cancelled');
        this.cleanup();
    }
    
    // プレースホルダーをすべて削除（公開メソッド）
    removeAllPlaceholders() {
        const allPlaceholders = document.querySelectorAll('.shortcut-placeholder');
        allPlaceholders.forEach(placeholder => {
            if (placeholder.parentNode) {
                placeholder.parentNode.removeChild(placeholder);
            }
        });
    }
}

// グローバルに公開
window.MouseDragManager = MouseDragManager;