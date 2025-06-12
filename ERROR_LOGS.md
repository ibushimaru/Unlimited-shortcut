# エラーログシステム

このChrome拡張機能には、エラーを自動的に記録するシステムが組み込まれています。

## 使い方

### コンソールでのコマンド

```javascript
// 最新のエラーログを表示
showErrorLogs()

// エラーログをクリップボードにコピー（Markdown形式）
copyErrorLogs()

// エラーログをダウンロード
downloadErrorLogs()

// エラーログをクリア
clearErrorLogs()
```

### エラーログビューアー

`error-logs.html`を開くと、視覚的なエラーログビューアーが表示されます。

### 記録されるエラーの種類

1. **window-error** - JavaScriptランタイムエラー
2. **console-error** - console.error()の呼び出し
3. **console-warn** - console.warn()の呼び出し
4. **unhandled-rejection** - 未処理のPromise拒否

### デバッグモード

URLに`?debug=true`を追加すると、エラーが発生した際にコンソールに即座に出力されます。

## 開発者向け

エラーが発生した場合：

1. Chrome DevToolsのコンソールで `copyErrorLogs()` を実行
2. クリップボードにコピーされたMarkdown形式のログを共有
3. または `downloadErrorLogs()` でファイルとしてダウンロード

## ログの保存場所

エラーログは`chrome.storage.local`に保存され、最大500件まで保持されます。