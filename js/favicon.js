// ファビコン管理クラス
class FaviconManager {
    // ファビコンの取得
    static async getFavicon(url) {
        try {
            const urlObj = new URL(url);
            
            // まずキャッシュをチェック
            const cached = await this.getCachedFavicon(url);
            if (cached) {
                return cached;
            }
            
            // Chrome拡張機能の favicon API を優先使用
            // サイズを16から32に変更してより鮮明なアイコンを取得
            const chromeFaviconUrl = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`;
            
            // chrome://favicon は拡張機能から直接使用できないため、
            // manifest.json の favicon permission を利用
            const faviconUrl = await new Promise((resolve) => {
                // Chrome APIを使用してファビコンを取得
                const img = new Image();
                img.onload = () => resolve(chromeFaviconUrl);
                img.onerror = () => {
                    // フォールバック: Google Favicon API
                    resolve(`https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`);
                };
                img.src = chromeFaviconUrl;
            });
            
            // キャッシュに保存
            await this.cachefavicon(url, faviconUrl);
            
            return faviconUrl;
        } catch (error) {
            console.error('Error getting favicon:', error);
            return null;
        }
    }

    // 画像URLの有効性をチェック
    static checkImageUrl(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
        });
    }

    // ファビコンのキャッシュ
    static async cachefavicon(url, faviconUrl) {
        const cache = await this.getCache();
        cache[url] = {
            favicon: faviconUrl,
            timestamp: Date.now()
        };
        await chrome.storage.local.set({ faviconCache: cache });
    }

    // キャッシュから取得
    static async getCachedFavicon(url) {
        const cache = await this.getCache();
        const cached = cache[url];
        
        if (cached) {
            // キャッシュの有効期限は7日間
            const isExpired = Date.now() - cached.timestamp > 7 * 24 * 60 * 60 * 1000;
            if (!isExpired) {
                return cached.favicon;
            }
        }
        
        return null;
    }

    // キャッシュを取得
    static async getCache() {
        const result = await chrome.storage.local.get(['faviconCache']);
        return result.faviconCache || {};
    }

    // ファビコンの更新
    static async updateFavicons(shortcuts) {
        const updatedShortcuts = [];
        
        for (const shortcut of shortcuts) {
            if (!shortcut.icon) {
                const favicon = await this.getFavicon(shortcut.url);
                shortcut.icon = favicon;
            }
            updatedShortcuts.push(shortcut);
        }
        
        return updatedShortcuts;
    }

    // ファビコンをBase64に変換
    static async convertToBase64(url) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Error converting to base64:', error);
            return null;
        }
    }

    // ドメインから色を生成（ファビコンが取得できない場合の代替）
    static generateColorFromDomain(domain) {
        let hash = 0;
        for (let i = 0; i < domain.length; i++) {
            hash = domain.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const hue = hash % 360;
        return `hsl(${hue}, 70%, 50%)`;
    }

    // デフォルトアイコンの生成
    static generateDefaultIcon(name, url) {
        try {
            const domain = new URL(url).hostname;
            const color = this.generateColorFromDomain(domain);
            const letter = name.charAt(0).toUpperCase();
            
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            
            // 背景
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(32, 32, 32, 0, 2 * Math.PI);
            ctx.fill();
            
            // 文字
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 32px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(letter, 32, 32);
            
            return canvas.toDataURL();
        } catch (error) {
            return null;
        }
    }
}

// エクスポート
window.FaviconManager = FaviconManager;