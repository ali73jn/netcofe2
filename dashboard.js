// ==================== تنظیمات اصلی ====================
const CONFIG = {
    // لینک‌های پیش‌فرض
    BOOKMARKS_JSON_URL: "https://raw.githubusercontent.com/ali73jn/netcofe2/refs/heads/main/data/bookmarks.json",
    DEFAULT_BOOKMARKS_URL: "https://raw.githubusercontent.com/ali73jn/netcofe2/refs/heads/main/data/bookmarks.json",
	ICONS_JSON_URL: "https://raw.githubusercontent.com/ali73jn/netcofe2/refs/heads/main/data/icons.json",
    SETTINGS_JSON_URL: "https://raw.githubusercontent.com/ali73jn/netcofe2/refs/heads/main/data/settings.json",
    // مسیرهای لوکال
    FALLBACK_ICON_PATH: "icons/default_icon.png",
    FOLDER_ICON_PATH: "icons/folder.png",
    DEFAULT_BG_IMAGE_PATH: "icons/default_bg.jpg",
    
    // تنظیمات گرید
    GRID_CELL_SIZE: 20,
    GRID_GAP: 0,
    HORIZONTAL_PIXEL_OFFSET: 0,
    
	
    // کلیدهای localStorage
    STORAGE_KEYS: {
        LAYOUT: 'netcofe_layout',
        BACKGROUND: 'netcofe_background',
        SETTINGS: 'netcofe_settings',
        THEME: 'netcofe_theme',
        USER_BOOKMARKS: 'netcofe_user_bookmarks',
        CUSTOM_URLS: 'netcofe_custom_urls',
        FAVICON_CACHE: 'netcofe_favicon_cache_v3',
        CURRENT_PATHS: 'netcofe_current_paths'
    }
};


// ==================== وضعیت برنامه ====================
let state = {
    isEditMode: false,
    isDarkMode: false,
    isCompactMode: false,
    currentPaths: {}, // ذخیره مسیر فعلی برای هر دسته‌بندی
    dragInfo: null,
    resizeInfo: null,
    layoutMap: {},
    bookmarks: [],
    userBookmarks: [],
    searchTerm: '',
    currentModal: null,
	customIcons: {}
};

// برای دیباگ - نمایش لاگ‌ها در کنسول
console.log('state.currentPaths:', state.currentPaths);

// ==================== مدیریت ذخیره‌سازی ====================
class StorageManager {
    static get(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error('خطا در خواندن از localStorage:', error);
            return null;
        }
    }

    static set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('خطا در ذخیره در localStorage:', error);
            return false;
        }
    }

    static remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('خطا در حذف از localStorage:', error);
            return false;
        }
    }

    static clearAll() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('خطا در پاک کردن localStorage:', error);
            return false;
        }
    }
}

// ==================== مدیریت بوکمارک‌ها ====================
class BookmarkManager {
    static async loadBookmarks() {
        try {
            // اولویت‌ها: 1. بوکمارک‌های کاربر 2. بوکمارک‌های مرکزی
            const userBookmarks = StorageManager.get(CONFIG.STORAGE_KEYS.USER_BOOKMARKS) || [];
            state.userBookmarks = userBookmarks;
            
            // بارگذاری currentPaths از ذخیره‌سازی
            state.currentPaths = StorageManager.get(CONFIG.STORAGE_KEYS.CURRENT_PATHS) || {};
            
            // بارگذاری بوکمارک‌های مرکزی
            const customUrls = StorageManager.get(CONFIG.STORAGE_KEYS.CUSTOM_URLS) || {};
            const bookmarksUrl = customUrls.bookmarks || CONFIG.BOOKMARKS_JSON_URL;
            
            console.log('در حال بارگذاری بوکمارک‌ها از:', bookmarksUrl);
            
            const response = await fetch(bookmarksUrl);
            if (!response.ok) throw new Error(`خطا در دریافت بوکمارک‌ها: ${response.status}`);
            
            const centralBookmarks = await response.json();
            const centralList = centralBookmarks.bookmarks || centralBookmarks;
            
            console.log('بوکمارک‌های مرکزی دریافت شد:', centralList.length);
			
			try {
                const iconsRes = await fetch(CONFIG.ICONS_JSON_URL);
                state.customIcons = iconsRes.ok ? await iconsRes.json() : {};
            } catch (e) { 
                console.warn('خطا در دریافت فایل آیکون‌ها:', e); 
                state.customIcons = {};
            }
            
            state.bookmarks = this.mergeBookmarks(centralList, userBookmarks);
            
            console.log('بوکمارک‌های نهایی:', state.bookmarks.length);
            
            return state.bookmarks;
        } catch (error) {
            console.error('خطا در بارگذاری بوکمارک‌ها:', error);
            // استفاده از بوکمارک‌های کاربر یا نمونه پیش‌فرض
            state.bookmarks = state.userBookmarks.length > 0 ? state.userBookmarks : await this.getDefaultBookmarks();
            return state.bookmarks;
        }
    }

    static mergeBookmarks(central, user) {
        const merged = [...central];
        const userMap = new Map(user.map(b => [b.id, b]));
        
        // جایگزینی یا افزودن بوکمارک‌های کاربر
        userMap.forEach((userBm, id) => {
            const index = merged.findIndex(cb => cb.id === id);
            if (index > -1) {
                merged[index] = { ...merged[index], ...userBm, source: 'user' };
            } else {
                merged.push({ ...userBm, source: 'user' });
            }
        });
        
        return merged;
    }

    static async getDefaultBookmarks() {
        return [
            {
                id: 'google',
                title: 'گوگل',
                url: 'https://google.com',
                category: 'موتور جستجو',
                description: 'موتور جستجوی گوگل',
                tags: ['جستجو', 'اینترنت']
            },
            {
                id: 'github',
                title: 'GitHub',
                url: 'https://github.com',
                category: 'توسعه',
                description: 'پلتفرم توسعه نرم‌افزار',
                tags: ['کد', 'برنامه‌نویسی']
            }
        ];
    }

    static addUserBookmark(bookmark) {
        const newBookmark = {
            ...bookmark,
            id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            source: 'user',
            dateAdded: new Date().toISOString()
        };
        
        // اگر parentPath وجود دارد، در پوشه مربوطه اضافه کن
        if (bookmark.parentPath && bookmark.parentPath.length > 0) {
            this.addBookmarkToPath(newBookmark, bookmark.parentPath, bookmark.category);
        } else {
            state.userBookmarks.push(newBookmark);
        }
        
        StorageManager.set(CONFIG.STORAGE_KEYS.USER_BOOKMARKS, state.userBookmarks);
        
        // بازسازی لیست ترکیبی
        state.bookmarks = this.mergeBookmarks(
            state.bookmarks.filter(b => b.source !== 'user'),
            state.userBookmarks
        );
        
        return newBookmark;
    }

    static addBookmarkToPath(bookmark, path, category) {
        let currentItems = state.userBookmarks.filter(b => b.category === category);
        
        if (currentItems.length === 0) {
            // اگر هنوز برای این دسته‌بندی آیتمی نداریم، اضافه کن
            state.userBookmarks.push(bookmark);
            return;
        }
        
        // پیدا کردن آیتم‌های این دسته‌بندی
        let targetItems = currentItems;
        
        // دنبال پوشه مورد نظر در مسیر بگرد
        for (let i = 0; i < path.length; i++) {
            const folderId = path[i];
            const folder = targetItems.find(item => item.id === folderId && item.type === 'folder');
            
            if (!folder) {
                // پوشه پیدا نشد، در ریشه اضافه کن
                state.userBookmarks.push(bookmark);
                return;
            }
            
            // اگر آخرین پوشه در مسیر است
            if (i === path.length - 1) {
                // به پوشه اضافه کن
                if (!folder.children) folder.children = [];
                folder.children.push(bookmark);
                break;
            } else {
                // به پوشه بعدی برو
                if (!folder.children) folder.children = [];
                targetItems = folder.children;
            }
        }
    }

    static updateUserBookmark(id, updates) {
        const index = state.userBookmarks.findIndex(b => b.id === id);
        if (index > -1) {
            state.userBookmarks[index] = { ...state.userBookmarks[index], ...updates };
            StorageManager.set(CONFIG.STORAGE_KEYS.USER_BOOKMARKS, state.userBookmarks);
            
            // به‌روزرسانی در bookmarks اصلی
            const mainIndex = state.bookmarks.findIndex(b => b.id === id);
            if (mainIndex > -1) {
                state.bookmarks[mainIndex] = { ...state.bookmarks[mainIndex], ...updates };
            }
            
            return state.userBookmarks[index];
        }
        return null;
    }

    static deleteUserBookmark(id) {
        state.userBookmarks = state.userBookmarks.filter(b => b.id !== id);
        state.bookmarks = state.bookmarks.filter(b => b.id !== id);
        StorageManager.set(CONFIG.STORAGE_KEYS.USER_BOOKMARKS, state.userBookmarks);
        return true;
    }

    static async refreshCentralBookmarks() {
        try {
            const customUrls = StorageManager.get(CONFIG.STORAGE_KEYS.CUSTOM_URLS) || {};
            const bookmarksUrl = customUrls.bookmarks || CONFIG.BOOKMARKS_JSON_URL;
            
            const response = await fetch(bookmarksUrl + '?t=' + Date.now());
            if (!response.ok) throw new Error('خطا در دریافت بوکمارک‌ها');
            
            const centralBookmarks = await response.json();
            const centralList = centralBookmarks.bookmarks || centralBookmarks;
            
            // فقط بوکمارک‌های مرکزی را جایگزین می‌کنیم، بوکمارک‌های کاربر باقی می‌مانند
            state.bookmarks = this.mergeBookmarks(centralList, state.userBookmarks);
            
            return true;
        } catch (error) {
            console.error('خطا در به‌روزرسانی بوکمارک‌ها:', error);
            return false;
        }
    }
}

// ==================== سیستم Favicon ====================
class FaviconManager {
    static async resolveFavicon(url) {
        if (!url || !url.startsWith('http')) {
            return CONFIG.FALLBACK_ICON_PATH;
        }
        
        try {
            // بررسی کش
            const cache = StorageManager.get(CONFIG.STORAGE_KEYS.FAVICON_CACHE) || {};
            const cached = cache[url];
            
            if (cached && Date.now() - cached.timestamp < 7 * 24 * 60 * 60 * 1000) {
                return cached.data;
            }
            
            // تلاش برای دریافت favicon جدید
            const faviconUrl = this.getFaviconUrl(url);
            const base64 = await this.fetchIconAsBase64(faviconUrl);
            
            if (base64) {
                // ذخیره در کش
                cache[url] = {
                    data: base64,
                    timestamp: Date.now()
                };
                StorageManager.set(CONFIG.STORAGE_KEYS.FAVICON_CACHE, cache);
                return base64;
            }
            
            return CONFIG.FALLBACK_ICON_PATH;
        } catch (error) {
            console.error('خطا در دریافت favicon:', error);
            return CONFIG.FALLBACK_ICON_PATH;
        }
    }

    static getFaviconUrl(url) {
        try {
            const domain = new URL(url).hostname;
            return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
        } catch {
            return CONFIG.FALLBACK_ICON_PATH;
        }
    }

    static async fetchIconAsBase64(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            
            const blob = await response.blob();
            return await this.blobToBase64(blob);
        } catch {
            return null;
        }
    }

    static blobToBase64(blob) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    }

    static clearCache() {
        StorageManager.set(CONFIG.STORAGE_KEYS.FAVICON_CACHE, {});
    }
}

// ==================== مدیریت تم و ظاهر ====================
class ThemeManager {
    static init() {
        const settings = StorageManager.get(CONFIG.STORAGE_KEYS.SETTINGS) || {};
        const savedTheme = StorageManager.get(CONFIG.STORAGE_KEYS.THEME);
        
        // تعیین تم اولیه
        if (savedTheme) {
            state.isDarkMode = savedTheme === 'dark';
        } else if (settings.autoDarkMode && window.matchMedia) {
            state.isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        
        this.applyTheme();
        this.setupThemeListeners();
    }

    static applyTheme() {
        document.documentElement.setAttribute('data-theme', state.isDarkMode ? 'dark' : 'light');
        StorageManager.set(CONFIG.STORAGE_KEYS.THEME, state.isDarkMode ? 'dark' : 'light');
    }

    static setupThemeListeners() {
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                const settings = StorageManager.get(CONFIG.STORAGE_KEYS.SETTINGS) || {};
                if (settings.autoDarkMode) {
                    state.isDarkMode = e.matches;
                    this.applyTheme();
                }
            });
        }
    }

    static toggleTheme() {
        state.isDarkMode = !state.isDarkMode;
        this.applyTheme();
        return state.isDarkMode;
    }
}

// ==================== مدیریت پس‌زمینه ====================
class BackgroundManager {
    static applySavedBackground() {
        try {
            const bgData = StorageManager.get(CONFIG.STORAGE_KEYS.BACKGROUND);
            const body = document.body;
            
            body.style.backgroundRepeat = 'no-repeat';
            body.style.backgroundPosition = 'center center';
            body.style.backgroundSize = 'cover';
            body.style.backgroundAttachment = 'fixed';
            
            if (bgData) {
                body.style.backgroundImage = `url(${bgData})`;
            } else {
                body.style.backgroundImage = `url(${CONFIG.DEFAULT_BG_IMAGE_PATH})`;
            }
        } catch (error) {
            console.error('خطا در اعمال پس‌زمینه:', error);
        }
    }

    static setBackground(imageData) {
        StorageManager.set(CONFIG.STORAGE_KEYS.BACKGROUND, imageData);
        document.body.style.backgroundImage = `url(${imageData})`;
    }

    static resetBackground() {
        StorageManager.remove(CONFIG.STORAGE_KEYS.BACKGROUND);
        document.body.style.backgroundImage = `url(${CONFIG.DEFAULT_BG_IMAGE_PATH})`;
    }
}

// ==================== Drag & Resize System ====================
class DragResizeManager {
    static startDrag(e, card) {
        if (e.button !== 0 || !state.isEditMode) return;
        e.preventDefault();
        
        state.dragInfo = {
            card: card,
            startX: e.clientX,
            startY: e.clientY,
            startCol: parseInt(card.style.gridColumnStart) || 1,
            startRow: parseInt(card.style.gridRowStart) || 1
        };
        
        card.classList.add('dragging');
        document.body.style.cursor = 'grabbing';
        
        const onDrag = this.onDrag.bind(this);
        const stopDrag = this.stopDrag.bind(this);
        
        window.addEventListener('mousemove', onDrag);
        window.addEventListener('mouseup', stopDrag);
        
        // ذخیره توابع برای حذف listener
        state.dragInfo.onDrag = onDrag;
        state.dragInfo.stopDrag = stopDrag;
    }

    static onDrag(e) {
        if (!state.dragInfo) return;
        
        const dx = e.clientX - state.dragInfo.startX;
        const dy = e.clientY - state.dragInfo.startY;
        
        const dCol = Math.round(dx / (CONFIG.GRID_CELL_SIZE + CONFIG.GRID_GAP));
        const dRow = Math.round(dy / (CONFIG.GRID_CELL_SIZE + CONFIG.GRID_GAP));
        
        const newCol = Math.max(1, state.dragInfo.startCol - dCol);
        const newRow = Math.max(1, state.dragInfo.startRow + dRow);
        
        state.dragInfo.card.style.gridColumnStart = newCol;
        state.dragInfo.card.style.gridRowStart = newRow;
    }

    static stopDrag() {
        if (state.dragInfo) {
            state.dragInfo.card.classList.remove('dragging');
            const category = state.dragInfo.card.dataset.category;
            
            if (state.layoutMap[category]) {
                state.layoutMap[category].col = parseInt(state.dragInfo.card.style.gridColumnStart) || 1;
                state.layoutMap[category].row = parseInt(state.dragInfo.card.style.gridRowStart) || 1;
                StorageManager.set(CONFIG.STORAGE_KEYS.LAYOUT, state.layoutMap);
            }
            
            // حذف event listeners
            if (state.dragInfo.onDrag && state.dragInfo.stopDrag) {
                window.removeEventListener('mousemove', state.dragInfo.onDrag);
                window.removeEventListener('mouseup', state.dragInfo.stopDrag);
            }
        }
        
        state.dragInfo = null;
        document.body.style.cursor = 'default';
    }

    static startResize(e, card) {
        if (e.button !== 0 || !state.isEditMode) return;
        e.preventDefault();
        e.stopPropagation();
        
        const colEnd = card.style.gridColumnEnd;
        const rowEnd = card.style.gridRowEnd;
        
        state.resizeInfo = {
            card: card,
            startX: e.clientX,
            startY: e.clientY,
            startW: colEnd ? parseInt(colEnd.split(' ')[1]) : 8,
            startH: rowEnd ? parseInt(rowEnd.split(' ')[1]) : 6
        };
        
        const onResize = this.onResize.bind(this);
        const stopResize = this.stopResize.bind(this);
        
        window.addEventListener('mousemove', onResize);
        window.addEventListener('mouseup', stopResize);
        
        state.resizeInfo.onResize = onResize;
        state.resizeInfo.stopResize = stopResize;
    }

    static onResize(e) {
        if (!state.resizeInfo) return;
        
        const dx = e.clientX - state.resizeInfo.startX;
        const dy = e.clientY - state.resizeInfo.startY;
        
        const dW = Math.round(dx / (CONFIG.GRID_CELL_SIZE + CONFIG.GRID_GAP));
        const dH = Math.round(dy / (CONFIG.GRID_CELL_SIZE + CONFIG.GRID_GAP));
        
        const newW = Math.max(4, state.resizeInfo.startW - dW);
        const newH = Math.max(4, state.resizeInfo.startH + dH);
        
        state.resizeInfo.card.style.gridColumnEnd = `span ${newW}`;
        state.resizeInfo.card.style.gridRowEnd = `span ${newH}`;
        
        const actualWidthInPixels = (newW * CONFIG.GRID_CELL_SIZE) + 
                                   ((newW - 1) * CONFIG.GRID_GAP) + 
                                   CONFIG.HORIZONTAL_PIXEL_OFFSET;
        state.resizeInfo.card.style.width = `${actualWidthInPixels}px`;
    }

    static stopResize() {
        if (state.resizeInfo) {
            const category = state.resizeInfo.card.dataset.category;
            
            if (state.layoutMap[category]) {
                const colEnd = state.resizeInfo.card.style.gridColumnEnd;
                const rowEnd = state.resizeInfo.card.style.gridRowEnd;
                
                state.layoutMap[category].w = colEnd ? parseInt(colEnd.split(' ')[1]) : 8;
                state.layoutMap[category].h = rowEnd ? parseInt(rowEnd.split(' ')[1]) : 6;
                StorageManager.set(CONFIG.STORAGE_KEYS.LAYOUT, state.layoutMap);
            }
            
            if (state.resizeInfo.onResize && state.resizeInfo.stopResize) {
                window.removeEventListener('mousemove', state.resizeInfo.onResize);
                window.removeEventListener('mouseup', state.resizeInfo.stopResize);
            }
        }
        
        state.resizeInfo = null;
    }
}

// ==================== Import/Export System ====================
class ImportExportManager {
    static exportBookmarks() {
        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            bookmarks: state.userBookmarks
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        this.downloadFile(dataStr, 'bookmarks_export.json', 'application/json');
    }

    static importBookmarks(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const importedData = JSON.parse(event.target.result);
                    
                    // اعتبارسنجی ساختار
                    if (!Array.isArray(importedData.bookmarks) && !Array.isArray(importedData)) {
                        throw new Error('فرمت فایل نامعتبر است');
                    }
                    
                    const bookmarksToImport = importedData.bookmarks || importedData;
                    
                    // ایمپورت بوکمارک‌های کاربر
                    state.userBookmarks = bookmarksToImport.map(bm => ({
                        ...bm,
                        source: 'user',
                        dateAdded: bm.dateAdded || new Date().toISOString()
                    }));
                    
                    StorageManager.set(CONFIG.STORAGE_KEYS.USER_BOOKMARKS, state.userBookmarks);
                    
                    // بارگذاری مجدد
                    await BookmarkManager.loadBookmarks();
                    await Renderer.renderDashboard();
                    
                    resolve(true);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    static exportSettings() {
        const settings = {
            layout: state.layoutMap,
            theme: state.isDarkMode ? 'dark' : 'light',
            background: StorageManager.get(CONFIG.STORAGE_KEYS.BACKGROUND),
            customUrls: StorageManager.get(CONFIG.STORAGE_KEYS.CUSTOM_URLS),
            settings: StorageManager.get(CONFIG.STORAGE_KEYS.SETTINGS),
            currentPaths: state.currentPaths
        };
        
        const dataStr = JSON.stringify(settings, null, 2);
        this.downloadFile(dataStr, 'settings_export.json', 'application/json');
    }

    static importSettings(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const importedSettings = JSON.parse(event.target.result);
                    
                    // اعمال تنظیمات
                    if (importedSettings.layout) {
                        state.layoutMap = importedSettings.layout;
                        StorageManager.set(CONFIG.STORAGE_KEYS.LAYOUT, state.layoutMap);
                    }
                    
                    if (importedSettings.theme) {
                        state.isDarkMode = importedSettings.theme === 'dark';
                        ThemeManager.applyTheme();
                    }
                    
                    if (importedSettings.background) {
                        BackgroundManager.setBackground(importedSettings.background);
                    }
                    
                    if (importedSettings.customUrls) {
                        StorageManager.set(CONFIG.STORAGE_KEYS.CUSTOM_URLS, importedSettings.customUrls);
                    }
                    
                    if (importedSettings.settings) {
                        StorageManager.set(CONFIG.STORAGE_KEYS.SETTINGS, importedSettings.settings);
                        state.isCompactMode = importedSettings.settings.compactView || false;
                    }
                    
                    if (importedSettings.currentPaths) {
                        state.currentPaths = importedSettings.currentPaths;
                        StorageManager.set(CONFIG.STORAGE_KEYS.CURRENT_PATHS, state.currentPaths);
                    }
                    
                    // رندر مجدد
                    await Renderer.renderDashboard();
                    
                    resolve(true);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    static downloadFile(data, filename, type) {
        const blob = new Blob([data], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// ==================== رندرینگ و DOM ====================
class Renderer {
    static async renderDashboard() {
        const container = document.getElementById('grid-container');
        if (!container) return;
        
        container.innerHTML = '';
        document.body.classList.toggle('editing-mode', state.isEditMode);
        document.body.classList.toggle('compact-mode', state.isCompactMode);
        
        console.log('رندر کردن داشبورد با', state.bookmarks.length, 'بوکمارک');
        
        // اگر بوکمارکی نداریم، پیام نشان می‌دهیم
        if (state.bookmarks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>📚 بوکمارکی یافت نشد</h3>
                    <p>برای شروع، دکمه ویرایش را فشار داده و بوکمارک جدید اضافه کنید.</p>
                    <button id="add-first-bookmark" class="btn-success">افزودن اولین بوکمارک</button>
                </div>
            `;
            
            const addBtn = document.getElementById('add-first-bookmark');
            if (addBtn) {
                addBtn.addEventListener('click', () => {
                    document.getElementById('edit-mode-btn').click(); // وارد حالت ویرایش شو
                });
            }
            
            return;
        }
        
        // ساختاردهی بوکمارک‌ها بر اساس دسته‌بندی
        const categorizedBookmarks = this.categorizeBookmarks(state.bookmarks);
        console.log('دسته‌بندی‌ها:', Object.keys(categorizedBookmarks));
        
        // ایجاد کارت برای هر دسته‌بندی
        Object.entries(categorizedBookmarks).forEach(([category, items], index) => {
            const layout = state.layoutMap[category] || { 
                col: (index % 3) * 8 + 1, 
                row: Math.floor(index / 3) * 6 + 1, 
                w: 8, 
                h: 6,
                view: "list"
            };
            
            state.layoutMap[category] = layout;
            this.createCard(category, items, layout, container);
        });
        
        // ذخیره layout جدید
        StorageManager.set(CONFIG.STORAGE_KEYS.LAYOUT, state.layoutMap);
        
        // اعمال فیلتر جستجو
        if (state.searchTerm) {
            this.applySearchFilter(state.searchTerm);
        }
    }

// در کلاس Renderer این تابع رو عوض کن:
static categorizeBookmarks(bookmarks) {
    console.log('🔍 شروع دسته‌بندی بوکمارک‌ها:', bookmarks);
    
    const categories = {};
    
    // اگر bookmarks آرایه نیست، تبدیلش کن
    if (!Array.isArray(bookmarks)) {
        console.warn('⚠️ bookmarks آرایه نیست، تلاش برای تبدیل...');
        if (bookmarks.bookmarks && Array.isArray(bookmarks.bookmarks)) {
            bookmarks = bookmarks.bookmarks;
        } else if (typeof bookmarks === 'object') {
            bookmarks = Object.values(bookmarks);
        } else {
            console.error('❌ فرمت bookmarks نامعتبر است');
            return { 'سایر': [] };
        }
    }
    
    console.log(`📊 تعداد بوکمارک‌ها برای دسته‌بندی: ${bookmarks.length}`);
    
    // هر پوشه ریشه به عنوان یک دسته‌بندی
    bookmarks.forEach(folder => {
        if (!folder || !folder.title) return;
        
        // فقط پوشه‌ها رو به عنوان دسته‌بندی در نظر بگیر
        if (folder.type === 'folder' || folder.children) {
            const categoryName = folder.title;
            console.log(`➕ ایجاد دسته‌بندی: "${categoryName}"`);
            
            // فقط children پوشه رو ذخیره کن، نه خود پوشه رو
            categories[categoryName] = folder.children || [];
            
            // ذخیره اطلاعات پوشه اصلی برای استفاده در Breadcrumb
            if (folder.children) {
                folder.children.forEach(child => {
                    child._parentCategory = categoryName;
                    child._parentId = folder.id;
                });
            }
        } else {
            // اگر پوشه نیست، به دسته‌بندی "سایر" اضافه کن
            const category = folder.category || 'سایر';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(folder);
        }
    });
    
    console.log('✅ دسته‌بندی‌های ایجاد شده:', Object.keys(categories));
    
    // اگر هیچ دسته‌بندی ایجاد نشد
    if (Object.keys(categories).length === 0) {
        console.warn('⚠️ هیچ دسته‌بندی ایجاد نشد، ایجاد دسته‌بندی پیش‌فرض');
        categories['سایر'] = [];
    }
    
    return categories;
}

    static createCard(category, items, layout, container) {
        const card = document.createElement('div');
        card.className = 'bookmark-card';
        card.dataset.category = category;
        
        // تنظیم موقعیت و ابعاد
        card.style.gridColumnStart = layout.col;
        card.style.gridRowStart = layout.row;
        
        const actualWidthInPixels =
            (layout.w * CONFIG.GRID_CELL_SIZE) +
            ((layout.w - 1) * CONFIG.GRID_GAP) +
            CONFIG.HORIZONTAL_PIXEL_OFFSET;
        
        card.style.width = `${actualWidthInPixels}px`;
        card.style.gridColumnEnd = `span ${layout.w}`;
        card.style.gridRowEnd = `span ${layout.h}`;
        
        card.innerHTML = `
            <div class="card-header">
                <div class="card-title">${category}</div>
                <button class="card-btn btn-drag visible-on-edit">::</button>
            </div>
            <div class="card-breadcrumbs">
                <span class="crumb">خانه</span>
            </div>
            <div class="card-content">
                <div class="bookmark-tiles"></div>
            </div>
            <div class="resize-handle visible-on-edit"></div>
        `;
        
        // افزودن رویدادها
        const dragBtn = card.querySelector('.btn-drag');
        const titleEl = card.querySelector('.card-title');
        const resizeEl = card.querySelector('.resize-handle');
        
        // ویرایش نام دسته‌بندی
        if (titleEl) {
            titleEl.addEventListener('click', () => {
                if (state.isEditMode) {
                    const newName = prompt("نام جدید دسته‌بندی:", category);
                    if (newName && newName !== category) {
                        // به‌روزرسانی layoutMap با نام جدید
                        delete state.layoutMap[category];
                        state.layoutMap[newName] = layout;
                        
                        // به‌روزرسانی بوکمارک‌ها
                        state.bookmarks.forEach(bm => {
                            if (bm.category === category) {
                                bm.category = newName;
                            }
                        });
                        
                        this.renderDashboard();
                    }
                }
            });
        }
        
        if (dragBtn) {
            dragBtn.addEventListener('mousedown', (e) => DragResizeManager.startDrag(e, card));
        }
        
        if (resizeEl) {
            resizeEl.addEventListener('mousedown', (e) => DragResizeManager.startResize(e, card));
        }
        
        // رندر محتوا
        this.renderCardContent(card, items, layout.view || "list");
        container.appendChild(card);
    }


static async renderCardContent(cardEl, items, viewMode) {
    const tilesContainer = cardEl.querySelector('.bookmark-tiles');
    const breadcrumbs = cardEl.querySelector('.card-breadcrumbs');
    
    if (!tilesContainer) return;
    
    tilesContainer.innerHTML = '';
    tilesContainer.classList.toggle("view-grid", viewMode === "grid");
    tilesContainer.classList.toggle("view-list", viewMode === "list");
    
    const category = cardEl.dataset.category;
    const currentPath = state.currentPaths[category] || [];
    
    console.log('🎨 رندر کارت:', {
        category: category,
        path: currentPath,
        totalItems: items.length
    });
    
    // رندر Breadcrumb (نام دسته‌بندی به عنوان خانه)
    this.renderBreadcrumbs(breadcrumbs, category, currentPath, items);
    
    // دکمه‌های کنترل
    if (state.isEditMode && breadcrumbs) {
        this.addControlButtons(breadcrumbs, category, currentPath);
    }
    
    // دریافت آیتم‌های سطح فعلی
    try {
        const currentLevelItems = this.getCurrentLevelItems(category, items, currentPath);
        console.log(`📝 ${currentLevelItems?.length || 0} آیتم برای نمایش`);
        
        if (!currentLevelItems || currentLevelItems.length === 0) {
            tilesContainer.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #666;">
                    <p>📂 این پوشه خالی است</p>
                    ${state.isEditMode ? '<button class="btn-success" onclick="Renderer.openAddModal(\'' + category + '\', ' + JSON.stringify(currentPath) + ')">افزودن آیتم جدید</button>' : ''}
                </div>
            `;
            return;
        }
        
        // رندر آیتم‌ها
        for (const item of currentLevelItems) {
            const tile = await this.createTile(item, viewMode, category, currentPath);
            if (tile) {
                tilesContainer.appendChild(tile);
            }
        }
    } catch (error) {
        console.error('❌ خطا در رندر کارت:', error);
        tilesContainer.innerHTML = `
            <div class="error-message">
                <p>خطا در بارگذاری محتوا</p>
                <button onclick="location.reload()">بارگذاری مجدد</button>
            </div>
        `;
    }
}

static getCurrentLevelItems(category, items, currentPath) {
    console.log('🔍 دریافت آیتم‌های سطح:', {
        category: category,
        currentPath: currentPath,
        itemsCount: items.length
    });
    
    // items در اینجا children پوشه اصلی هستند
    // اگر در ریشه هستیم، همه children های پوشه اصلی رو برگردون
    if (!currentPath || currentPath.length === 0) {
        console.log('📁 حالت ریشه - نمایش کودکان پوشه اصلی');
        return items;
    }
    
    console.log('📂 حالت داخل پوشه - مسیر:', currentPath);
    
    // حرکت در مسیر پوشه‌های تو در تو
    let currentLevel = items;
    
    for (let i = 0; i < currentPath.length; i++) {
        const folderId = currentPath[i];
        console.log(`   ↪️ سطح ${i + 1}: جستجوی پوشه ${folderId}`);
        
        const nextFolder = currentLevel.find(item => 
            item.id === folderId && (item.type === 'folder' || item.children)
        );
        
        if (!nextFolder) {
            console.error(`❌ پوشه ${folderId} پیدا نشد`);
            return [];
        }
        
        // اگر آخرین سطح مسیر هستیم
        if (i === currentPath.length - 1) {
            console.log('✅ آخرین سطح مسیر رسیدیم');
            return nextFolder.children || [];
        }
        
        // به سطح بعد برو
        currentLevel = nextFolder.children || [];
    }
    
    return currentLevel;
}


// ==================== تابع renderBreadcrumbs اصلاح شده ====================
static renderBreadcrumbs(breadcrumbsEl, category, currentPath, allItems) {
    console.log('🔄 شروع Breadcrumb...');
    
    if (!breadcrumbsEl) {
        console.warn('Breadcrumbs element پیدا نشد');
        return;
    }
    
    // پاک کردن
    breadcrumbsEl.innerHTML = '';
    
    // ذخیره context برای استفاده در event handlerها
    const context = {
        category: category,
        navigate: this.navigateToPath.bind(this)
    };
    
    // 1. خانه
    const homeBtn = this.createBreadcrumbButton('خانه', [], context);
    breadcrumbsEl.appendChild(homeBtn);
    
    // 2. مسیرها
    if (currentPath && currentPath.length > 0) {
        console.log('🗺️ ساختن مسیر Breadcrumb:', currentPath);
        
        let accumulatedPath = [];
        let currentItems = allItems;
        
        for (let i = 0; i < currentPath.length; i++) {
            const folderId = currentPath[i];
            
            // جداکننده
            const separator = document.createElement('span');
            separator.textContent = ' › ';
            separator.style.margin = '0 8px';
            separator.style.color = '#666';
            breadcrumbsEl.appendChild(separator);
            
            // پیدا کردن نام پوشه
            let folderName = `پوشه ${i + 1}`;
            if (currentItems && Array.isArray(currentItems)) {
                const folder = currentItems.find(item => item && item.id === folderId);
                if (folder && folder.title) {
                    folderName = folder.title;
                }
            }
            
            // دکمه پوشه
            accumulatedPath = currentPath.slice(0, i + 1);
            const folderBtn = this.createBreadcrumbButton(folderName, accumulatedPath, context);
            breadcrumbsEl.appendChild(folderBtn);
            
            // بروزرسانی currentItems برای سطح بعدی
            if (currentItems && Array.isArray(currentItems)) {
                const folder = currentItems.find(item => item && item.id === folderId);
                if (folder && folder.children) {
                    currentItems = folder.children;
                }
            }
        }
    }
    
    console.log('✅ Breadcrumb ساخته شد');
}

// تابع کمکی برای ایجاد دکمه‌های Breadcrumb
static createBreadcrumbButton(text, path, context) {
    const button = document.createElement('button');
    button.textContent = text;
    button.className = 'crumb';
    
    // استایل پایه
    Object.assign(button.style, {
        background: 'none',
        border: 'none',
        color: 'var(--primary-color, #007bff)',
        cursor: 'pointer',
        padding: '4px 8px',
        margin: '0 2px',
        fontSize: '14px',
        fontFamily: 'inherit',
        textDecoration: 'underline'
    });
    
    // Event handler
    button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log(`📍 کلیک Breadcrumb: "${text}" ->`, path);
        
        if (context.navigate) {
            context.navigate(context.category, path);
        } else {
            console.error('تابع navigate وجود ندارد');
        }
    });
    
    return button;
}

// ==================== تابع ساده برای پیدا کردن نام پوشه ====================
static findFolderName(allItems, category, folderId, pathSoFar) {
    try {
        // ابتدا آیتم‌های این دسته رو پیدا کن
        let items = allItems.filter(item => item.category === category);
        
        // در مسیر حرکت کن
        for (const id of pathSoFar) {
            const folder = items.find(item => item.id === id);
            if (folder && folder.children) {
                items = folder.children;
            }
        }
        
        // پوشه مورد نظر رو پیدا کن
        const folder = items.find(item => item.id === folderId);
        return folder ? folder.title : 'پوشه';
    } catch (error) {
        console.error('خطا در پیدا کردن نام پوشه:', error);
        return 'پوشه';
    }
}


// ==================== تابع navigateToPath با لاگ بیشتر ====================
static navigateToPath(category, newPath) {
    console.log('========== ناوبری ==========');
    console.log('دسته‌بندی:', category);
    console.log('مسیر جدید:', newPath);
    console.log('مسیر قبلی:', state.currentPaths[category]);
    
    state.currentPaths[category] = newPath;
    StorageManager.set(CONFIG.STORAGE_KEYS.CURRENT_PATHS, state.currentPaths);
    
    console.log('ذخیره شد:', StorageManager.get(CONFIG.STORAGE_KEYS.CURRENT_PATHS));
    
    // رندر مجدد
    this.renderDashboard();
}




static async createTile(item, viewMode, category, currentPath) {
    try {
        const isFolder = item.type === 'folder' || item.children;
        const tile = document.createElement(isFolder ? "div" : "a");
        tile.className = "tile";
        tile.dataset.id = item.id;
        tile.dataset.category = category;
        
        if (isFolder) {
            tile.classList.add("tile-folder");
            
            tile.addEventListener("click", (e) => {
                e.preventDefault();
                if (!state.isEditMode) {
                    // وارد پوشه بشو
                    const newPath = [...(currentPath || []), item.id];
                    console.log('ورود به پوشه:', item.title, 'مسیر:', newPath);
                    this.navigateToPath(category, newPath);
                }
            });
        } else if (item.url) {
            tile.href = item.url;
            tile.target = "_blank";
            tile.rel = "noopener noreferrer";
        }
        
        tile.classList.toggle("tile-grid-mode", viewMode === "grid");
        
        // آیکون
        const img = document.createElement("img");
        img.className = "tile-icon";
        
        if (isFolder) {
            img.src = CONFIG.FOLDER_ICON_PATH;
			
		} else if (item.url) {
        const customIcon = state.customIcons[item.url];
        if (customIcon) {
            img.src = customIcon; // استفاده از آیکون گیت‌هاب شما
        } else {
            img.src = CONFIG.FALLBACK_ICON_PATH;
            setTimeout(async () => {
                try {
                    const icon = await FaviconManager.resolveFavicon(item.url);
                    if (img && !customIcon) img.src = icon;
                } catch (error) { console.error(error); }
            }, 0);
        }
		
        } else {
            img.src = CONFIG.FALLBACK_ICON_PATH;
        }
        
        // نام
        const nameDiv = document.createElement("div");
        nameDiv.className = "tile-name";
        nameDiv.textContent = item.title;
//		nameDiv.style.marginTop = "-12px"; 
//        nameDiv.style.height = "35px";
//        nameDiv.style.fontSize = "11px";
        nameDiv.title = item.description || item.title;
        
        // دکمه ویرایش
        const editBtn = document.createElement("div");
        editBtn.className = "tile-edit-btn";
        editBtn.textContent = "✏️";
        editBtn.title = "ویرایش";
        
        editBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openEditModal(item, category, currentPath);
        });
        
        tile.appendChild(img);
        tile.appendChild(nameDiv);
        
        if (state.isEditMode) {
            tile.appendChild(editBtn);
        }
        
        return tile;
    } catch (error) {
        console.error('خطا در ایجاد tile:', error, item);
        return null;
    }
}

// ==================== تابع addControlButtons رو کامل بازنویسی می‌کنیم ====================
static addControlButtons(breadcrumbs, category, currentPath) {
    if (!breadcrumbs) return;
    
    console.log('اضافه کردن دکمه‌های کنترل برای:', category);
    
    // پاک کردن دکمه‌های قبلی
    breadcrumbs.querySelectorAll('.card-control-btn').forEach(btn => btn.remove());
    
    // فقط اگر در حالت ویرایش هستیم دکمه‌ها رو اضافه کن
    if (!state.isEditMode) return;
    
    // 1. دکمه حذف دسته‌بندی (فقط در ریشه)
    if (!currentPath || currentPath.length === 0) {
        const delBtn = document.createElement('button');
        delBtn.className = "card-control-btn btn-del-crumb";
        delBtn.innerHTML = "❌";
        delBtn.title = "حذف این دسته‌بندی";
        
        delBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('کلیک روی حذف دسته‌بندی');
            
            if (confirm(`آیا از حذف دسته‌بندی "${category}" مطمئن هستید؟`)) {
                delete state.layoutMap[category];
                state.bookmarks = state.bookmarks.filter(b => b.category !== category);
                delete state.currentPaths[category];
                this.renderDashboard();
            }
        });
        
        breadcrumbs.appendChild(delBtn);
    }
    
    // 2. دکمه افزودن آیتم
    const addBtn = document.createElement('button');
    addBtn.className = "card-control-btn btn-add-crumb";
    addBtn.innerHTML = "➕";
    addBtn.title = "افزودن آیتم جدید";
    
    addBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('کلیک روی افزودن آیتم');
        this.openAddModal(category, currentPath);
    });
    
    breadcrumbs.appendChild(addBtn);
    
    // 3. دکمه تغییر حالت نمایش
    const viewBtn = document.createElement('button');
    viewBtn.className = "card-control-btn btn-view-crumb";
    viewBtn.innerHTML = "👁️";
    viewBtn.title = "تغییر حالت نمایش";
    
    viewBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('کلیک روی تغییر حالت نمایش');
        
        const layout = state.layoutMap[category];
        if (layout) {
            layout.view = layout.view === "grid" ? "list" : "grid";
            StorageManager.set(CONFIG.STORAGE_KEYS.LAYOUT, state.layoutMap);
            this.renderDashboard();
        }
    });
    
    breadcrumbs.appendChild(viewBtn);
    
    // 4. دکمه برگشت (اگر در پوشه‌ای هستیم)
    if (currentPath && currentPath.length > 0) {
        const backBtn = document.createElement('button');
        backBtn.className = "card-control-btn btn-back-crumb";
        backBtn.innerHTML = "↩️";
        backBtn.title = "برگشت به سطح قبل";
        
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('کلیک روی برگشت');
            
            const newPath = currentPath.slice(0, -1);
            this.navigateToPath(category, newPath);
        });
        
        breadcrumbs.appendChild(backBtn);
    }
    
    console.log('تعداد دکمه‌های اضافه شده:', breadcrumbs.querySelectorAll('.card-control-btn').length);
}




    static openAddModal(category, currentPath) {
        const modal = document.getElementById('bookmark-modal');
        if (!modal) return;
        
        // ذخیره اطلاعات موقعیت
        modal.dataset.category = category;
        modal.dataset.currentPath = JSON.stringify(currentPath || []);
        
        // ریست فرم
        const form = document.getElementById('bookmark-form');
        if (form) form.reset();
        
        const typeSelect = document.getElementById('bookmark-type');
        const categoryInput = document.getElementById('bookmark-category');
        
        if (typeSelect) typeSelect.value = 'bookmark';
        if (categoryInput) categoryInput.value = category;
        
        this.updateModalFields();
        
        // مخفی کردن دکمه حذف
        const deleteBtn = document.getElementById('delete-btn');
        if (deleteBtn) deleteBtn.classList.add('hidden');
        
        modal.classList.remove('hidden');
        state.currentModal = 'add';
    }

    static openEditModal(item, category, currentPath) {
        const modal = document.getElementById('bookmark-modal');
        if (!modal) return;
        
        // ذخیره اطلاعات موقعیت
        modal.dataset.category = category;
        modal.dataset.currentPath = JSON.stringify(currentPath || []);
        
        const editingItemId = document.getElementById('editing-item-id');
        if (editingItemId) editingItemId.value = item.id;
        
        // پر کردن فرم
        const nameInput = document.getElementById('bookmark-name');
        const urlInput = document.getElementById('bookmark-url');
        const typeSelect = document.getElementById('bookmark-type');
        const categoryInput = document.getElementById('bookmark-category');
        const tagsInput = document.getElementById('bookmark-tags');
        const descInput = document.getElementById('bookmark-description');
        
        if (nameInput) nameInput.value = item.title || '';
        if (urlInput) urlInput.value = item.url || '';
        if (typeSelect) typeSelect.value = item.type === 'folder' ? 'folder' : 'bookmark';
        if (categoryInput) categoryInput.value = item.category || 'سایر';
        if (tagsInput) tagsInput.value = item.tags ? item.tags.join(', ') : '';
        if (descInput) descInput.value = item.description || '';
        
        this.updateModalFields();
        
        // نمایش دکمه حذف
        const deleteBtn = document.getElementById('delete-btn');
        if (deleteBtn) deleteBtn.classList.remove('hidden');
        
        modal.classList.remove('hidden');
        state.currentModal = 'edit';
    }

    static updateModalFields() {
        const typeSelect = document.getElementById('bookmark-type');
        if (!typeSelect) return;
        
        const type = typeSelect.value;
        const urlGroup = document.getElementById('url-field-group');
        
        if (urlGroup) {
            urlGroup.style.display = type === 'bookmark' ? 'block' : 'none';
        }
    }

    static applySearchFilter(searchTerm) {
        const tiles = document.querySelectorAll('.tile');
        tiles.forEach(tile => {
            const title = tile.querySelector('.tile-name')?.textContent.toLowerCase() || '';
            const category = tile.dataset.category?.toLowerCase() || '';
            const tags = tile.dataset.tags?.toLowerCase() || '';
            
            const matches = title.includes(searchTerm) || 
                           category.includes(searchTerm) || 
                           tags.includes(searchTerm);
            
            tile.classList.toggle('filtered-out', !matches);
            tile.classList.toggle('highlighted', matches && searchTerm.length > 0);
        });
    }
}

// ==================== Event Handlers ====================
class EventManager {
    static setup() {
        console.log('تنظیم رویدادها...');
        
        // دکمه حالت ویرایش
        const editModeBtn = document.getElementById('edit-mode-btn');
        if (editModeBtn) {
            editModeBtn.addEventListener('click', () => {
                state.isEditMode = !state.isEditMode;
                const subControls = document.getElementById('sub-controls');
                
                editModeBtn.textContent = state.isEditMode ? '✅' : '✏️';
                editModeBtn.title = state.isEditMode ? 'خروج از حالت ویرایش' : 'حالت ویرایش';
                
                if (subControls) {
                    if (state.isEditMode) {
                        subControls.classList.remove('hidden-controls');
                        subControls.classList.add('visible-controls');
                    } else {
                        subControls.classList.remove('visible-controls');
                        subControls.classList.add('hidden-controls');
                    }
                }
                
                Renderer.renderDashboard();
            });
        }
        
        // دکمه به‌روزرسانی بوکمارک‌ها
        const refreshBtn = document.getElementById('refresh-bookmarks-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                if (!confirm('آیا از به‌روزرسانی بوکمارک‌ها از منبع مرکزی اطمینان دارید؟')) return;
                
                try {
                    const success = await BookmarkManager.refreshCentralBookmarks();
                    if (success) {
                        alert('بوکمارک‌ها با موفقیت به‌روزرسانی شدند.');
                        await Renderer.renderDashboard();
                    } else {
                        alert('خطا در به‌روزرسانی بوکمارک‌ها.');
                    }
                } catch (error) {
                    alert('خطا در به‌روزرسانی: ' + error.message);
                }
            });
        }
        
        // دکمه تغییر تم
        const themeBtn = document.getElementById('toggle-theme-btn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                ThemeManager.toggleTheme();
            });
        }
        
        // دکمه جستجو
        const searchBtn = document.getElementById('search-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const searchContainer = document.getElementById('search-container');
                searchContainer?.classList.toggle('hidden');
                
                if (searchContainer && !searchContainer.classList.contains('hidden')) {
                    const searchInput = document.getElementById('bookmark-search');
                    if (searchInput) searchInput.focus();
                }
            });
        }
        
        // دکمه بستن جستجو
        const closeSearchBtn = document.getElementById('close-search');
        if (closeSearchBtn) {
            closeSearchBtn.addEventListener('click', () => {
                const searchContainer = document.getElementById('search-container');
                searchContainer?.classList.add('hidden');
                state.searchTerm = '';
                
                const searchInput = document.getElementById('bookmark-search');
                if (searchInput) searchInput.value = '';
                
                Renderer.applySearchFilter('');
            });
        }
        
        // ورودی جستجو
        const searchInput = document.getElementById('bookmark-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                state.searchTerm = e.target.value.toLowerCase().trim();
                Renderer.applySearchFilter(state.searchTerm);
            });
        }
        
        // دکمه پس‌زمینه
        const bgBtn = document.getElementById('set-background-btn');
        if (bgBtn) {
            bgBtn.addEventListener('click', () => {
                const bgInput = document.getElementById('background-file-input');
                if (bgInput) bgInput.click();
            });
        }
        
        // Import/Export بوکمارک‌ها
        const exportBookmarksBtn = document.getElementById('export-bookmarks-btn');
        if (exportBookmarksBtn) {
            exportBookmarksBtn.addEventListener('click', () => {
                ImportExportManager.exportBookmarks();
            });
        }
        
        const importBookmarksBtn = document.getElementById('import-bookmarks-btn');
        if (importBookmarksBtn) {
            importBookmarksBtn.addEventListener('click', () => {
                const importInput = document.getElementById('import-bookmarks-file');
                if (importInput) importInput.click();
            });
        }
        
        // Import/Export تنظیمات
        const exportSettingsBtn = document.getElementById('export-settings-btn');
        if (exportSettingsBtn) {
            exportSettingsBtn.addEventListener('click', () => {
                ImportExportManager.exportSettings();
            });
        }
        
        const importSettingsBtn = document.getElementById('import-settings-btn');
        if (importSettingsBtn) {
            importSettingsBtn.addEventListener('click', () => {
                const importInput = document.getElementById('import-settings-file');
                if (importInput) importInput.click();
            });
        }
        
        // مدیریت فایل‌های import
        const importBookmarksFile = document.getElementById('import-bookmarks-file');
        if (importBookmarksFile) {
            importBookmarksFile.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                if (confirm('آیا از وارد کردن بوکمارک‌ها اطمینان دارید؟')) {
                    try {
                        await ImportExportManager.importBookmarks(file);
                        alert('بوکمارک‌ها با موفقیت وارد شدند.');
                    } catch (error) {
                        alert('خطا در وارد کردن بوکمارک‌ها: ' + error.message);
                    }
                }
                
                e.target.value = '';
            });
        }
        
        const importSettingsFile = document.getElementById('import-settings-file');
        if (importSettingsFile) {
            importSettingsFile.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                if (confirm('آیا از وارد کردن تنظیمات اطمینان دارید؟')) {
                    try {
                        await ImportExportManager.importSettings(file);
                        alert('تنظیمات با موفقیت وارد شدند.');
                    } catch (error) {
                        alert('خطا در وارد کردن تنظیمات: ' + error.message);
                    }
                }
                
                e.target.value = '';
            });
        }
        
        const backgroundFileInput = document.getElementById('background-file-input');
        if (backgroundFileInput) {
            backgroundFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = (event) => {
                    BackgroundManager.setBackground(event.target.result);
                };
                reader.readAsDataURL(file);
                e.target.value = '';
            });
        }
        
        // مدیریت Modal
        const cancelBtn = document.getElementById('cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                const modal = document.getElementById('bookmark-modal');
                if (modal) modal.classList.add('hidden');
            });
        }
        
        const bookmarkForm = document.getElementById('bookmark-form');
        if (bookmarkForm) {
            bookmarkForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = {
                    title: document.getElementById('bookmark-name')?.value || '',
                    type: document.getElementById('bookmark-type')?.value || 'bookmark',
                    url: document.getElementById('bookmark-url')?.value || '',
                    category: document.getElementById('bookmark-category')?.value || 'سایر',
                    tags: document.getElementById('bookmark-tags')?.value?.split(',').map(t => t.trim()).filter(t => t) || [],
                    description: document.getElementById('bookmark-description')?.value || ''
                };
                
                const modal = document.getElementById('bookmark-modal');
                const category = modal?.dataset.category;
                const currentPath = modal?.dataset.currentPath ? JSON.parse(modal.dataset.currentPath) : [];
                const itemId = document.getElementById('editing-item-id')?.value;
                
                // اضافه کردن parentPath اگر در پوشه‌ای هستیم
                if (currentPath && currentPath.length > 0) {
                    formData.parentPath = currentPath;
                }
                
                try {
                    if (itemId) {
                        // ویرایش بوکمارک موجود
                        BookmarkManager.updateUserBookmark(itemId, formData);
                    } else {
                        // افزودن بوکمارک جدید
                        BookmarkManager.addUserBookmark(formData);
                    }
                    
                    if (modal) modal.classList.add('hidden');
                    
                    await Renderer.renderDashboard();
                } catch (error) {
                    alert('خطا در ذخیره بوکمارک: ' + error.message);
                }
            });
        }
        
        const deleteBtn = document.getElementById('delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                const itemId = document.getElementById('editing-item-id')?.value;
                
                if (confirm('آیا از حذف این آیتم اطمینان دارید؟')) {
                    try {
                        BookmarkManager.deleteUserBookmark(itemId);
                        const modal = document.getElementById('bookmark-modal');
                        if (modal) modal.classList.add('hidden');
                        await Renderer.renderDashboard();
                    } catch (error) {
                        alert('خطا در حذف بوکمارک: ' + error.message);
                    }
                }
            });
        }
        
        const bookmarkType = document.getElementById('bookmark-type');
        if (bookmarkType) {
            bookmarkType.addEventListener('change', () => {
                Renderer.updateModalFields();
            });
        }
        
        // تنظیمات پیشرفته
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                const modal = document.getElementById('settings-modal');
                if (modal) modal.classList.remove('hidden');
                this.loadSettingsForm();
            });
        }
        
        const closeSettingsBtn = document.getElementById('close-settings-btn');
        if (closeSettingsBtn) {
            closeSettingsBtn.addEventListener('click', () => {
                const modal = document.getElementById('settings-modal');
                if (modal) modal.classList.add('hidden');
            });
        }
        
        const saveSettingsBtn = document.getElementById('save-settings-btn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', async () => {
                await this.saveSettings();
                const modal = document.getElementById('settings-modal');
                if (modal) modal.classList.add('hidden');
            });
        }
        
        const clearCacheBtn = document.getElementById('clear-cache-btn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', async () => {
                if (confirm('آیا از پاک کردن کش اطمینان دارید؟')) {
                    FaviconManager.clearCache();
                    alert('کش با موفقیت پاک شد.');
                }
            });
        }
        
        const resetAllBtn = document.getElementById('reset-all-btn');
        if (resetAllBtn) {
            resetAllBtn.addEventListener('click', async () => {
                if (confirm('آیا از بازنشانی همه تنظیمات اطمینان دارید؟ این عمل قابل بازگشت نیست.')) {
                    StorageManager.clearAll();
                    location.reload();
                }
            });
        }
    }
    
    static loadSettingsForm() {
        const settings = StorageManager.get(CONFIG.STORAGE_KEYS.SETTINGS) || {};
        const customUrls = StorageManager.get(CONFIG.STORAGE_KEYS.CUSTOM_URLS) || {};
        
        const autoDarkMode = document.getElementById('auto-dark-mode');
        const compactView = document.getElementById('compact-view');
        const bookmarksJsonUrl = document.getElementById('bookmarks-json-url');
        
        if (autoDarkMode) autoDarkMode.checked = settings.autoDarkMode || false;
        if (compactView) compactView.checked = settings.compactView || false;
        if (bookmarksJsonUrl) bookmarksJsonUrl.value = customUrls.bookmarks || CONFIG.BOOKMARKS_JSON_URL;
    }
    
    static async saveSettings() {
        const autoDarkMode = document.getElementById('auto-dark-mode');
        const compactView = document.getElementById('compact-view');
        const bookmarksJsonUrl = document.getElementById('bookmarks-json-url');
        
        const settings = {
            autoDarkMode: autoDarkMode?.checked || false,
            compactView: compactView?.checked || false
        };
        
        const customUrls = {
            bookmarks: bookmarksJsonUrl?.value || CONFIG.BOOKMARKS_JSON_URL
        };
        
        StorageManager.set(CONFIG.STORAGE_KEYS.SETTINGS, settings);
        StorageManager.set(CONFIG.STORAGE_KEYS.CUSTOM_URLS, customUrls);
        
        state.isCompactMode = settings.compactView;
        await Renderer.renderDashboard();
        
        alert('تنظیمات با موفقیت ذخیره شدند.');
    }
}

// ==================== Initialize Application ====================
class App {
    static async init() {
        try {
            console.log('راه‌اندازی برنامه...');
            
            ThemeManager.init();
            BackgroundManager.applySavedBackground();
            
            state.layoutMap = StorageManager.get(CONFIG.STORAGE_KEYS.LAYOUT) || {};
            state.currentPaths = StorageManager.get(CONFIG.STORAGE_KEYS.CURRENT_PATHS) || {};
            
            await BookmarkManager.loadBookmarks();
            EventManager.setup();

            // --- بخش اعمال تنظیمات خودکار از سرور ---
            const settingsApplied = StorageManager.get('netcofe_settings_applied');
            if (!settingsApplied) {
                try {
                    const response = await fetch(CONFIG.SETTINGS_JSON_URL);
                    if (response.ok) {
                        const importedSettings = await response.json();
                        
                        // دقیقاً کارهایی که importSettings انجام می‌دهد را اینجا تکرار می‌کنیم
                        if (importedSettings.layout) {
                            state.layoutMap = importedSettings.layout;
                            StorageManager.set(CONFIG.STORAGE_KEYS.LAYOUT, state.layoutMap);
                        }
                        if (importedSettings.theme) {
                            state.isDarkMode = importedSettings.theme === 'dark';
                            ThemeManager.applyTheme();
                        }
                        if (importedSettings.background) {
                            BackgroundManager.setBackground(importedSettings.background);
                        }
                        if (importedSettings.customUrls) {
                            StorageManager.set(CONFIG.STORAGE_KEYS.CUSTOM_URLS, importedSettings.customUrls);
                        }
                        if (importedSettings.settings) {
                            StorageManager.set(CONFIG.STORAGE_KEYS.SETTINGS, importedSettings.settings);
                            state.isCompactMode = importedSettings.settings.compactView || false;
                        }

                        StorageManager.set('netcofe_settings_applied', true);
                        console.log('✅ تنظیمات اولیه با موفقیت از سرور اعمال شد.');
                    }
                } catch (e) {
                    console.error('❌ خطا در دریافت فایل تنظیمات:', e);
                }
            }
            // ---------------------------------------

            await Renderer.renderDashboard();
            
            const firstRun = !StorageManager.get('netcofe_first_run');
            if (firstRun) {
                StorageManager.set('netcofe_first_run', true);
                setTimeout(() => {
                    alert('🎉 به همیار کافینت خوش آمدید!');
                }, 1000);
            }
            
        } catch (error) {
            console.error('❌ خطا در راه‌اندازی:', error);
            const container = document.getElementById('grid-container');
            if (container) {
                container.innerHTML = `<div class="error-state"><h3>❌ خطا در راه‌اندازی</h3><p>${error.message}</p></div>`;
            }
        }
    }
}


// ==================== راه‌اندازی برنامه ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM آماده است.');
    App.init();
    
    // نمایش وضعیت آنلاین/آفلاین
    const updateOnlineStatus = () => {
        const indicator = document.getElementById('offline-indicator');
        if (indicator) {
            indicator.classList.toggle('hidden', navigator.onLine);
        }
    };
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
});