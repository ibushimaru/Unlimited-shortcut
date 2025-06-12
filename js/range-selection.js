// 範囲選択機能の実装
class RangeSelectionManager {
    constructor(shortcutManager) {
        this.shortcutManager = shortcutManager;
        this.isSelecting = false;
        this.startX = 0;
        this.startY = 0;
        this.currentX = 0;
        this.currentY = 0;
        this.selectionBox = null;
        this.selectedItems = new Set();
        this.dragStartedOnBackground = false;
    }

    init() {
        console.log('=== RangeSelectionManager initialized ===');
        this.attachEventListeners();
        this.createSelectionBox();
    }

    createSelectionBox() {
        this.selectionBox = document.createElement('div');
        this.selectionBox.className = 'selection-box';
        this.selectionBox.style.display = 'none';
        document.body.appendChild(this.selectionBox);
    }

    attachEventListeners() {
        const grid = document.getElementById('shortcutsGrid');
        if (!grid) return;

        // グリッドの背景でのマウスダウン
        grid.addEventListener('mousedown', (e) => this.handleMouseDown(e), true);
        
        // ドキュメント全体でのマウス移動とマウスアップ
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        
        // キーボードイベント
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    handleMouseDown(e) {
        // 左クリックのみ処理
        if (e.button !== 0) return;

        const grid = document.getElementById('shortcutsGrid');
        const clickedElement = e.target;
        
        // クリックした要素がグリッド背景か判定
        const isBackground = clickedElement === grid || 
                           clickedElement.classList.contains('shortcuts-container') ||
                           (!clickedElement.classList.contains('shortcut-item') && 
                            !clickedElement.closest('.shortcut-item'));

        if (isBackground) {
            // 背景からドラッグ開始 = 範囲選択モード
            this.dragStartedOnBackground = true;
            this.startRangeSelection(e);
            
            // 他のドラッグ機能を一時的に無効化
            if (window.mouseDragManager) {
                window.mouseDragManager.isDisabled = true;
            }
            
            e.preventDefault();
            e.stopPropagation();
        } else {
            // アイコン上からドラッグ開始 = 通常のドラッグモード
            this.dragStartedOnBackground = false;
        }
    }

    startRangeSelection(e) {
        this.isSelecting = true;
        const rect = document.getElementById('shortcutsGrid').getBoundingClientRect();
        this.startX = e.clientX - rect.left;
        this.startY = e.clientY - rect.top;
        this.currentX = this.startX;
        this.currentY = this.startY;
        
        // 既存の選択をクリア（Ctrlキーが押されていない場合）
        if (!e.ctrlKey && !e.metaKey) {
            this.clearSelection();
        }
        
        // 選択ボックスを表示
        this.updateSelectionBox();
        this.selectionBox.style.display = 'block';
        
        console.log('Range selection started');
    }

    handleMouseMove(e) {
        if (!this.isSelecting) return;

        const rect = document.getElementById('shortcutsGrid').getBoundingClientRect();
        this.currentX = e.clientX - rect.left;
        this.currentY = e.clientY - rect.top;
        
        // 選択ボックスを更新
        this.updateSelectionBox();
        
        // 選択範囲内のアイテムをハイライト
        this.updateSelectedItems();
        
        e.preventDefault();
    }

    handleMouseUp(e) {
        if (!this.isSelecting) return;

        this.isSelecting = false;
        this.selectionBox.style.display = 'none';
        
        // ドラッグ機能を再有効化
        if (window.mouseDragManager) {
            window.mouseDragManager.isDisabled = false;
        }
        
        console.log('Range selection ended, selected items:', this.selectedItems.size);
        
        // 選択されたアイテムに対する処理をここに追加
        if (this.selectedItems.size > 0) {
            this.onItemsSelected(Array.from(this.selectedItems));
        }
    }

    updateSelectionBox() {
        const x = Math.min(this.startX, this.currentX);
        const y = Math.min(this.startY, this.currentY);
        const width = Math.abs(this.currentX - this.startX);
        const height = Math.abs(this.currentY - this.startY);
        
        const grid = document.getElementById('shortcutsGrid');
        const gridRect = grid.getBoundingClientRect();
        
        this.selectionBox.style.left = `${gridRect.left + x}px`;
        this.selectionBox.style.top = `${gridRect.top + y}px`;
        this.selectionBox.style.width = `${width}px`;
        this.selectionBox.style.height = `${height}px`;
    }

    updateSelectedItems() {
        const grid = document.getElementById('shortcutsGrid');
        const items = grid.querySelectorAll('.shortcut-item');
        const selectionRect = this.getSelectionRect();
        
        items.forEach((item, index) => {
            const itemRect = item.getBoundingClientRect();
            const gridRect = grid.getBoundingClientRect();
            
            // アイテムの相対位置を計算
            const itemRelativeRect = {
                left: itemRect.left - gridRect.left,
                top: itemRect.top - gridRect.top,
                right: itemRect.right - gridRect.left,
                bottom: itemRect.bottom - gridRect.top
            };
            
            // 選択範囲との交差判定
            const isIntersecting = this.isRectIntersecting(selectionRect, itemRelativeRect);
            
            if (isIntersecting) {
                item.classList.add('range-selected');
                this.selectedItems.add(index);
            } else {
                // Ctrlキーが押されていない場合のみ選択解除
                if (!this.isSelecting || (!event.ctrlKey && !event.metaKey)) {
                    item.classList.remove('range-selected');
                    this.selectedItems.delete(index);
                }
            }
        });
    }

    getSelectionRect() {
        return {
            left: Math.min(this.startX, this.currentX),
            top: Math.min(this.startY, this.currentY),
            right: Math.max(this.startX, this.currentX),
            bottom: Math.max(this.startY, this.currentY)
        };
    }

    isRectIntersecting(rect1, rect2) {
        return !(rect1.right < rect2.left || 
                rect1.left > rect2.right || 
                rect1.bottom < rect2.top || 
                rect1.top > rect2.bottom);
    }

    clearSelection() {
        const grid = document.getElementById('shortcutsGrid');
        const items = grid.querySelectorAll('.shortcut-item');
        items.forEach(item => {
            item.classList.remove('range-selected');
        });
        this.selectedItems.clear();
    }

    handleKeyDown(e) {
        // Escapeキーで選択解除
        if (e.key === 'Escape') {
            this.clearSelection();
        }
        // Ctrl+A または Cmd+A で全選択
        else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            e.preventDefault();
            this.selectAll();
        }
    }

    selectAll() {
        const grid = document.getElementById('shortcutsGrid');
        const items = grid.querySelectorAll('.shortcut-item');
        items.forEach((item, index) => {
            item.classList.add('range-selected');
            this.selectedItems.add(index);
        });
    }

    onItemsSelected(indices) {
        // 選択されたアイテムに対する処理
        console.log('Selected items:', indices);
        
        // 複数選択時のドラッグ処理などをここに実装
        // 例: グループ移動、一括削除など
    }

    // 範囲選択モードかどうかを返す
    isInRangeSelectionMode() {
        return this.isSelecting || this.dragStartedOnBackground;
    }
}

// グローバルに公開
window.RangeSelectionManager = RangeSelectionManager;