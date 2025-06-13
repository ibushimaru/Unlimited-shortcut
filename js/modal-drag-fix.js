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
            
            // モーダルコンテンツの外側の場合（モーダル背景のみ）
            if (e.target === modal || (!modalContent.contains(e.target) && modal.contains(e.target))) {
                modal.classList.add('modal-drag-out');
            } else {
                modal.classList.remove('modal-drag-out');
            }
        }
    });
    
    modal.addEventListener('drop', function(e) {
        if (modalDragState.isDragging && 
            (e.target === modal || (!modalContent.contains(e.target) && modal.contains(e.target)))) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('[modal-drag-fix] Drop detected outside modal content');
            console.log('[modal-drag-fix] Skipping duplicate moveShortcutToFolder call');
            
            // newtab.jsがすでに処理しているため、ここでは何もしない
            // 重複実行を防ぐ
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