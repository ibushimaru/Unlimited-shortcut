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

        this.isDragging = true;
        this.draggedElement = item;
        this.draggedIndex = parseInt(item.dataset.index);
        
        // マウス位置を記録
        this.startX = e.clientX;
        this.startY = e.clientY;
        
        // 要素の位置を記録
        const rect = item.getBoundingClientRect();
        this.offsetX = e.clientX - rect.left;
        this.offsetY = e.clientY - rect.top;

        // プレースホルダーを作成
        this.createPlaceholder();
        
        // ドラッグ中のスタイルを適用
        item.style.position = 'fixed';
        item.style.zIndex = '9999';
        item.style.opacity = '0.8';
        item.style.cursor = 'grabbing';
        item.style.left = `${e.clientX - this.offsetX}px`;
        item.style.top = `${e.clientY - this.offsetY}px`;
        
        e.preventDefault();
        console.log('Mouse drag started:', this.draggedIndex);
    }

    handleMouseMove(e) {
        if (!this.isDragging || !this.draggedElement) return;

        // ドラッグ中の要素を移動
        this.draggedElement.style.left = `${e.clientX - this.offsetX}px`;
        this.draggedElement.style.top = `${e.clientY - this.offsetY}px`;

        // ホバー中の要素を検出
        const elementBelow = this.getElementBelow(e.clientX, e.clientY);
        if (elementBelow && elementBelow.classList.contains('shortcut-item')) {
            const targetIndex = parseInt(elementBelow.dataset.index);
            
            if (targetIndex !== this.draggedIndex) {
                // ホバーエフェクトを追加
                this.clearHoverEffects();
                elementBelow.classList.add('drag-over');
            }
        } else {
            this.clearHoverEffects();
        }
    }

    handleMouseUp(e) {
        if (!this.isDragging || !this.draggedElement) return;

        console.log('Mouse drag ended');

        // ドロップ先を検出
        const elementBelow = this.getElementBelow(e.clientX, e.clientY);
        
        if (elementBelow && elementBelow.classList.contains('shortcut-item')) {
            const targetIndex = parseInt(elementBelow.dataset.index);
            
            if (targetIndex !== this.draggedIndex) {
                console.log('=== MOUSE DROP DETECTED ===');
                console.log('From:', this.draggedIndex, 'To:', targetIndex);
                
                // ドロップ位置に基づいて処理を決定
                const rect = elementBelow.getBoundingClientRect();
                const dropX = e.clientX - rect.left;
                const dropXPercent = dropX / rect.width;
                
                const draggedShortcut = this.shortcutManager.shortcuts[this.draggedIndex];
                const targetShortcut = this.shortcutManager.shortcuts[targetIndex];
                
                if (draggedShortcut && targetShortcut) {
                    // ドロップ位置が左端または右端の場合は並び替え
                    if (dropXPercent < 0.2 || dropXPercent > 0.8) {
                        console.log('Reordering items');
                        const newIndex = dropXPercent < 0.5 ? targetIndex : targetIndex + 1;
                        this.shortcutManager.reorder(this.draggedIndex, newIndex);
                    }
                    // 両方がショートカットの場合はフォルダー作成
                    else if (!draggedShortcut.isFolder && !targetShortcut.isFolder) {
                        console.log('Creating folder from shortcuts');
                        this.shortcutManager.createFolderFromShortcuts(this.draggedIndex, targetIndex);
                    }
                    // フォルダーにショートカットを追加
                    else if (targetShortcut.isFolder && !draggedShortcut.isFolder) {
                        console.log('Adding shortcut to folder');
                        this.shortcutManager.addShortcutToFolder(this.draggedIndex, targetShortcut.folderId);
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
        const elementBelow = document.elementFromPoint(x, y);
        this.draggedElement.style.display = '';
        return elementBelow;
    }

    createPlaceholder() {
        if (this.placeholder) return;
        
        this.placeholder = document.createElement('div');
        this.placeholder.className = 'shortcut-placeholder';
        this.placeholder.style.width = this.draggedElement.offsetWidth + 'px';
        this.placeholder.style.height = this.draggedElement.offsetHeight + 'px';
        
        this.draggedElement.parentNode.insertBefore(this.placeholder, this.draggedElement);
    }

    clearHoverEffects() {
        document.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
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
        }

        // プレースホルダーを削除
        if (this.placeholder && this.placeholder.parentNode) {
            this.placeholder.parentNode.removeChild(this.placeholder);
        }

        // ホバーエフェクトをクリア
        this.clearHoverEffects();

        // 状態をリセット
        this.draggedElement = null;
        this.draggedIndex = null;
        this.placeholder = null;
        this.isDragging = false;
    }
}

// グローバルに公開
window.MouseDragManager = MouseDragManager;