// DOM要素の取得
const elements = {
    modal: document.getElementById('shortcutModal'),
    modalTitle: document.getElementById('modalTitle'),
    form: document.getElementById('shortcutForm'),
    nameInput: document.getElementById('shortcutName'),
    urlInput: document.getElementById('shortcutUrl'),
    cancelBtn: document.getElementById('cancelBtn'),
    addBtn: document.getElementById('addShortcut'),
    editMenuItem: document.getElementById('editShortcut'),
    deleteMenuItem: document.getElementById('deleteShortcut'),
    searchInput: document.querySelector('.search-input'),
    shortcutSearch: document.getElementById('shortcutSearch'),
    darkModeToggle: document.getElementById('darkModeToggle'),
    folderModal: document.getElementById('folderModal'),
    folderModalTitle: document.getElementById('folderModalTitle'),
    folderModalGrid: document.getElementById('folderModalGrid'),
    closeFolderBtn: document.getElementById('closeFolderBtn')
};

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    // ブラウザのロケールに基づいて言語を設定
    document.documentElement.lang = chrome.i18n.getUILanguage();
    
    loadLocaleMessages();
    setupEventListeners();
    setupSearchBar();
    setupShortcutSearch();
    setupDarkMode();
    setupFolderModal();
    
    // ショートカットマネージャーの初期化は shortcuts.js で行われる
});

// イベントリスナーの設定
function setupEventListeners() {
    // 追加ボタン（動的に生成されるため、グローバルにopenModalを公開）
    window.openModal = openModal;

    // モーダルのキャンセルボタン
    elements.cancelBtn.addEventListener('click', () => {
        closeModal();
    });

    // モーダルの外側クリックで閉じる
    elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) {
            closeModal();
        }
    });

    // フォームの送信
    elements.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleFormSubmit();
    });

    // コンテキストメニューのアイテム
    elements.editMenuItem.addEventListener('click', () => {
        const index = window.shortcutManager.currentEditIndex;
        if (index !== null) {
            const shortcut = window.shortcutManager.shortcuts[index];
            if (shortcut.isFolder) {
                // フォルダーの名前変更 - モーダルを開いて直接編集
                window.openFolderModal(shortcut.folderId, shortcut.name);
                // モーダルが開いたらタイトルにフォーカス
                setTimeout(() => {
                    elements.folderModalTitle.focus();
                }, 100);
            } else {
                openModal(true, shortcut, index);
            }
        }
    });

    elements.deleteMenuItem.addEventListener('click', async () => {
        const index = window.shortcutManager.currentEditIndex;
        if (index !== null) {
            await window.shortcutManager.delete(index);
        }
    });

    // キーボードショートカット
    document.addEventListener('keydown', (e) => {
        // Escキーでモーダルを閉じる
        if (e.key === 'Escape' && elements.modal.classList.contains('show')) {
            closeModal();
        }
        
        // Ctrl+Aで新規追加
        if (e.ctrlKey && e.key === 'a') {
            e.preventDefault();
            openModal();
        }
    });
}

// 検索バーの設定
function setupSearchBar() {
    // 検索バーにフォーカス
    elements.searchInput.focus();

    // 検索候補の表示（オプション）
    elements.searchInput.addEventListener('input', (e) => {
        // 将来的に検索候補を表示する機能を追加可能
    });
}

// モーダルを開く
function openModal(isEdit = false, shortcut = null, index = null) {
    elements.modal.classList.add('show');
    
    if (isEdit && shortcut) {
        elements.modalTitle.textContent = chrome.i18n.getMessage('editShortcut');
        elements.nameInput.value = shortcut.name;
        elements.urlInput.value = shortcut.url;
        elements.form.dataset.editIndex = index;
    } else {
        elements.modalTitle.textContent = chrome.i18n.getMessage('addShortcut');
        elements.nameInput.value = '';
        elements.urlInput.value = '';
        delete elements.form.dataset.editIndex;
    }
    
    elements.nameInput.focus();
}

// モーダルを閉じる
function closeModal() {
    elements.modal.classList.remove('show');
    elements.form.reset();
    delete elements.form.dataset.editIndex;
}

// フォーム送信の処理
async function handleFormSubmit() {
    const name = elements.nameInput.value.trim();
    const url = elements.urlInput.value.trim();
    
    if (!name || !url) {
        return;
    }

    // URLの検証
    try {
        new URL(url);
    } catch (error) {
        alert(chrome.i18n.getMessage('invalidUrl'));
        return;
    }

    const editIndex = elements.form.dataset.editIndex;
    
    if (editIndex !== undefined) {
        // 編集
        await window.shortcutManager.edit(parseInt(editIndex), name, url);
    } else {
        // 新規追加
        await window.shortcutManager.add(name, url);
    }
    
    closeModal();
}

// ドラッグ&ドロップファイルのインポート
document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
});

document.addEventListener('drop', async (e) => {
    e.preventDefault();
    
    const files = Array.from(e.dataTransfer.files);
    const jsonFile = files.find(file => file.type === 'application/json');
    
    if (jsonFile) {
        if (confirm(chrome.i18n.getMessage('importConfirm'))) {
            await window.shortcutManager.importFromJSON(jsonFile);
        }
    }
});

// ユーティリティ関数
function formatUrl(url) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return 'https://' + url;
    }
    return url;
}

// ローカライズ対応
function loadLocaleMessages() {
    // テキストコンテンツの置換
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const messageKey = element.getAttribute('data-i18n');
        const message = chrome.i18n.getMessage(messageKey);
        if (message) {
            element.textContent = message;
        }
    });
    
    // プレースホルダーの置換
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const messageKey = element.getAttribute('data-i18n-placeholder');
        const message = chrome.i18n.getMessage(messageKey);
        if (message) {
            element.placeholder = message;
        }
    });
    
    // タイトルの置換（title属性を持つ要素）
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        const messageKey = element.getAttribute('data-i18n-title');
        const message = chrome.i18n.getMessage(messageKey);
        if (message) {
            element.title = message;
        }
    });
}

// フォルダーモーダルの設定
function setupFolderModal() {
    // 閉じるボタン
    elements.closeFolderBtn.addEventListener('click', () => {
        closeFolderModal();
    });
    
    // モーダル外クリックで閉じる
    elements.folderModal.addEventListener('click', (e) => {
        if (e.target === elements.folderModal) {
            closeFolderModal();
        }
    });
    
    // フォルダー名の編集
    let originalFolderName = '';
    let currentFolderId = null;
    
    elements.folderModalTitle.addEventListener('focus', (e) => {
        originalFolderName = e.target.textContent;
        currentFolderId = elements.folderModal.dataset.folderId;
        
        // テキストを選択
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(e.target);
        selection.removeAllRanges();
        selection.addRange(range);
    });
    
    elements.folderModalTitle.addEventListener('blur', async (e) => {
        const newName = e.target.textContent.trim();
        if (newName && newName !== originalFolderName && currentFolderId) {
            // フォルダーを検索して名前を更新
            const folder = window.shortcutManager.shortcuts.find(s => 
                s.isFolder && s.folderId === currentFolderId
            );
            if (folder) {
                folder.name = newName;
                await window.shortcutManager.save();
                window.shortcutManager.render();
            }
        } else if (!newName) {
            // 空の場合は元に戻す
            e.target.textContent = originalFolderName;
        }
    });
    
    // Enterキーで編集終了
    elements.folderModalTitle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.target.blur();
        } else if (e.key === 'Escape') {
            e.target.textContent = originalFolderName;
            e.target.blur();
        }
    });
}

// フォルダーモーダルを開く
window.openFolderModal = function(folderId, folderName) {
    elements.folderModalTitle.textContent = folderName;
    elements.folderModal.classList.add('show');
    elements.folderModal.dataset.folderId = folderId;
    
    // フォルダー内のショートカットを表示
    const grid = elements.folderModalGrid;
    grid.innerHTML = '';
    
    const folderItems = window.shortcutManager.shortcuts.filter(s => 
        s.folderId === folderId && !s.isFolder
    );
    
    folderItems.forEach((shortcut, idx) => {
        const realIndex = window.shortcutManager.shortcuts.indexOf(shortcut);
        console.log(`Folder item ${idx}: shortcut="${shortcut.name}", realIndex=${realIndex}`);
        
        // インデックスが無効な場合はスキップ
        if (realIndex === -1) {
            console.error('Shortcut not found in main array:', shortcut);
            return;
        }
        
        const item = window.shortcutManager.createShortcutElement(shortcut, realIndex);
        grid.appendChild(item);
    });
    
    // 空の場合のメッセージ
    if (folderItems.length === 0) {
        const placeholder = document.createElement('div');
        placeholder.className = 'folder-placeholder';
        placeholder.textContent = chrome.i18n.getMessage('emptyFolder') || 'This folder is empty';
        placeholder.style.gridColumn = '1 / -1';
        grid.appendChild(placeholder);
    }
    
    // フォルダー内でのドラッグ&ドロップを設定
    // setupDragAndDropは呼ばない（重複するため）
    // モーダル外へのドロップを許可
    setupModalDragOut(folderId);
};

// モーダル外へのドラッグアウト設定
function setupModalDragOut(folderId) {
    console.log('Setting up modal drag out for folder:', folderId);
    
    // 既存のハンドラーをクリーンアップ
    if (window.cleanupModalDragHandlers) {
        window.cleanupModalDragHandlers();
    }
    
    const modal = elements.folderModal;
    const modalGrid = elements.folderModalGrid;
    const modalContent = modal.querySelector('.folder-modal-content');
    
    if (!modal || !modalGrid || !modalContent) {
        console.error('Modal elements not found:', { modal, modalGrid, modalContent });
        return;
    }
    
    // モーダルからドラッグしているかを追跡
    let isDraggingFromModal = false;
    let currentDraggedIndex = null;
    
    // モーダル内でドラッグ開始
    const handleDragStart = (e) => {
        const shortcutItem = e.target.closest('.shortcut-item');
        console.log('Drag start event:', e.target, 'Closest shortcut:', shortcutItem);
        
        if (shortcutItem) {
            isDraggingFromModal = true;
            currentDraggedIndex = parseInt(shortcutItem.dataset.index);
            console.log('Dragging from modal, index:', currentDraggedIndex);
            
            // ドラッグデータを明示的に設定
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', currentDraggedIndex.toString());
        }
    };
    
    modalGrid.addEventListener('dragstart', handleDragStart);
    
    // モーダル背景（暗い部分）へのドラッグオーバー
    const handleModalDragOver = (e) => {
        // モーダルコンテンツ外かつモーダル内の場合
        if (isDraggingFromModal && !modalContent.contains(e.target)) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            modal.classList.add('modal-drag-out');
            console.log('Drag over modal background at:', e.target);
        }
    };
    
    // モーダル背景へのドロップ
    const handleModalDrop = (e) => {
        console.log('Drop event on:', e.target, 'isDraggingFromModal:', isDraggingFromModal, 'currentDraggedIndex:', currentDraggedIndex);
        
        if (isDraggingFromModal && currentDraggedIndex !== null && !modalContent.contains(e.target)) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('Processing drop on modal background with index:', currentDraggedIndex);
            console.log('Total shortcuts:', window.shortcutManager.shortcuts.length);
            
            // インデックスの範囲チェック
            if (currentDraggedIndex >= 0 && currentDraggedIndex < window.shortcutManager.shortcuts.length) {
                try {
                    // フォルダーから外に移動
                    window.shortcutManager.moveShortcutToFolder(currentDraggedIndex, null);
                    
                    // モーダルを更新
                    setTimeout(() => {
                        console.log('Updating modal after move');
                        window.openFolderModal(folderId, elements.folderModalTitle.textContent);
                    }, 100);
                } catch (error) {
                    console.error('Error moving shortcut:', error);
                }
            } else {
                console.error('Invalid dragged index in modal:', currentDraggedIndex, 'Total:', window.shortcutManager.shortcuts.length);
            }
            
            modal.classList.remove('modal-drag-out');
        }
        
        // クリーンアップ
        isDraggingFromModal = false;
        currentDraggedIndex = null;
    };
    
    // ドラッグ終了時のクリーンアップ
    const handleDragEnd = (e) => {
        console.log('Drag end, was dragging from modal:', isDraggingFromModal);
        isDraggingFromModal = false;
        currentDraggedIndex = null;
        modal.classList.remove('modal-drag-out');
    };
    
    // メインからフォルダーへのドロップ
    modalGrid.addEventListener('dragover', (e) => {
        if (!isDraggingFromModal) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            modalGrid.classList.add('folder-drag-over');
        }
    });
    
    modalGrid.addEventListener('dragleave', (e) => {
        if (!modalGrid.contains(e.relatedTarget)) {
            modalGrid.classList.remove('folder-drag-over');
        }
    });
    
    modalGrid.addEventListener('drop', (e) => {
        if (!isDraggingFromModal) {
            e.preventDefault();
            modalGrid.classList.remove('folder-drag-over');
            
            const draggedIndex = parseInt(e.dataTransfer.getData('shortcutIndex'));
            
            if (!isNaN(draggedIndex)) {
                const shortcut = window.shortcutManager.shortcuts[draggedIndex];
                // すでにこのフォルダーにある場合はスキップ
                if (shortcut && shortcut.folderId !== folderId) {
                    // メインからフォルダーに移動
                    window.shortcutManager.moveShortcutToFolder(draggedIndex, folderId);
                    // モーダルを更新
                    setTimeout(() => {
                        window.openFolderModal(folderId, elements.folderModalTitle.textContent);
                    }, 100);
                }
            }
        }
    });
    
    // イベントリスナーを追加
    // キャプチャーフェーズでイベントを処理
    modal.addEventListener('dragover', handleModalDragOver, false);
    modal.addEventListener('drop', handleModalDrop, false);
    modalGrid.addEventListener('dragend', handleDragEnd);
    document.addEventListener('dragend', handleDragEnd);
    
    // モーダルコンテンツでドロップイベントが伝播しないようにする
    modalContent.addEventListener('drop', (e) => {
        if (isDraggingFromModal) {
            e.stopPropagation();
        }
    });
    
    modalContent.addEventListener('dragover', (e) => {
        if (isDraggingFromModal) {
            e.stopPropagation();
        }
    });
    
    // クリーンアップ関数
    window.cleanupModalDragHandlers = () => {
        console.log('Cleaning up modal drag handlers');
        modal.removeEventListener('dragover', handleModalDragOver);
        modal.removeEventListener('drop', handleModalDrop);
        modalGrid.removeEventListener('dragstart', handleDragStart);
        modalGrid.removeEventListener('dragend', handleDragEnd);
        document.removeEventListener('dragend', handleDragEnd);
    };
    
    console.log('Modal drag out setup complete');
}

// フォルダーモーダルを閉じる
function closeFolderModal() {
    elements.folderModal.classList.remove('show');
    // ドラッグハンドラーをクリーンアップ
    if (window.cleanupModalDragHandlers) {
        window.cleanupModalDragHandlers();
    }
}

// グローバルにも公開
window.closeFolderModal = closeFolderModal;

// ショートカット検索の設定
function setupShortcutSearch() {
    let debounceTimer;
    
    elements.shortcutSearch.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const keyword = e.target.value.trim();
            window.shortcutManager.setSearchKeyword(keyword);
        }, 300); // 300ms デバウンス
    });
    
    // Escキーで検索をクリア
    elements.shortcutSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.target.value = '';
            window.shortcutManager.setSearchKeyword('');
            e.target.blur();
        }
    });
}

// ダークモードの設定
async function setupDarkMode() {
    // 保存された設定を読み込み
    const result = await chrome.storage.sync.get(['darkMode']);
    const isDarkMode = result.darkMode || false;
    
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
    }
    
    // トグルボタンのクリックイベント
    elements.darkModeToggle.addEventListener('click', async () => {
        const isCurrentlyDark = document.body.classList.contains('dark-mode');
        const newDarkMode = !isCurrentlyDark;
        
        if (newDarkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        
        // 設定を保存
        await chrome.storage.sync.set({ darkMode: newDarkMode });
    });
    
    // システムのダークモード設定を監視
    if (window.matchMedia) {
        const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        // 初回チェック（保存された設定がない場合）
        if (result.darkMode === undefined && darkModeQuery.matches) {
            document.body.classList.add('dark-mode');
            await chrome.storage.sync.set({ darkMode: true });
        }
        
        // システム設定の変更を監視
        darkModeQuery.addEventListener('change', async (e) => {
            // ユーザーが手動で設定していない場合のみシステム設定に従う
            const saved = await chrome.storage.sync.get(['darkMode']);
            if (saved.darkMode === undefined) {
                if (e.matches) {
                    document.body.classList.add('dark-mode');
                } else {
                    document.body.classList.remove('dark-mode');
                }
            }
        });
    }
}

// アナリティクス（オプション）
function trackEvent(category, action, label = null) {
    // Google Analytics等を使用する場合はここに実装
    console.log('Track event:', { category, action, label });
}

// エラーハンドリング
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    // エラーレポートの送信等
});

// パフォーマンス監視
window.addEventListener('load', () => {
    const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
    console.log('Page load time:', loadTime + 'ms');
});