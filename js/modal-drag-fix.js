// モーダルドラッグの修正版
// このファイルはnewtab.htmlの最後に読み込む

(function() {
    // モーダルからのドラッグをグローバルに管理
    let modalDragState = {
        isDragging: false,
        draggedIndex: null,
        currentFolderId: null
    };
    
    // モーダル要素を取得
    const modal = document.getElementById('folderModal');
    const modalContent = document.querySelector('.folder-modal-content');
    
    if (!modal || !modalContent) {
        console.error('Modal elements not found');
        return;
    }
    
    // モーダル全体でドロップを受け付ける
    modal.addEventListener('dragover', function(e) {
        if (modalDragState.isDragging) {
            e.preventDefault();
            
            // モーダルコンテンツの外側の場合
            if (!modalContent.contains(e.target)) {
                modal.classList.add('modal-drag-out');
            } else {
                modal.classList.remove('modal-drag-out');
            }
        }
    });
    
    modal.addEventListener('drop', function(e) {
        if (modalDragState.isDragging && !modalContent.contains(e.target)) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('Drop detected outside modal content');
            
            // フォルダーから外に移動
            if (window.shortcutManager && 
                typeof modalDragState.draggedIndex === 'number' && 
                !isNaN(modalDragState.draggedIndex) &&
                modalDragState.draggedIndex >= 0) {
                window.shortcutManager.moveShortcutToFolder(modalDragState.draggedIndex, null);
                
                // モーダルを閉じる
                setTimeout(() => {
                    if (window.closeFolderModal) {
                        window.closeFolderModal();
                    }
                }, 100);
            }
        }
        
        modal.classList.remove('modal-drag-out');
        modalDragState.isDragging = false;
        modalDragState.draggedIndex = null;
    });
    
    // グローバルなdragstartイベントを監視
    document.addEventListener('dragstart', function(e) {
        const modalGrid = document.getElementById('folderModalGrid');
        const shortcutItem = e.target.closest('.shortcut-item');
        
        if (modalGrid && modalGrid.contains(e.target) && shortcutItem) {
            const index = parseInt(shortcutItem.dataset.index);
            if (!isNaN(index)) {
                modalDragState.isDragging = true;
                modalDragState.draggedIndex = index;
                modalDragState.currentFolderId = modal.dataset.folderId;
                console.log('Modal drag start detected, index:', index);
            }
        }
    });
    
    // グローバルなdragendイベントを監視
    document.addEventListener('dragend', function(e) {
        if (modalDragState.isDragging) {
            console.log('Modal drag end');
            modal.classList.remove('modal-drag-out');
            modalDragState.isDragging = false;
            modalDragState.draggedIndex = null;
        }
    });
    
    console.log('Modal drag fix loaded');
})();