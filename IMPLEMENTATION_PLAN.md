# SortableJS Implementation Plan

## Overview
Replace the current custom drag-and-drop implementation with SortableJS library to achieve better stability and user experience.

## Goals
1. Implement smooth grid-based drag and drop
2. Clear visual feedback for drop zones
3. Proper folder creation when dropping on icons
4. Multiple selection support
5. Better animation and transitions

## Implementation Steps

### Phase 1: Setup (Day 1)
- [ ] Add SortableJS library to the project
- [ ] Create a backup of current mouse-drag.js
- [ ] Initialize basic SortableJS on the shortcuts grid
- [ ] Test basic drag and drop functionality

### Phase 2: Core Features (Day 2-3)
- [ ] Implement grid layout with proper spacing
- [ ] Add drop zone indicators (blue borders)
- [ ] Implement reordering with smooth animations
- [ ] Integrate with existing data structure (shortcuts array)

### Phase 3: Advanced Features (Day 4-5)
- [ ] Implement folder creation logic
  - Detect when dropping on icon vs between icons
  - Show visual feedback (highlight) when hovering over icon
- [ ] Add multiple selection support using MultiDrag plugin
- [ ] Implement folder drag-in/out functionality

### Phase 4: Polish and Testing (Day 6-7)
- [ ] Fine-tune animations and transitions
- [ ] Test edge cases (right-edge wrapping, etc.)
- [ ] Ensure compatibility with existing features
- [ ] Performance optimization

## Technical Details

### SortableJS Configuration
```javascript
Sortable.create(grid, {
    animation: 300,
    ghostClass: 'sortable-ghost',
    dragClass: 'sortable-drag',
    handle: '.shortcut-item',
    multiDrag: true,
    selectedClass: 'selected',
    fallbackTolerance: 3,
    
    // Custom logic for folder creation
    onMove: function(evt) {
        // Determine if dropping on icon (folder creation) or between (reorder)
    },
    
    onEnd: function(evt) {
        // Update data structure
        // Handle folder creation if needed
    }
});
```

### Key Differences from Current Implementation
1. **Event-driven vs Manual Position Calculation**
   - Current: Manually calculate positions and transforms
   - SortableJS: Library handles positioning automatically

2. **Drop Detection**
   - Current: Complex hit-testing logic
   - SortableJS: Built-in event handlers with clear targets

3. **Animation**
   - Current: Manual CSS transforms
   - SortableJS: Smooth built-in animations

## Success Criteria
- [ ] Drag and drop is smooth and responsive
- [ ] Clear visual feedback for all operations
- [ ] Folder creation works intuitively (drop on icon)
- [ ] Reordering works intuitively (drop between icons)
- [ ] No unexpected behaviors or bugs
- [ ] Performance is good even with many shortcuts

## Risks and Mitigations
1. **Risk**: Breaking existing functionality
   - **Mitigation**: Implement features incrementally, test thoroughly

2. **Risk**: Library limitations for custom requirements
   - **Mitigation**: Use SortableJS events and callbacks for customization

3. **Risk**: Performance with many items
   - **Mitigation**: Use virtual scrolling if needed