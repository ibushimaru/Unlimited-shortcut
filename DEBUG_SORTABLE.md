# SortableJS デバッグ手順

## 問題
アイコンがドラッグできない

## デバッグ手順

1. **Chrome DevToolsのコンソールで以下を確認：**

```javascript
// SortableJSが読み込まれているか確認
console.log('Sortable loaded:', typeof Sortable);

// ドラッグマネージャーが初期化されているか確認
console.log('Drag manager:', window.dragManager);

// Sortableインスタンスを確認
console.log('Sortable instance:', window.debugSortable);

// グリッドの要素を確認
console.log('Grid:', document.getElementById('shortcutsGrid'));

// ショートカットアイテムを確認
console.log('Items:', document.querySelectorAll('.shortcut-item'));
```

2. **手動でSortableを初期化してテスト：**

```javascript
// 手動で最小限のSortableを作成
const grid = document.getElementById('shortcutsGrid');
const testSortable = Sortable.create(grid, {
    animation: 150,
    draggable: '.shortcut-item'
});
console.log('Test sortable:', testSortable);
```

3. **要素のドラッグ可能性を確認：**

```javascript
// 各アイテムのドラッグ属性を確認
document.querySelectorAll('.shortcut-item').forEach((item, i) => {
    console.log(`Item ${i}:`, {
        draggable: item.draggable,
        classList: item.classList.toString(),
        style: item.style.cssText
    });
});
```

## 可能な原因

1. **SortableJSが正しく読み込まれていない**
   - CDNの問題
   - スクリプトの順序

2. **CSS/スタイルの競合**
   - pointer-events
   - user-select
   - position

3. **既存のイベントハンドラーとの競合**
   - 範囲選択機能
   - クリックイベント

4. **要素の構造問題**
   - ドラッグハンドル
   - 子要素のドラッグ設定