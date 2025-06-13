# カーソル表示問題の解決記録

## 概要
Chrome拡張機能「Unlimited-Shortcuts」において、検索バーやフォルダーモーダルで不要なカーソル（縦線）が表示される問題の解決過程をまとめた文書。

## 問題の詳細

### 1. ショートカット検索バーのカーソル問題
- **症状**: 検索バーがフォーカスされていないのに右端にカーソルが表示される
- **繰り返された指摘**: 
  - 「まだ残り続けています」
  - 「うーんまだ残ってる」
  - 「相変わらずショートカット検索バーの右端に点滅する縦線が残り続ける」

### 2. フォルダーモーダルのカーソル問題
- **症状**: フォルダーを開いた時にバツ印の横にカーソルが表示される
- **誤解した点**: 最初はフォルダータイトル部分だと勘違いしていた
- **正確な問題箇所**: 右上のバツ印（×）の横

## 失敗したアプローチ（複雑すぎた解決策）

### 1. search-focusedクラスによる制御
```css
/* 複雑すぎた実装 */
body:not(.search-focused) [contenteditable] {
    caret-color: transparent !important;
}
body:not(.search-focused) input.shortcut-search {
    caret-color: transparent !important;
}
```

### 2. JavaScriptによる複雑なフォーカス管理
```javascript
// 不要に複雑だった処理
elements.shortcutSearch.addEventListener('blur', () => {
    setTimeout(() => {
        if (document.activeElement !== elements.searchInput) {
            document.body.classList.remove('search-focused');
        }
    }, 10);
});
```

### 3. 問題箇所の特定ミス
- フォルダータイトルに対して修正を行っていた
- 実際の問題はバツ印の横だった

## 最終的な解決策（シンプルなアプローチ）

### 1. CSSのみでの制御
```css
/* ショートカット検索バーのカーソル制御 */
.shortcut-search {
    caret-color: transparent !important;
}

.shortcut-search:focus {
    caret-color: auto !important;
}

/* フォルダーヘッダーのカーソル制御 */
.folder-modal-header {
    caret-color: transparent !important;
}

.folder-modal-header * {
    caret-color: transparent !important;
}

/* タイトルがフォーカスされた時のみカーソル表示 */
.folder-title-editable[contenteditable="true"]:focus {
    caret-color: auto !important;
}
```

### 2. HTMLからの不要な属性削除
```html
<!-- Before -->
<h2 id="folderModalTitle" class="folder-title-editable" contenteditable="false">

<!-- After -->
<h2 id="folderModalTitle" class="folder-title-editable">
```

### 3. JavaScriptの簡素化
- 複雑なsearch-focusedクラスの管理を削除
- シンプルなblur()呼び出しのみに

## 学んだ教訓

### 1. 問題の正確な特定が最重要
- ユーザーの説明を正確に理解する
- スクリーンショットの詳細を注意深く確認
- 「タイトルじゃなくて、右上の✕印の横だよ」という指摘を見逃さない

### 2. シンプルな解決策を最初に試す
- `caret-color: transparent`という単純なCSSプロパティで解決可能だった
- 複雑なクラス管理やJavaScriptは不要だった

### 3. 過度な最適化を避ける
- search-focusedクラスによる制御は過剰だった
- :focus擬似クラスで十分な制御が可能

### 4. ユーザーフィードバックの重要性
- 「最初からそうしろよな」という率直なフィードバックが改善につながる
- 繰り返しの指摘は、根本的なアプローチの見直しが必要なサイン

## 今後の開発指針

1. **問題箇所の正確な特定を最優先にする**
2. **最もシンプルな解決策から試す**
3. **CSSで解決できることはCSSで解決する**
4. **JavaScriptは本当に必要な場合のみ使用**
5. **ユーザーの指摘を正確に理解してから実装に入る**

## 関連ファイル
- `/css/styles.css` - カーソル制御のCSSルール
- `/js/newtab.js` - フォーカス管理の簡素化
- `/newtab.html` - contenteditable属性の削除