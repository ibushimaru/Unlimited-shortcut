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
            
            // プレースホルダーを作成（ドラッグ要素と置き換える）
            if (!this.placeholder) {
                this.placeholder = document.createElement('div');
                this.placeholder.className = 'shortcut-placeholder';
                this.placeholder.style.width = '112px';
                this.placeholder.style.height = '112px';
                this.placeholder.dataset.draggedIndex = this.draggedIndex;
            }
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
                
                // 元の要素をプレースホルダーに置き換える
                const grid = document.getElementById('shortcutsGrid');
                if (grid && this.placeholder) {
                    console.log('[Before Replace] Grid children:', grid.children.length);
                    console.log('[Before Replace] Dragged element parent:', this.draggedElement.parentNode.tagName);
                    
                    // プレースホルダーを元の要素の位置に挿入
                    grid.insertBefore(this.placeholder, this.draggedElement);
                    
                    console.log('[After Insert] Grid children:', grid.children.length);
                    
                    // 元の要素を一時的にグリッドから削除
                    grid.removeChild(this.draggedElement);
                    
                    console.log('[After Remove] Grid children:', grid.children.length);
                    
                    // bodyに追加して完全に非表示にする
                    this.draggedElement.style.display = 'none';
                    this.draggedElement.style.visibility = 'hidden';
                    this.draggedElement.style.position = 'absolute';
                    this.draggedElement.style.left = '-9999px';
                    this.draggedElement.style.top = '-9999px';
                    this.draggedElement.style.width = '0';
                    this.draggedElement.style.height = '0';
                    this.draggedElement.classList.add('dragging-original');
                    document.body.appendChild(this.draggedElement);
                    
                    // 詳細なデバッグ：グリッド内の全要素を確認
                    console.log('=== DRAG START DEBUG ===');
                    console.log('[Drag Start] Grid children count:', grid.children.length);
                    
                    // 各要素を詳細に調査
                    Array.from(grid.children).forEach((child, index) => {
                        const info = {
                            index: index,
                            classes: child.className,
                            display: child.style.display,
                            visibility: child.style.visibility,
                            width: child.style.width || child.offsetWidth + 'px',
                            height: child.style.height || child.offsetHeight + 'px',
                            dataIndex: child.dataset.index,
                            isAddButton: child.dataset.isAddButton,
                            isPlaceholder: child.classList.contains('shortcut-placeholder'),
                            isSpacer: child.classList.contains('grid-spacer')
                        };
                        console.log(`[Grid Child ${index}]:`, info);
                    });
                    
                    console.log('[Drag Start] Placeholder in grid:', grid.contains(this.placeholder));
                    console.log('[Drag Start] Dragged element in grid:', grid.contains(this.draggedElement));
                    
                    // プレースホルダーの数を確認
                    const allPlaceholders = grid.querySelectorAll('.shortcut-placeholder');
                    console.log('[Drag Start] Total placeholders in grid:', allPlaceholders.length);
                    if (allPlaceholders.length > 1) {
                        console.error('WARNING: Multiple placeholders detected!');
                        allPlaceholders.forEach((ph, idx) => {
                            console.log(`Placeholder ${idx}:`, {
                                parent: ph.parentNode.tagName,
                                classes: ph.className,
                                isSame: ph === this.placeholder
                            });
                        });
                    }
                    
                    console.log('=== END DRAG START DEBUG ===');
                }
                
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
                            // フォルダーをフォルダーに入れようとしている場合は拒否
                            if (draggedShortcut && draggedShortcut.isFolder) {
                                this.currentDropMode = null;
                                this.clearHoverEffects();
                                // プレースホルダーを目立たなくする
                                if (this.placeholder) {
                                    this.placeholder.classList.remove('drop-zone');
                                    this.placeholder.style.opacity = '0.3';
                                }
                                // 拒否を示す視覚的フィードバック
                                elementBelow.classList.add('folder-reject');
                            } else {
                                // 通常のショートカットをフォルダーに追加
                                this.currentDropMode = 'folder';
                                this.clearHoverEffects();
                                // プレースホルダーからドロップゾーンクラスを削除
                                if (this.placeholder) {
                                    this.placeholder.classList.remove('drop-zone');
                                    this.placeholder.style.visibility = '';
                                    this.placeholder.style.opacity = '';
                                }
                                elementBelow.classList.add('drag-over');
                                elementBelow.classList.add('folder-hover');
                            }
                        } 
                        // 通常のショートカット同士の場合
                        else if (!targetShortcut.isFolder && !draggedShortcut.isFolder &&
                                 dropXPercent >= 0.4 && dropXPercent <= 0.6) {
                            // フォルダー作成モード（中央20%のみ）
                            this.currentDropMode = 'folder';
                            this.clearHoverEffects();
                            // プレースホルダーからドロップゾーンクラスを削除
                            if (this.placeholder) {
                                this.placeholder.classList.remove('drop-zone');
                            }
                            elementBelow.classList.add('drag-over');
                        }
                        else {
                            // それ以外はすべて並び替えモード
                            this.currentDropMode = 'reorder';
                            this.clearHoverEffects();
                            
                            // プレースホルダーを表示
                            if (this.placeholder) {
                                this.placeholder.style.visibility = '';
                                this.placeholder.style.opacity = '';
                            }
                            
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
                                !child.dataset.isAddButton &&
                                !child.classList.contains('grid-spacer')
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
                // プレースホルダーからドロップゾーンクラスを削除
                if (this.placeholder) {
                    this.placeholder.classList.remove('drop-zone');
                    this.placeholder.style.visibility = '';
                    this.placeholder.style.opacity = '';
                }
                this.currentDropMode = null;
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
                    
                    // 元の要素を削除（moveShortcutToFolderとrenderで新しく作成されるため）
                    if (this.draggedElement && this.draggedElement.parentNode) {
                        this.draggedElement.parentNode.removeChild(this.draggedElement);
                    }
                    
                    this.shortcutManager.moveShortcutToFolder(this.draggedIndex, folderId).then(() => {
                        console.log('Move to folder completed, cleaning up');
                        this.cleanupAfterReorder();
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
                        
                        // 元の要素を削除（reorderとrenderで新しく作成されるため）
                        if (this.draggedElement && this.draggedElement.parentNode) {
                            this.draggedElement.parentNode.removeChild(this.draggedElement);
                        }
                        
                        // reorderを実行し、完了を待つ
                        this.shortcutManager.reorder(this.draggedIndex, dataIndex).then(() => {
                            console.log('Reorder completed, cleaning up');
                            // 元の要素は既に削除されているので、プレースホルダーのクリーンアップのみ
                            this.cleanupAfterReorder();
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
                                
                                // 元の要素を削除（reorderとrenderで新しく作成されるため）
                                if (this.draggedElement && this.draggedElement.parentNode) {
                                    this.draggedElement.parentNode.removeChild(this.draggedElement);
                                }
                                
                                // reorderを実行し、完了を待つ
                                this.shortcutManager.reorder(this.draggedIndex, dataIndex).then(() => {
                                    console.log('Reorder completed, cleaning up');
                                    // 元の要素は既に削除されているので、プレースホルダーのクリーンアップのみ
                                    this.cleanupAfterReorder();
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
                            // フォルダーをフォルダーにドロップしようとした場合は何もしない
                            if (draggedShortcut.isFolder && targetShortcut.isFolder) {
                                console.log('Cannot drop folder onto folder - operation rejected');
                                // 何もしない（フォルダーの中にフォルダーは作れない）
                            }
                            // 両方がショートカットの場合はフォルダー作成
                            else if (!draggedShortcut.isFolder && !targetShortcut.isFolder) {
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
                    } else if (this.currentDropMode === null) {
                        // ドロップモードがnullの場合（フォルダーへのフォルダードロップなど）
                        console.log('Drop mode is null - operation rejected');
                        // 拒否されたドロップでも要素を即座に復元する必要がある
                        this.cleanup();
                        this.cleanupHandled = true;
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
        document.querySelectorAll('.folder-reject').forEach(el => {
            el.classList.remove('folder-reject');
        });
    }
    
    showInsertMarker(targetElement, insertBefore) {
        console.log('=== SHOW INSERT MARKER ===');
        const grid = document.getElementById('shortcutsGrid');
        
        // プレースホルダーがなければエラー（ドラッグ開始時に作成されているはず）
        if (!this.placeholder) {
            console.error('Placeholder should exist at this point');
            return;
        }
        
        console.log('[ShowMarker] Target element:', {
            index: targetElement.dataset.index,
            classes: targetElement.className,
            insertBefore: insertBefore
        });
        
        // プレースホルダーにドロップゾーンクラスを追加
        this.placeholder.classList.add('drop-zone');
        
        // DOM上の位置に基づいてプレースホルダーを移動
        this.insertPlaceholderAtTarget(grid, targetElement, insertBefore);
        
        // アイテムを移動
        this.moveItemsForPlaceholder(grid);
        console.log('=== END SHOW INSERT MARKER ===');
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
            if (nextSibling && !nextSibling.dataset.isAddButton && !nextSibling.classList.contains('grid-spacer')) {
                grid.insertBefore(this.placeholder, nextSibling);
            } else {
                // 最後の要素の場合、スペーサーの前に挿入
                const spacer = grid.querySelector('.grid-spacer');
                if (spacer) {
                    grid.insertBefore(this.placeholder, spacer);
                } else {
                    // スペーサーがない場合は追加ボタンの前に挿入
                    const addButton = grid.querySelector('[data-is-add-button="true"]');
                    if (addButton) {
                        grid.insertBefore(this.placeholder, addButton);
                    } else {
                        grid.appendChild(this.placeholder);
                    }
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
                !child.dataset.isAddButton &&
                !child.classList.contains('shortcut-placeholder') &&
                !child.classList.contains('grid-spacer')) {
                
                const itemIndex = parseInt(child.dataset.index);
                debugItems.push(itemIndex);
                visualIndex++;
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
        console.log('=== MOVE ITEMS DEBUG ===');
        
        // グリッドレイアウト情報を取得
        const gridRect = grid.getBoundingClientRect();
        const gridStyle = window.getComputedStyle(grid);
        const gap = parseInt(gridStyle.gap || '16');
        const itemWidth = 112;
        const itemHeight = 112;
        const columns = Math.floor((gridRect.width + gap) / (itemWidth + gap));
        
        // プレースホルダーを含む全要素を取得（ドラッグ中の元要素は既に非表示）
        const allChildren = Array.from(grid.children).filter(child => 
            (child.classList.contains('shortcut-item') || child === this.placeholder) && 
            !child.dataset.isAddButton &&
            !child.classList.contains('grid-spacer') &&
            child.style.display !== 'none'
        );
        
        console.log('[MoveItems] Filtered children count:', allChildren.length);
        
        // プレースホルダーの位置を取得
        const placeholderIndex = allChildren.indexOf(this.placeholder);
        if (placeholderIndex === -1) {
            console.log('[MoveItems] Placeholder not found in filtered children!');
            return;
        }
        console.log('[MoveItems] Placeholder at index:', placeholderIndex);
        
        // アイテムをtransformではなく、実際の位置で管理する改善されたアプローチ
        // 各アイテムがプレースホルダーを考慮した正しい位置に移動するように計算
        
        // デバッグ情報
        console.log(`[MoveItems] Grid columns: ${columns}, Placeholder at: ${placeholderIndex}`);
        
        // すべてのアイテムの移動をリセット
        allChildren.forEach(item => {
            if (item !== this.placeholder) {
                item.style.transform = '';
            }
        });
        
        // 実際にアイテムを移動させる必要があるかチェック
        // プレースホルダーは既に正しい位置にあるので、他のアイテムは移動不要
        // transformをリセットするだけで十分
        console.log('[MoveItems] Reset all transforms - placeholder handles spacing');
        
        console.log('=== END MOVE ITEMS DEBUG ===');
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
        
        // プレースホルダーからドロップゾーンクラスを削除
        if (this.placeholder) {
            this.placeholder.classList.remove('drop-zone');
            this.placeholder.style.visibility = '';
            this.placeholder.style.opacity = '';
        }
        
        this.pendingInsertIndex = null;
    }

    cleanupAfterReorder() {
        console.log('[MouseDrag] cleanupAfterReorder called');
        
        // クローンを削除
        if (this.dragClone && this.dragClone.parentNode) {
            this.dragClone.parentNode.removeChild(this.dragClone);
            this.dragClone = null;
        }
        
        // ホバーエフェクトをクリア
        this.clearHoverEffects();
        
        // 挿入マーカーを削除
        this.hideInsertMarker();
        
        // プレースホルダーを削除
        if (this.placeholder && this.placeholder.parentNode) {
            this.placeholder.parentNode.removeChild(this.placeholder);
        }
        
        // 残っているプレースホルダーがあれば削除
        const allPlaceholders = document.querySelectorAll('.shortcut-placeholder');
        allPlaceholders.forEach(placeholder => {
            if (placeholder.parentNode) {
                placeholder.parentNode.removeChild(placeholder);
            }
        });
        
        // 状態をリセット
        this.draggedElement = null;
        this.draggedIndex = null;
        this.placeholder = null;
        this.dragClone = null;
        this.isDragging = false;
        this.currentDropMode = null;
        this.originalItemPositions.clear();
    }
    
    cleanup() {
        console.log('[MouseDrag] Cleanup called - draggedIndex:', this.draggedIndex);
        
        // クローンを削除
        if (this.dragClone && this.dragClone.parentNode) {
            this.dragClone.parentNode.removeChild(this.dragClone);
            this.dragClone = null;
        }
        
        if (this.draggedElement) {
            // 元の要素を再表示 - すべての隠しスタイルをリセット
            this.draggedElement.style.display = '';
            this.draggedElement.style.visibility = '';
            this.draggedElement.style.position = '';
            this.draggedElement.style.left = '';
            this.draggedElement.style.top = '';
            this.draggedElement.style.width = '';
            this.draggedElement.style.height = '';
            this.draggedElement.classList.remove('dragging-original');
            
            // プレースホルダーがあれば、元の要素と置き換える
            const grid = document.getElementById('shortcutsGrid');
            if (this.placeholder && this.placeholder.parentNode && grid) {
                // 元の要素をグリッドに戻す
                if (!grid.contains(this.draggedElement)) {
                    grid.insertBefore(this.draggedElement, this.placeholder);
                }
                this.placeholder.parentNode.removeChild(this.placeholder);
            } else if (grid && !grid.contains(this.draggedElement)) {
                // プレースホルダーがない場合は最後に追加
                const spacer = grid.querySelector('.grid-spacer');
                if (spacer) {
                    grid.insertBefore(this.draggedElement, spacer);
                } else {
                    grid.appendChild(this.draggedElement);
                }
            }
        }

        // ホバーエフェクトをクリア
        this.clearHoverEffects();
        
        // 挿入マーカーを削除
        this.hideInsertMarker();
        
        // プレースホルダーをnullにリセット（既に削除済みのはず）
        this.placeholder = null;
        
        // 残っているプレースホルダーがあれば削除
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

// フォルダーモーダル内専用のMouseDragManager
class FolderMouseDragManager extends MouseDragManager {
    constructor(shortcutManager, folderId) {
        super(shortcutManager);
        this.folderId = folderId;
        this.modalGrid = null;
    }
    
    setFolderId(folderId) {
        this.folderId = folderId;
    }
    
    init() {
        console.log('=== FolderMouseDragManager initialized for folder:', this.folderId);
        this.modalGrid = document.getElementById('folderModalGrid');
        
        // グローバルイベントは親クラスと共有
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
        if (!this.modalGrid) return;
        
        // フォルダー内の各ショートカットアイテムにイベントを設定
        const items = this.modalGrid.querySelectorAll('.shortcut-item');
        console.log(`[FolderMouseDragManager] Attaching listeners to ${items.length} folder items`);
        items.forEach((item) => {
            // 既存のイベントリスナーを削除（重複防止）
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
            
            // マウスダウンでドラッグ開始
            newItem.addEventListener('mousedown', (e) => this.handleMouseDown(e, newItem));
        });
    }
    
    handleMouseMove(e) {
        if (!this.draggedElement || !this.modalGrid) return;
        
        // フォルダー内でのドラッグのみ処理
        if (this.draggedElement.parentNode !== this.modalGrid && 
            (!this.placeholder || this.placeholder.parentNode !== this.modalGrid)) {
            return;
        }
        
        // 親クラスのhandleMouseMoveを呼び出す
        super.handleMouseMove(e);
        
        // モーダルの外にドラッグしているかチェック
        const modal = document.getElementById('folderModal');
        const modalContent = modal ? modal.querySelector('.folder-modal-content') : null;
        
        if (this.isDragging && modal && modalContent) {
            // モーダル背景（暗い部分）にドラッグしている場合
            const elementBelow = this.getElementBelow(e.clientX, e.clientY);
            if (!modalContent.contains(elementBelow) && modal.contains(elementBelow)) {
                modal.classList.add('modal-drag-out');
                this.currentDropMode = 'drag-out';
            } else {
                modal.classList.remove('modal-drag-out');
                // フォルダー内での並び替え処理
                if (this.currentDropMode === 'drag-out') {
                    this.currentDropMode = 'reorder';
                }
            }
        }
        
        // フォルダー内での並び替え処理
        if (this.isDragging && this.currentDropMode === 'reorder') {
            // フォルダー内のアイテムのみを対象にする
            const folderItems = Array.from(this.modalGrid.children).filter(child => 
                child.classList.contains('shortcut-item')
            );
            
            // プレースホルダーの位置を更新
            this.updatePlaceholderPositionInFolder(e, folderItems);
        }
    }
    
    updatePlaceholderPositionInFolder(e, folderItems) {
        // マウス位置に最も近いアイテムを見つける
        let closestItem = null;
        let closestDistance = Infinity;
        let insertBefore = true;
        
        folderItems.forEach(item => {
            if (item === this.draggedElement || item === this.placeholder) return;
            
            const rect = item.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const distance = Math.sqrt(
                Math.pow(e.clientX - centerX, 2) + 
                Math.pow(e.clientY - centerY, 2)
            );
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestItem = item;
                // マウスがアイテムの左半分にある場合は前に、右半分にある場合は後ろに挿入
                insertBefore = e.clientX < centerX;
            }
        });
        
        if (closestItem && this.placeholder) {
            if (insertBefore) {
                this.modalGrid.insertBefore(this.placeholder, closestItem);
            } else {
                this.modalGrid.insertBefore(this.placeholder, closestItem.nextSibling);
            }
        }
    }
    
    handleMouseUp(e) {
        if (!this.isDragging || !this.draggedElement) return;
        
        // モーダル外にドロップした場合
        const modal = document.getElementById('folderModal');
        const modalContent = modal ? modal.querySelector('.folder-modal-content') : null;
        
        if (this.currentDropMode === 'drag-out' && modal && modalContent) {
            const elementBelow = this.getElementBelow(e.clientX, e.clientY);
            if (!modalContent.contains(elementBelow) && modal.contains(elementBelow)) {
                // フォルダーから外に移動
                console.log('[FolderMouseDragManager] Moving item out of folder');
                this.shortcutManager.moveShortcutToFolder(this.draggedIndex, null).then(() => {
                    // モーダルを更新
                    const folderStillExists = this.shortcutManager.shortcuts.some(s => 
                        s.isFolder && s.folderId === this.folderId
                    );
                    if (folderStillExists && window.openFolderModal) {
                        const folderName = document.getElementById('folderModalTitle').textContent;
                        window.openFolderModal(this.folderId, folderName);
                    } else {
                        // フォルダーが削除された場合はモーダルを閉じる
                        modal.style.display = 'none';
                        document.body.style.overflow = '';
                    }
                });
                modal.classList.remove('modal-drag-out');
                this.cleanup();
                return;
            }
        }
        
        // フォルダー内でのドラッグ完了
        if (this.modalGrid && this.placeholder && this.placeholder.parentNode === this.modalGrid) {
            // 新しい順序を計算
            const folderItems = Array.from(this.modalGrid.children).filter(child => 
                child.classList.contains('shortcut-item') || child === this.placeholder
            );
            
            const newIndex = folderItems.indexOf(this.placeholder);
            if (newIndex !== -1) {
                // フォルダー内のアイテムの順序を更新
                this.reorderItemsInFolder(newIndex);
            }
        }
        
        // モーダルからクラスを削除
        if (modal) {
            modal.classList.remove('modal-drag-out');
        }
        
        this.cleanup();
    }
    
    reorderItemsInFolder(newVisualIndex) {
        console.log('[FolderMouseDragManager] Reordering in folder, new position:', newVisualIndex);
        
        // フォルダー内のアイテムを取得
        const folderItems = this.shortcutManager.shortcuts.filter(s => 
            s.folderId === this.folderId && !s.isFolder
        );
        
        // ドラッグされたアイテムの現在のインデックスを見つける
        const draggedItem = this.shortcutManager.shortcuts[this.draggedIndex];
        const currentFolderIndex = folderItems.indexOf(draggedItem);
        
        if (currentFolderIndex === -1 || currentFolderIndex === newVisualIndex) {
            console.log('[FolderMouseDragManager] No reorder needed');
            return;
        }
        
        // フォルダー内のアイテムを並び替え
        folderItems.splice(currentFolderIndex, 1);
        folderItems.splice(newVisualIndex, 0, draggedItem);
        
        // メインのshortcuts配列を更新
        // まず、フォルダー内のすべてのアイテムを削除
        const remainingShortcuts = this.shortcutManager.shortcuts.filter(s => 
            !(s.folderId === this.folderId && !s.isFolder)
        );
        
        // フォルダーアイテムを新しい順序で追加
        this.shortcutManager.shortcuts = [...remainingShortcuts, ...folderItems];
        
        // 保存して再描画
        this.shortcutManager.save().then(() => {
            // フォルダーモーダルを更新
            const folderShortcut = this.shortcutManager.shortcuts.find(s => 
                s.isFolder && s.folderId === this.folderId
            );
            if (folderShortcut && window.openFolderModal) {
                window.openFolderModal(this.folderId, folderShortcut.name);
            }
        });
    }
    
    cleanup() {
        // 親クラスのcleanupを呼び出す前に、モーダル固有の処理
        if (this.draggedElement && this.modalGrid) {
            // モーダル内の要素の場合、modalGridに戻す
            if (this.placeholder && this.placeholder.parentNode === this.modalGrid) {
                this.modalGrid.insertBefore(this.draggedElement, this.placeholder);
            }
        }
        
        super.cleanup();
    }
    
    // オーバーライド: モーダル内のアイテムを取得
    getElementBelow(x, y) {
        if (!this.dragClone) return null;
        
        // 一時的にドラッグ中のクローンを非表示
        this.dragClone.style.pointerEvents = 'none';
        const elementBelow = document.elementFromPoint(x, y);
        this.dragClone.style.pointerEvents = '';
        
        // モーダル外へのドラッグを許可するため、elementBelowを返す
        // フォルダーモーダル内の要素の場合は最も近いショートカットアイテムを返す
        if (elementBelow && this.modalGrid && this.modalGrid.contains(elementBelow)) {
            return elementBelow.closest('.shortcut-item') || elementBelow;
        }
        
        return elementBelow;
    }
}

// グローバルに公開
window.FolderMouseDragManager = FolderMouseDragManager;