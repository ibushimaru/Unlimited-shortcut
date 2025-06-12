// SortableJS-based drag and drop implementation
class SortableDragManager {
    constructor(shortcutManager) {
        this.shortcutManager = shortcutManager;
        this.sortable = null;
        this.isOverFolder = false;
        this.targetFolderElement = null;
        this.dropMode = null; // 'reorder' or 'folder'
        this.isDragging = false;
    }

    init() {
        console.log('=== SortableDragManager initialized ===');
        this.setupSortable();
    }

    setupSortable() {
        const grid = document.getElementById('shortcutsGrid');
        if (!grid) {
            console.error('Grid element not found!');
            return;
        }
        
        console.log('Setting up Sortable on grid:', grid);
        console.log('Grid children:', grid.children.length);

        try {
            // より詳細な設定でSortableを初期化
            const options = {
                animation: 300,
                easing: "cubic-bezier(0.4, 0.0, 0.2, 1)",
                
                // Classes
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                
                // Allow dragging only shortcut items (not the add button)
                draggable: '.shortcut-item:not([data-is-add-button="true"])',
                
                // Events
                onStart: (evt) => this.handleDragStart(evt),
                onMove: (evt) => this.handleDragMove(evt),
                onEnd: (evt) => this.handleDragEnd(evt),
                
                // Custom filter to prevent dragging certain elements
                filter: '.kebab-menu',
                preventOnFilter: true,
                
                // Swap animation
                swap: false,
                swapThreshold: 0.65
            };
            
            this.sortable = Sortable.create(grid, options);
            
            console.log('Sortable instance created:', this.sortable);
            
            // デバッグ用にグローバルに公開
            window.debugSortable = this.sortable;
        } catch (error) {
            console.error('Error creating Sortable:', error);
        }
    }

    handleDragStart(evt) {
        const draggedElement = evt.item;
        const draggedIndex = parseInt(draggedElement.dataset.index);
        
        console.log('Drag started:', draggedIndex);
        
        // Validate the index
        if (isNaN(draggedIndex) || draggedIndex < 0 || draggedIndex >= this.shortcutManager.shortcuts.length) {
            console.error('Invalid drag index:', draggedIndex);
            evt.preventDefault();
            return;
        }
        
        // Add dragging class for styling
        draggedElement.classList.add('dragging');
        
        // Store original index
        this.originalIndex = evt.oldIndex;
        this.draggedIndex = draggedIndex;
        this.isDragging = true;
    }

    handleDragMove(evt) {
        // Skip if not actively dragging
        if (!this.isDragging) {
            return true;
        }
        
        const draggedElement = evt.dragged;
        const targetElement = evt.related;
        
        if (!targetElement || targetElement.dataset.isAddButton === 'true') {
            return true; // Allow sort
        }
        
        // Get dragged index from element if not set yet
        let draggedIndex = this.draggedIndex;
        if (draggedIndex === null || draggedIndex === undefined) {
            // Fallback: get index from dragged element
            draggedIndex = parseInt(draggedElement.dataset.index);
            if (!isNaN(draggedIndex)) {
                this.draggedIndex = draggedIndex;
                console.log('Set draggedIndex from element:', draggedIndex);
            } else {
                console.warn('Could not determine dragged index');
                return true;
            }
        }
        
        // Get mouse position relative to target
        const rect = targetElement.getBoundingClientRect();
        const x = evt.originalEvent.clientX - rect.left;
        const y = evt.originalEvent.clientY - rect.top;
        const xPercent = x / rect.width;
        const yPercent = y / rect.height;
        
        // Determine if we're over the center of the icon (folder mode)
        const isOverCenter = xPercent > 0.25 && xPercent < 0.75 && 
                           yPercent > 0.25 && yPercent < 0.75;
        
        // Get target shortcut info
        const targetIndex = parseInt(targetElement.dataset.index);
        const targetShortcut = this.shortcutManager.shortcuts[targetIndex];
        const draggedShortcut = this.shortcutManager.shortcuts[draggedIndex];
        
        // Validate shortcuts exist
        if (!targetShortcut || !draggedShortcut) {
            console.warn('Invalid shortcut indices', { targetIndex, draggedIndex });
            return true;
        }
        
        // Clear previous states
        this.clearHoverEffects();
        
        if (isOverCenter && !draggedShortcut.isFolder) {
            // Folder creation/addition mode
            if (targetShortcut.isFolder) {
                // Adding to existing folder
                this.dropMode = 'add-to-folder';
                targetElement.classList.add('folder-hover');
                this.targetFolderElement = targetElement;
                return false; // Prevent reordering
            } else if (!targetShortcut.isFolder) {
                // Creating new folder
                this.dropMode = 'create-folder';
                targetElement.classList.add('folder-hover');
                this.targetFolderElement = targetElement;
                return false; // Prevent reordering
            }
        } else {
            // Reorder mode
            this.dropMode = 'reorder';
            this.targetFolderElement = null;
            
            // Show drop indicator
            this.showDropIndicator(evt);
            
            return true; // Allow sort
        }
    }

    handleDragEnd(evt) {
        const draggedElement = evt.item;
        draggedElement.classList.remove('dragging');
        
        console.log('Drag ended, mode:', this.dropMode);
        
        // Clear hover effects
        this.clearHoverEffects();
        this.hideDropIndicator();
        
        if (this.dropMode === 'reorder') {
            // Handle reordering
            const newIndex = evt.newIndex;
            const oldIndex = evt.oldIndex;
            
            if (newIndex !== oldIndex) {
                // Calculate actual indices considering visible items only
                const visibleIndices = this.getVisibleItemIndices();
                const actualOldIndex = visibleIndices[oldIndex];
                const actualNewIndex = visibleIndices[newIndex];
                
                console.log('Reordering from', actualOldIndex, 'to', actualNewIndex);
                this.shortcutManager.reorder(actualOldIndex, actualNewIndex);
            }
        } else if (this.dropMode === 'create-folder' && this.targetFolderElement) {
            // Cancel the sort and create folder
            this.sortable.option('sort', false);
            evt.preventDefault();
            
            const targetIndex = parseInt(this.targetFolderElement.dataset.index);
            console.log('Creating folder from', this.draggedIndex, 'and', targetIndex);
            
            // Restore original position
            const grid = document.getElementById('shortcutsGrid');
            const items = Array.from(grid.children).filter(child => 
                child.classList.contains('shortcut-item') && !child.dataset.isAddButton
            );
            
            if (this.originalIndex < items.length) {
                grid.insertBefore(draggedElement, items[this.originalIndex]);
            } else {
                const addButton = grid.querySelector('[data-is-add-button="true"]');
                if (addButton) {
                    grid.insertBefore(draggedElement, addButton);
                } else {
                    grid.appendChild(draggedElement);
                }
            }
            
            // Create folder
            this.shortcutManager.createFolderFromShortcuts(this.draggedIndex, targetIndex);
            
            // Re-enable sorting
            setTimeout(() => {
                this.sortable.option('sort', true);
            }, 100);
        } else if (this.dropMode === 'add-to-folder' && this.targetFolderElement) {
            // Cancel the sort and add to folder
            this.sortable.option('sort', false);
            evt.preventDefault();
            
            const targetIndex = parseInt(this.targetFolderElement.dataset.index);
            const targetShortcut = this.shortcutManager.shortcuts[targetIndex];
            
            console.log('Adding to folder:', targetShortcut.folderId);
            
            // Restore original position
            const grid = document.getElementById('shortcutsGrid');
            const items = Array.from(grid.children).filter(child => 
                child.classList.contains('shortcut-item') && !child.dataset.isAddButton
            );
            
            if (this.originalIndex < items.length) {
                grid.insertBefore(draggedElement, items[this.originalIndex]);
            } else {
                const addButton = grid.querySelector('[data-is-add-button="true"]');
                if (addButton) {
                    grid.insertBefore(draggedElement, addButton);
                } else {
                    grid.appendChild(draggedElement);
                }
            }
            
            // Add to folder
            this.shortcutManager.addShortcutToFolder(this.draggedIndex, targetShortcut.folderId);
            
            // Re-enable sorting
            setTimeout(() => {
                this.sortable.option('sort', true);
            }, 100);
        }
        
        // Reset state
        this.dropMode = null;
        this.targetFolderElement = null;
        this.draggedIndex = null;
        this.originalIndex = null;
        this.isDragging = false;
    }

    clearHoverEffects() {
        document.querySelectorAll('.folder-hover').forEach(el => {
            el.classList.remove('folder-hover');
        });
        document.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
    }

    showDropIndicator(evt) {
        // Create or get drop indicator
        let indicator = document.getElementById('drop-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'drop-indicator';
            indicator.className = 'drop-indicator';
            document.body.appendChild(indicator);
        }
        
        // Position indicator based on sort direction
        const targetRect = evt.related.getBoundingClientRect();
        const willInsertAfter = evt.willInsertAfter;
        
        indicator.style.position = 'fixed';
        indicator.style.width = '2px';
        indicator.style.height = targetRect.height + 'px';
        indicator.style.backgroundColor = '#1a73e8';
        indicator.style.top = targetRect.top + 'px';
        indicator.style.display = 'block';
        indicator.style.zIndex = '9999';
        
        if (willInsertAfter) {
            indicator.style.left = (targetRect.right + 8) + 'px';
        } else {
            indicator.style.left = (targetRect.left - 8) + 'px';
        }
    }
    
    hideDropIndicator() {
        const indicator = document.getElementById('drop-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    getVisibleItemIndices() {
        // Get mapping of visible positions to actual data indices
        const indices = [];
        const shortcuts = this.shortcutManager.shortcuts;
        
        for (let i = 0; i < shortcuts.length; i++) {
            const shortcut = shortcuts[i];
            // Only include visible items (not inside folders)
            if (!shortcut.folderId || shortcut.isFolder) {
                indices.push(i);
            }
        }
        
        return indices;
    }

    cleanup() {
        if (this.sortable) {
            this.sortable.destroy();
            this.sortable = null;
        }
    }
}

// Make it available globally
window.SortableDragManager = SortableDragManager;