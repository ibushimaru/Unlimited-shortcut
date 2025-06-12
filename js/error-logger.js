// エラーログシステム
class ErrorLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 500; // 最大500件のログを保持
        this.init();
    }

    init() {
        // グローバルエラーハンドラーを設定
        window.addEventListener('error', (event) => {
            this.logError({
                type: 'window-error',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error ? {
                    message: event.error.message,
                    stack: event.error.stack
                } : null,
                timestamp: new Date().toISOString()
            });
        });

        // Promise拒否ハンドラー
        window.addEventListener('unhandledrejection', (event) => {
            this.logError({
                type: 'unhandled-rejection',
                reason: event.reason,
                promise: event.promise,
                timestamp: new Date().toISOString()
            });
        });

        // 既存のログを読み込む
        this.loadLogs();

        // console.errorをオーバーライド
        const originalError = console.error;
        console.error = (...args) => {
            this.logError({
                type: 'console-error',
                message: args.join(' '),
                stack: new Error().stack,
                timestamp: new Date().toISOString()
            });
            originalError.apply(console, args);
        };

        // console.warnもキャプチャ
        const originalWarn = console.warn;
        console.warn = (...args) => {
            this.logError({
                type: 'console-warn',
                message: args.join(' '),
                stack: new Error().stack,
                timestamp: new Date().toISOString()
            });
            originalWarn.apply(console, args);
        };
    }

    async loadLogs() {
        try {
            const result = await chrome.storage.local.get(['errorLogs']);
            if (result.errorLogs) {
                this.logs = result.errorLogs;
            }
        } catch (error) {
            console.warn('Failed to load error logs:', error);
        }
    }

    async saveLogs() {
        try {
            await chrome.storage.local.set({ errorLogs: this.logs });
        } catch (error) {
            console.warn('Failed to save error logs:', error);
        }
    }

    logError(errorData) {
        // ログに追加
        this.logs.push(errorData);

        // 最大件数を超えたら古いものから削除
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        // 保存
        this.saveLogs();

        // デバッグモードの場合は即座に出力
        if (this.isDebugMode()) {
            console.log('[ERROR_LOG]', errorData);
        }
    }

    isDebugMode() {
        // URLパラメータでデバッグモードを判定
        const params = new URLSearchParams(window.location.search);
        return params.get('debug') === 'true';
    }

    // ログをエクスポート（テキスト形式）
    exportLogs() {
        const logText = this.logs.map(log => {
            let text = `[${log.timestamp}] ${log.type.toUpperCase()}\n`;
            if (log.message) text += `Message: ${log.message}\n`;
            if (log.filename) text += `File: ${log.filename}:${log.lineno}:${log.colno}\n`;
            if (log.error && log.error.stack) text += `Stack:\n${log.error.stack}\n`;
            text += '---\n';
            return text;
        }).join('\n');

        return logText;
    }

    // ログをMarkdown形式でエクスポート
    exportLogsAsMarkdown() {
        let markdown = '# Error Logs\n\n';
        markdown += `Generated at: ${new Date().toISOString()}\n\n`;

        this.logs.forEach((log, index) => {
            markdown += `## Error ${index + 1}: ${log.type}\n\n`;
            markdown += `**Timestamp:** ${log.timestamp}\n\n`;
            
            if (log.message) {
                markdown += `**Message:** ${log.message}\n\n`;
            }
            
            if (log.filename) {
                markdown += `**Location:** ${log.filename}:${log.lineno}:${log.colno}\n\n`;
            }
            
            if (log.error && log.error.stack) {
                markdown += '**Stack Trace:**\n```\n' + log.error.stack + '\n```\n\n';
            }
            
            markdown += '---\n\n';
        });

        return markdown;
    }

    // ログをクリップボードにコピー
    async copyLogsToClipboard() {
        const markdown = this.exportLogsAsMarkdown();
        try {
            // ドキュメントにフォーカスがない場合のフォールバック
            if (!document.hasFocus()) {
                // テキストエリアを作成してコピー
                const textarea = document.createElement('textarea');
                textarea.value = markdown;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                return true;
            } else {
                // フォーカスがある場合は通常のClipboard API
                await navigator.clipboard.writeText(markdown);
                return true;
            }
        } catch (error) {
            // 最終的なフォールバック
            try {
                const textarea = document.createElement('textarea');
                textarea.value = markdown;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                const success = document.execCommand('copy');
                document.body.removeChild(textarea);
                return success;
            } catch (fallbackError) {
                console.error('Failed to copy logs to clipboard:', error, fallbackError);
                return false;
            }
        }
    }

    // ログをダウンロード
    downloadLogs() {
        const markdown = this.exportLogsAsMarkdown();
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `error-logs-${new Date().toISOString().split('T')[0]}.md`;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    // ログをクリア
    clearLogs() {
        this.logs = [];
        this.saveLogs();
    }

    // 最新のエラーを取得
    getRecentErrors(count = 10) {
        return this.logs.slice(-count);
    }
}

// グローバルに公開
window.errorLogger = new ErrorLogger();

// デバッグ用のヘルパー関数
window.showErrorLogs = function() {
    const logs = window.errorLogger.getRecentErrors(20);
    console.group('Recent Error Logs');
    logs.forEach((log, index) => {
        console.log(`[${index}] ${log.timestamp} - ${log.type}:`, log);
    });
    console.groupEnd();
    console.log('\nTip: Use copyErrorLogs() to copy all logs to clipboard');
    console.log('     Use downloadErrorLogs() to download as a file');
};

window.copyErrorLogs = async function() {
    const success = await window.errorLogger.copyLogsToClipboard();
    if (success) {
        console.log('Error logs copied to clipboard!');
        console.log('You can now paste the logs anywhere.');
    } else {
        console.error('Failed to copy error logs');
        console.log('Alternative: Use downloadErrorLogs() to save as a file');
    }
};

window.downloadErrorLogs = function() {
    window.errorLogger.downloadLogs();
    console.log('Error logs downloaded!');
    console.log('Check your Downloads folder for the error log file.');
};

window.clearErrorLogs = function() {
    window.errorLogger.clearLogs();
    console.log('Error logs cleared!');
};

// エラーログを直接コンソールに出力
window.printErrorLogs = function() {
    const markdown = window.errorLogger.exportLogsAsMarkdown();
    console.log('=== ERROR LOGS (Markdown) ===');
    console.log(markdown);
    console.log('=== END OF ERROR LOGS ===');
    console.log('\nYou can copy the above logs manually.');
};

// 最新のエラーの詳細を表示
window.showLastError = function() {
    const logs = window.errorLogger.getRecentErrors(1);
    if (logs.length > 0) {
        const error = logs[0];
        console.group('Last Error Details');
        console.log('Type:', error.type);
        console.log('Time:', new Date(error.timestamp).toLocaleString());
        if (error.message) console.log('Message:', error.message);
        if (error.filename) console.log('Location:', `${error.filename}:${error.lineno}:${error.colno}`);
        if (error.error && error.error.stack) {
            console.log('Stack Trace:');
            console.log(error.error.stack);
        }
        console.groupEnd();
    } else {
        console.log('No errors logged yet.');
    }
};

// ヘルプ情報を表示
window.errorLogHelp = function() {
    console.log('%c=== Error Logger Help ===', 'color: #1a73e8; font-weight: bold; font-size: 14px');
    console.log('%cAvailable Commands:', 'font-weight: bold');
    console.log('  showErrorLogs()     - Show recent 20 errors');
    console.log('  showLastError()     - Show details of the last error');
    console.log('  copyErrorLogs()     - Copy all logs to clipboard');
    console.log('  printErrorLogs()    - Print logs directly to console');
    console.log('  downloadErrorLogs() - Download logs as a file');
    console.log('  clearErrorLogs()    - Clear all error logs');
    console.log('  errorLogHelp()      - Show this help message');
    console.log('\n%cError Log Viewer:', 'font-weight: bold');
    console.log('  Open error-logs.html for a visual interface');
};