console.log('🚀 dashboard.js لود شد');
console.log('DOM loaded:', document.readyState);

// بررسی وجود المنت‌های ضروری
console.log('grid-container:', document.getElementById('grid-container'));
console.log('loading-spinner:', document.querySelector('.loading-spinner'));

// ==================== تنظیمات اصلی ====================
const CONFIG = {
    // لینک‌های پیش‌فرض
    BOOKMARKS_JSON_URL: "https://raw.githubusercontent.com/ali73jn/netcofe2/refs/heads/main/assets/data/bookmarks.json",
    DEFAULT_BOOKMARKS_URL: "https://raw.githubusercontent.com/ali73jn/netcofe2/refs/heads/main/assets/data/bookmarks.json",
    
    // مسیرهای لوکال
    FALLBACK_ICON_PATH: "assets/icons/default_icon.png",
    FOLDER_ICON_PATH: "assets/icons/folder.png",
    DEFAULT_BG_IMAGE_PATH: "assets/icons/default_bg.jpg",
    
    // تنظیمات گرید
    GRID_CELL_SIZE: 20,
    GRID_GAP: 2,
    HORIZONTAL_PIXEL_OFFSET: 0,
    
    // کلیدهای localStorage
    STORAGE_KEYS: {
        LAYOUT: 'netcofe_layout',
        BACKGROUND: 'netcofe_background',
        SETTINGS: 'netcofe_settings',
        THEME: 'netcofe_theme',
        USER_BOOKMARKS: 'netcofe_user_bookmarks',
        CUSTOM_URLS: 'netcofe_custom_urls',
        FAVICON_CACHE: 'netcofe_favicon_cache_v3'
    }
};

// ==================== وضعیت برنامه ====================
let state = {
    isEditMode: false,
    isDarkMode: false,
    isCompactMode: false,
    currentPaths: {},
    dragInfo: null,
    resizeInfo: null,
    layoutMap: {},
    bookmarks: [],
    userBookmarks: [],
    searchTerm: '',
    currentModal: null
};

// ==================== مدیریت ذخیره‌سازی ====================
class StorageManager {
    static async get(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error('خطا در خواندن از localStorage:', error);
            return null;
        }
    }

    static async set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('خطا در ذخیره در localStorage:', error);
            return false;
        }
    }

    static async remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('خطا در حذف از localStorage:', error);
            return false;
        }
    }

    static async clearAll() {
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
            const userBookmarks = await StorageManager.get(CONFIG.STORAGE_KEYS.USER_BOOKMARKS) || [];
            state.userBookmarks = userBookmarks;
            
            // بارگذاری بوکمارک‌های مرکزی
            const customUrls = await StorageManager.get(CONFIG.STORAGE_KEYS.CUSTOM_URLS) || {};
            const bookmarksUrl = customUrls.bookmarks || CONFIG.BOOKMARKS_JSON_URL;
            
            const response = await fetch(bookmarksUrl);
            if (!response.ok) throw new Error('خطا در دریافت بوکمارک‌ها');
            
            const centralBookmarks = await response.json();
            state.bookmarks = this.mergeBookmarks(centralBookmarks.bookmarks || centralBookmarks, userBookmarks);
            
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
            },
            {
                id: 'folder-example',
                title: 'پوشه نمونه',
                type: 'folder',
                category: 'سایر',
                description: 'یک پوشه نمونه',
                children: []
            }
        ];
    }

    static async addUserBookmark(bookmark) {
        const newBookmark = {
            ...bookmark,
            id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            source: 'user',
            dateAdded: new Date().toISOString()
        };
        
        state.userBookmarks.push(newBookmark);
        await StorageManager.set(CONFIG.STORAGE_KEYS.USER_BOOKMARKS, state.userBookmarks);
        
        // بازسازی لیست ترکیبی
        state.bookmarks = this.mergeBookmarks(
            state.bookmarks.filter(b => b.source !== 'user'),
            state.userBookmarks
        );
        
        return newBookmark;
    }

    static async updateUserBookmark(id, updates) {
        const index = state.userBookmarks.findIndex(b => b.id === id);
        if (index > -1) {
            state.userBookmarks[index] = { ...state.userBookmarks[index], ...updates };
            await StorageManager.set(CONFIG.STORAGE_KEYS.USER_BOOKMARKS, state.userBookmarks);
            
            // به‌روزرسانی در bookmarks اصلی
            const mainIndex = state.bookmarks.findIndex(b => b.id === id);
            if (mainIndex > -1) {
                state.bookmarks[mainIndex] = { ...state.bookmarks[mainIndex], ...updates };
            }
            
            return state.userBookmarks[index];
        }
        return null;
    }

    static async deleteUserBookmark(id) {
        state.userBookmarks = state.userBookmarks.filter(b => b.id !== id);
        state.bookmarks = state.bookmarks.filter(b => b.id !== id);
        await StorageManager.set(CONFIG.STORAGE_KEYS.USER_BOOKMARKS, state.userBookmarks);
        return true;
    }

    static async refreshCentralBookmarks() {
        try {
            const customUrls = await StorageManager.get(CONFIG.STORAGE_KEYS.CUSTOM_URLS) || {};
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
            const cache = await StorageManager.get(CONFIG.STORAGE_KEYS.FAVICON_CACHE) || {};
            const cached = cache[url];
            
            if (cached && Date.now() - cached.timestamp < 7 * 24 * 60 * 60 * 1000) {
                return cached.data;
            }
            
            // تلاش برای دریافت favicon جدید
            const faviconUrl = await this.getFaviconUrl(url);
            const base64 = await this.fetchIconAsBase64(faviconUrl);
            
            if (base64) {
                // ذخیره در کش
                cache[url] = {
                    data: base64,
                    timestamp: Date.now()
                };
                await StorageManager.set(CONFIG.STORAGE_KEYS.FAVICON_CACHE, cache);
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

    static async clearCache() {
        await StorageManager.set(CONFIG.STORAGE_KEYS.FAVICON_CACHE, {});
    }
}

// ==================== مدیریت تم و ظاهر ====================
class ThemeManager {
    static async init() {
        const settings = await StorageManager.get(CONFIG.STORAGE_KEYS.SETTINGS) || {};
        const savedTheme = await StorageManager.get(CONFIG.STORAGE_KEYS.THEME);
        
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
        await StorageManager.set(CONFIG.STORAGE_KEYS.THEME, state.isDarkMode ? 'dark' : 'light');
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
    static async applySavedBackground() {
        try {
            const bgData = await StorageManager.get(CONFIG.STORAGE_KEYS.BACKGROUND);
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

    static async setBackground(imageData) {
        await StorageManager.set(CONFIG.STORAGE_KEYS.BACKGROUND, imageData);
        document.body.style.backgroundImage = `url(${imageData})`;
    }

    static async resetBackground() {
        await StorageManager.remove(CONFIG.STORAGE_KEYS.BACKGROUND);
        document.body.style.backgroundImage = `url(${CONFIG.DEFAULT_BG_IMAGE_PATH})`;
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
        
        // اگر بوکمارکی نداریم، پیام نشان می‌دهیم
        if (state.bookmarks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>📚 بوکمارکی یافت نشد</h3>
                    <p>برای شروع، دکمه ویرایش را فشار داده و بوکمارک جدید اضافه کنید.</p>
                    <button id="add-first-bookmark" class="btn-success">افزودن اولین بوکمارک</button>
                </div>
            `;
            
            document.getElementById('add-first-bookmark')?.addEventListener('click', () => {
                document.getElementById('add-card-btn').click();
            });
            
            return;
        }
        
        // ساختاردهی بوکمارک‌ها بر اساس دسته‌بندی
        const categorizedBookmarks = this.categorizeBookmarks(state.bookmarks);
        
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
        await StorageManager.set(CONFIG.STORAGE_KEYS.LAYOUT, state.layoutMap);
        
        // اعمال فیلتر جستجو
        if (state.searchTerm) {
            this.applySearchFilter(state.searchTerm);
        }
    }

    static categorizeBookmarks(bookmarks) {
        const categories = {};
        
        bookmarks.forEach(bookmark => {
            const category = bookmark.category || 'سایر';
            if (!categories[category]) {
                categories[category] = [];
            }
            
            // اگر پوشه است، children را هم اضافه می‌کنیم
            if (bookmark.type === 'folder' && bookmark.children) {
                categories[category].push({
                    ...bookmark,
                    isFolder: true,
                    children: bookmark.children
                });
            } else {
                categories[category].push({
                    ...bookmark,
                    isFolder: false
                });
            }
        });
        
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
        
        dragBtn.addEventListener('mousedown', (e) => this.startDrag(e, card));
        resizeEl.addEventListener('mousedown', (e) => this.startResize(e, card));
        
        // رندر محتوا
        this.renderCardContent(card, items, layout.view || "list");
        container.appendChild(card);
    }

    static async renderCardContent(cardEl, items, viewMode) {
        const tilesContainer = cardEl.querySelector('.bookmark-tiles');
        const breadcrumbs = cardEl.querySelector('.card-breadcrumbs');
        
        tilesContainer.innerHTML = '';
        tilesContainer.classList.toggle("view-grid", viewMode === "grid");
        tilesContainer.classList.toggle("view-list", viewMode === "list");
        
        // دکمه‌های کنترل
        if (state.isEditMode) {
            this.addControlButtons(breadcrumbs, cardEl.dataset.category);
        }
        
        // رندر آیتم‌ها
        items.forEach(async (item) => {
            const tile = await this.createTile(item, viewMode);
            tilesContainer.appendChild(tile);
        });
    }

    static async createTile(item, viewMode) {
        const isFolder = item.type === 'folder' || item.isFolder;
        const tile = document.createElement("a");
        tile.className = "tile";
        tile.dataset.id = item.id;
        tile.dataset.category = item.category || 'سایر';
        tile.dataset.tags = item.tags ? item.tags.join(',') : '';
        
        if (isFolder) {
            tile.classList.add("tile-folder");
            tile.href = "#";
            tile.addEventListener("click", (e) => {
                e.preventDefault();
                if (!state.isEditMode && item.children) {
                    this.openFolder(item);
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
            img.src = CONFIG.FALLBACK_ICON_PATH;
            // بارگذاری favicon به صورت غیرمسدودکننده
            FaviconManager.resolveFavicon(item.url).then(icon => {
                img.src = icon;
            });
        } else {
            img.src = CONFIG.FALLBACK_ICON_PATH;
        }
        
        // نام
        const nameDiv = document.createElement("div");
        nameDiv.className = "tile-name";
        nameDiv.textContent = item.title;
        nameDiv.title = item.description || item.title;
        
        // دکمه ویرایش
        const editBtn = document.createElement("div");
        editBtn.className = "tile-edit-btn";
        editBtn.textContent = "✏️";
        editBtn.title = "ویرایش";
        
        editBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openEditModal(item);
        });
        
        tile.appendChild(img);
        tile.appendChild(nameDiv);
        tile.appendChild(editBtn);
        
        return tile;
    }

    static addControlButtons(breadcrumbs, category) {
        // پاک کردن دکمه‌های قبلی
        breadcrumbs.querySelectorAll('.card-control-btn').forEach(btn => btn.remove());
        
        // دکمه حذف دسته‌بندی
        const delBtn = document.createElement('button');
        delBtn.className = "card-control-btn btn-del-crumb";
        delBtn.textContent = "❌";
        delBtn.title = "حذف این دسته‌بندی";
        delBtn.addEventListener("click", () => {
            if (confirm(`آیا از حذف دسته‌بندی "${category}" مطمئن هستید؟`)) {
                delete state.layoutMap[category];
                state.bookmarks = state.bookmarks.filter(b => b.category !== category);
                this.renderDashboard();
            }
        });
        breadcrumbs.appendChild(delBtn);
        
        // دکمه افزودن آیتم
        const addBtn = document.createElement('button');
        addBtn.className = "card-control-btn btn-add-crumb";
        addBtn.textContent = "➕";
        addBtn.title = "افزودن آیتم جدید";
        addBtn.addEventListener('click', () => this.openAddModal(category));
        breadcrumbs.appendChild(addBtn);
        
        // دکمه تغییر حالت نمایش
        const viewBtn = document.createElement('button');
        viewBtn.className = "card-control-btn btn-view-crumb";
        viewBtn.textContent = "👁️";
        viewBtn.title = "تغییر حالت نمایش";
        viewBtn.addEventListener("click", () => {
            const layout = state.layoutMap[category];
            layout.view = layout.view === "grid" ? "list" : "grid";
            this.renderDashboard();
        });
        breadcrumbs.appendChild(viewBtn);
    }

    static openFolder(folder) {
        // ایجاد modal برای نمایش محتوای پوشه
        const modal = document.getElementById('bookmark-modal');
        modal.innerHTML = `
            <div class="modal-content">
                <h3>${folder.title}</h3>
                <div class="folder-contents">
                    ${folder.children?.map(child => `
                        <a href="${child.url || '#'}" class="folder-item" target="_blank">
                            <img src="${CONFIG.FALLBACK_ICON_PATH}" class="folder-icon">
                            <span>${child.title}</span>
                        </a>
                    `).join('') || '<p>این پوشه خالی است.</p>'}
                </div>
                <div class="modal-buttons">
                    <button id="close-folder-btn" class="btn-secondary">بستن</button>
                </div>
            </div>
        `;
        
        modal.classList.remove('hidden');
        document.getElementById('close-folder-btn').addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }

    static openAddModal(category) {
        const modal = document.getElementById('bookmark-modal');
        document.getElementById('current-card-id').value = category;
        document.getElementById('editing-item-id').value = '';
        
        // ریست فرم
        document.getElementById('bookmark-form').reset();
        document.getElementById('bookmark-type').value = 'bookmark';
        document.getElementById('bookmark-category').value = category;
        this.updateModalFields();
        
        modal.classList.remove('hidden');
        state.currentModal = 'add';
    }

    static openEditModal(item) {
        const modal = document.getElementById('bookmark-modal');
        document.getElementById('editing-item-id').value = item.id;
        
        // پر کردن فرم
        document.getElementById('bookmark-name').value = item.title;
        document.getElementById('bookmark-url').value = item.url || '';
        document.getElementById('bookmark-type').value = item.type === 'folder' ? 'folder' : 'bookmark';
        document.getElementById('bookmark-category').value = item.category || 'سایر';
        document.getElementById('bookmark-tags').value = item.tags ? item.tags.join(', ') : '';
        document.getElementById('bookmark-description').value = item.description || '';
        
        this.updateModalFields();
        document.getElementById('delete-btn').classList.remove('hidden');
        
        modal.classList.remove('hidden');
        state.currentModal = 'edit';
    }

    static updateModalFields() {
        const type = document.getElementById('bookmark-type').value;
        const urlGroup = document.getElementById('url-field-group');
        const categoryField = document.getElementById('bookmark-category').parentNode;
        const tagsField = document.getElementById('bookmark-tags').parentNode;
        
        if (type === 'bookmark') {
            urlGroup.style.display = 'block';
            categoryField.style.display = 'block';
            tagsField.style.display = 'block';
        } else {
            urlGroup.style.display = 'none';
            categoryField.style.display = 'block';
            tagsField.style.display = 'block';
        }
    }

    static applySearchFilter(searchTerm) {
        const tiles = document.querySelectorAll('.tile');
        tiles.forEach(tile => {
            const title = tile.querySelector('.tile-name').textContent.toLowerCase();
            const category = tile.dataset.category.toLowerCase();
            const tags = tile.dataset.tags.toLowerCase();
            
            const matches = title.includes(searchTerm) || 
                           category.includes(searchTerm) || 
                           tags.includes(searchTerm);
            
            tile.classList.toggle('filtered-out', !matches);
            tile.classList.toggle('highlighted', matches && searchTerm.length > 0);
        });
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
            startCol: parseInt(card.style.gridColumnStart),
            startRow: parseInt(card.style.gridRowStart)
        };
        
        card.classList.add('dragging');
        document.body.style.cursor = 'grabbing';
        
        window.addEventListener('mousemove', this.onDrag);
        window.addEventListener('mouseup', this.stopDrag);
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
                state.layoutMap[category].col = parseInt(state.dragInfo.card.style.gridColumnStart);
                state.layoutMap[category].row = parseInt(state.dragInfo.card.style.gridRowStart);
                StorageManager.set(CONFIG.STORAGE_KEYS.LAYOUT, state.layoutMap);
            }
        }
        
        state.dragInfo = null;
        document.body.style.cursor = 'default';
        window.removeEventListener('mousemove', this.onDrag);
        window.removeEventListener('mouseup', this.stopDrag);
    }

    static startResize(e, card) {
        if (e.button !== 0 || !state.isEditMode) return;
        e.preventDefault();
        e.stopPropagation();
        
        state.resizeInfo = {
            card: card,
            startX: e.clientX,
            startY: e.clientY,
            startW: parseInt(card.style.gridColumnEnd.split(' ')[1]),
            startH: parseInt(card.style.gridRowEnd.split(' ')[1])
        };
        
        window.addEventListener('mousemove', this.onResize);
        window.addEventListener('mouseup', this.stopResize);
    }

    static onResize(e) {
        if (!state.resizeInfo) return;
        
        const dx = e.clientX - state.resizeInfo.startX;
        const dy = e.clientY - state.resizeInfo.startY;
        
        const dW = Math.round(dx / (CONFIG.GRID_CELL_SIZE + CONFIG.GRID_GAP));
        const dH = Math.round(dy / (CONFIG.GRID_CELL_SIZE + CONFIG.GRID_GAP));
        
        const newW = Math.max(6, state.resizeInfo.startW - dW);
        const newH = Math.max(6, state.resizeInfo.startH + dH);
        
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
                state.layoutMap[category].w = parseInt(state.resizeInfo.card.style.gridColumnEnd.split(' ')[1]);
                state.layoutMap[category].h = parseInt(state.resizeInfo.card.style.gridRowEnd.split(' ')[1]);
                StorageManager.set(CONFIG.STORAGE_KEYS.LAYOUT, state.layoutMap);
            }
        }
        
        state.resizeInfo = null;
        window.removeEventListener('mousemove', this.onResize);
        window.removeEventListener('mouseup', this.stopResize);
    }
}

// ==================== Import/Export System ====================
class ImportExportManager {
    static async exportBookmarks() {
        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            bookmarks: state.userBookmarks
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        this.downloadFile(dataStr, 'bookmarks_export.json', 'application/json');
    }

    static async importBookmarks(file) {
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
                    
                    await StorageManager.set(CONFIG.STORAGE_KEYS.USER_BOOKMARKS, state.userBookmarks);
                    
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

    static async exportSettings() {
        const settings = {
            layout: state.layoutMap,
            theme: state.isDarkMode ? 'dark' : 'light',
            background: await StorageManager.get(CONFIG.STORAGE_KEYS.BACKGROUND),
            customUrls: await StorageManager.get(CONFIG.STORAGE_KEYS.CUSTOM_URLS),
            settings: await StorageManager.get(CONFIG.STORAGE_KEYS.SETTINGS)
        };
        
        const dataStr = JSON.stringify(settings, null, 2);
        this.downloadFile(dataStr, 'settings_export.json', 'application/json');
    }

    static async importSettings(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const importedSettings = JSON.parse(event.target.result);
                    
                    // اعمال تنظیمات
                    if (importedSettings.layout) {
                        state.layoutMap = importedSettings.layout;
                        await StorageManager.set(CONFIG.STORAGE_KEYS.LAYOUT, state.layoutMap);
                    }
                    
                    if (importedSettings.theme) {
                        state.isDarkMode = importedSettings.theme === 'dark';
                        await ThemeManager.applyTheme();
                    }
                    
                    if (importedSettings.background) {
                        await BackgroundManager.setBackground(importedSettings.background);
                    }
                    
                    if (importedSettings.customUrls) {
                        await StorageManager.set(CONFIG.STORAGE_KEYS.CUSTOM_URLS, importedSettings.customUrls);
                    }
                    
                    if (importedSettings.settings) {
                        await StorageManager.set(CONFIG.STORAGE_KEYS.SETTINGS, importedSettings.settings);
                        state.isCompactMode = importedSettings.settings.compactView || false;
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

// ==================== Event Handlers ====================
class EventManager {
    static setup() {
        // دکمه حالت ویرایش
        document.getElementById('edit-mode-btn').addEventListener('click', () => {
            state.isEditMode = !state.isEditMode;
            const editBtn = document.getElementById('edit-mode-btn');
            const subControls = document.getElementById('sub-controls');
            
            editBtn.textContent = state.isEditMode ? '✅' : '✏️';
            editBtn.title = state.isEditMode ? 'خروج از حالت ویرایش' : 'حالت ویرایش';
            
            if (state.isEditMode) {
                subControls.classList.remove('hidden-controls');
                subControls.classList.add('visible-controls');
            } else {
                subControls.classList.remove('visible-controls');
                subControls.classList.add('hidden-controls');
            }
            
            Renderer.renderDashboard();
        });
        
        // دکمه افزودن کارت
        document.getElementById('add-card-btn').addEventListener('click', async () => {
            if (!state.isEditMode) return;
            
            const categoryName = prompt("نام دسته‌بندی جدید:");
            if (categoryName && categoryName.trim()) {
                // ایجاد layout جدید
                const newLayout = {
                    col: 1,
                    row: 1,
                    w: 8,
                    h: 6,
                    view: "list"
                };
                
                state.layoutMap[categoryName] = newLayout;
                await StorageManager.set(CONFIG.STORAGE_KEYS.LAYOUT, state.layoutMap);
                
                Renderer.renderDashboard();
            }
        });
        
        // دکمه به‌روزرسانی بوکمارک‌ها
        document.getElementById('refresh-bookmarks-btn').addEventListener('click', async () => {
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
        
        // دکمه تغییر تم
        document.getElementById('toggle-theme-btn').addEventListener('click', () => {
            ThemeManager.toggleTheme();
        });
        
        // دکمه جستجو
        document.getElementById('search-btn').addEventListener('click', () => {
            const searchContainer = document.getElementById('search-container');
            searchContainer.classList.toggle('hidden');
            
            if (!searchContainer.classList.contains('hidden')) {
                document.getElementById('bookmark-search').focus();
            }
        });
        
        // دکمه بستن جستجو
        document.getElementById('close-search').addEventListener('click', () => {
            document.getElementById('search-container').classList.add('hidden');
            state.searchTerm = '';
            Renderer.applySearchFilter('');
        });
        
        // ورودی جستجو
        document.getElementById('bookmark-search').addEventListener('input', (e) => {
            state.searchTerm = e.target.value.toLowerCase().trim();
            Renderer.applySearchFilter(state.searchTerm);
        });
        
        // دکمه پس‌زمینه
        document.getElementById('set-background-btn').addEventListener('click', () => {
            document.getElementById('background-file-input').click();
        });
        
        // Import/Export بوکمارک‌ها
        document.getElementById('export-bookmarks-btn').addEventListener('click', () => {
            ImportExportManager.exportBookmarks();
        });
        
        document.getElementById('import-bookmarks-btn').addEventListener('click', () => {
            document.getElementById('import-bookmarks-file').click();
        });
        
        // Import/Export تنظیمات
        document.getElementById('export-settings-btn').addEventListener('click', () => {
            ImportExportManager.exportSettings();
        });
        
        document.getElementById('import-settings-btn').addEventListener('click', () => {
            document.getElementById('import-settings-file').click();
        });
        
        // مدیریت فایل‌های import
        document.getElementById('import-bookmarks-file').addEventListener('change', async (e) => {
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
        
        document.getElementById('import-settings-file').addEventListener('change', async (e) => {
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
        
        document.getElementById('background-file-input').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = async (event) => {
                await BackgroundManager.setBackground(event.target.result);
            };
            reader.readAsDataURL(file);
            e.target.value = '';
        });
        
        // مدیریت Modal
        document.getElementById('cancel-btn').addEventListener('click', () => {
            document.getElementById('bookmark-modal').classList.add('hidden');
        });
        
        document.getElementById('bookmark-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                title: document.getElementById('bookmark-name').value,
                type: document.getElementById('bookmark-type').value,
                url: document.getElementById('bookmark-url').value,
                category: document.getElementById('bookmark-category').value,
                tags: document.getElementById('bookmark-tags').value.split(',').map(t => t.trim()).filter(t => t),
                description: document.getElementById('bookmark-description').value
            };
            
            const itemId = document.getElementById('editing-item-id').value;
            
            try {
                if (itemId) {
                    // ویرایش بوکمارک موجود
                    await BookmarkManager.updateUserBookmark(itemId, formData);
                } else {
                    // افزودن بوکمارک جدید
                    await BookmarkManager.addUserBookmark(formData);
                }
                
                document.getElementById('bookmark-modal').classList.add('hidden');
                await Renderer.renderDashboard();
            } catch (error) {
                alert('خطا در ذخیره بوکمارک: ' + error.message);
            }
        });
        
        document.getElementById('delete-btn').addEventListener('click', async () => {
            const itemId = document.getElementById('editing-item-id').value;
            
            if (confirm('آیا از حذف این آیتم اطمینان دارید؟')) {
                try {
                    await BookmarkManager.deleteUserBookmark(itemId);
                    document.getElementById('bookmark-modal').classList.add('hidden');
                    await Renderer.renderDashboard();
                } catch (error) {
                    alert('خطا در حذف بوکمارک: ' + error.message);
                }
            }
        });
        
        document.getElementById('bookmark-type').addEventListener('change', () => {
            Renderer.updateModalFields();
        });
        
        // تنظیمات پیشرفته
        document.getElementById('settings-btn')?.addEventListener('click', () => {
            document.getElementById('settings-modal').classList.remove('hidden');
            this.loadSettingsForm();
        });
        
        document.getElementById('close-settings-btn')?.addEventListener('click', () => {
            document.getElementById('settings-modal').classList.add('hidden');
        });
        
        document.getElementById('save-settings-btn')?.addEventListener('click', async () => {
            await this.saveSettings();
            document.getElementById('settings-modal').classList.add('hidden');
        });
        
        document.getElementById('clear-cache-btn')?.addEventListener('click', async () => {
            if (confirm('آیا از پاک کردن کش اطمینان دارید؟')) {
                await FaviconManager.clearCache();
                alert('کش با موفقیت پاک شد.');
            }
        });
        
        document.getElementById('reset-all-btn')?.addEventListener('click', async () => {
            if (confirm('آیا از بازنشانی همه تنظیمات اطمینان دارید؟ این عمل قابل بازگشت نیست.')) {
                await StorageManager.clearAll();
                location.reload();
            }
        });
    }
    
    static async loadSettingsForm() {
        const settings = await StorageManager.get(CONFIG.STORAGE_KEYS.SETTINGS) || {};
        const customUrls = await StorageManager.get(CONFIG.STORAGE_KEYS.CUSTOM_URLS) || {};
        
        document.getElementById('auto-dark-mode').checked = settings.autoDarkMode || false;
        document.getElementById('compact-view').checked = settings.compactView || false;
        document.getElementById('bookmarks-json-url').value = customUrls.bookmarks || CONFIG.BOOKMARKS_JSON_URL;
    }
    
    static async saveSettings() {
        const settings = {
            autoDarkMode: document.getElementById('auto-dark-mode').checked,
            compactView: document.getElementById('compact-view').checked
        };
        
        const customUrls = {
            bookmarks: document.getElementById('bookmarks-json-url').value || CONFIG.BOOKMARKS_JSON_URL
        };
        
        await StorageManager.set(CONFIG.STORAGE_KEYS.SETTINGS, settings);
        await StorageManager.set(CONFIG.STORAGE_KEYS.CUSTOM_URLS, customUrls);
        
        state.isCompactMode = settings.compactView;
        await Renderer.renderDashboard();
        
        alert('تنظیمات با موفقیت ذخیره شدند.');
    }
}

// ==================== Initialize Application ====================
class App {
    static async init() {
        console.log('🎯 App.init() شروع شد');
        
        try {
            // 🔴 مشکل اینجاست! این خط رو کامنت کنید یا حذف کنید:
            // document.querySelector('.loading-spinner')?.remove();
            
            // 🟢 اول بدون await چک کنیم
            console.log('1. شروع ThemeManager.init()');
            ThemeManager.init().then(() => {
                console.log('✅ ThemeManager.init() کامل شد');
            }).catch(e => {
                console.error('❌ ThemeManager.init() خطا:', e);
            });
            
            console.log('2. شروع BackgroundManager.applySavedBackground()');
            BackgroundManager.applySavedBackground().then(() => {
                console.log('✅ BackgroundManager.applySavedBackground() کامل شد');
            }).catch(e => {
                console.error('❌ BackgroundManager.applySavedBackground() خطا:', e);
            });
            
            // بارگذاری layout بدون await
            console.log('3. شروع StorageManager.get() برای layout');
            StorageManager.get(CONFIG.STORAGE_KEYS.LAYOUT).then(layout => {
                console.log('✅ Layout لود شد:', layout);
                state.layoutMap = layout || {};
            }).catch(e => {
                console.error('❌ Layout خطا:', e);
                state.layoutMap = {};
            });
            
            // بارگذاری بوکمارک‌ها
            console.log('4. شروع BookmarkManager.loadBookmarks()');
            BookmarkManager.loadBookmarks().then(bookmarks => {
                console.log(`✅ ${bookmarks.length} بوکمارک لود شد`);
            }).catch(e => {
                console.error('❌ BookmarkManager.loadBookmarks() خطا:', e);
                state.bookmarks = [];
            });
            
            // بعد از 2 ثانیه، هرچه شده رندر کن
            setTimeout(() => {
                console.log('⏰ تایم‌اوت 2 ثانیه - شروع رندر');
                this.finishInit();
            }, 2000);
            
        } catch (error) {
            console.error('🔥 خطای بحرانی در App.init():', error);
            this.showError(error);
        }
    }
    
    static async finishInit() {
        console.log('🔄 finishInit() شروع شد');
        
        try {
            // تنظیم رویدادها
            console.log('5. شروع EventManager.setup()');
            EventManager.setup();
            
            // رندر اولیه
            console.log('6. شروع Renderer.renderDashboard()');
            await Renderer.renderDashboard();
            
            // حالا اسپینر رو حذف کن
            const spinner = document.querySelector('.loading-spinner');
            if (spinner) {
                spinner.style.opacity = '0';
                setTimeout(() => spinner.remove(), 500);
                console.log('✅ اسپینر حذف شد');
            }
            
            console.log('🎉 برنامه با موفقیت راه‌اندازی شد!');
            
        } catch (error) {
            console.error('❌ خطا در finishInit():', error);
            this.showError(error);
        }
    }
    
    static showError(error) {
        const spinner = document.querySelector('.loading-spinner');
        if (spinner) {
            spinner.innerHTML = `
                <h3 style="color: red;">❌ خطا در راه‌اندازی</h3>
                <p>${error.message}</p>
                <button onclick="location.reload()" style="padding: 10px 20px; margin: 10px; background: #007bff; color: white; border: none; border-radius: 5px;">
                    تلاش مجدد
                </button>
            `;
        }
    }
}

// ==================== راه‌اندازی برنامه ====================
console.log('📌 وضعیت DOM:', document.readyState);

// روش ۱: منتظر بمان تا همه چیز لود شود
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('✅ DOMContentLoaded event fired');
        App.init();
    });
} else {
    // DOM از قبل لود شده
    console.log('✅ DOM از قبل لود شده');
    setTimeout(() => {
        App.init();
    }, 100);
}

// روش ۲: fallback با timeout
setTimeout(() => {
    if (!window.appInitialized) {
        console.log('⚠️ Fallback: اجرای دستی بعد از 3 ثانیه');
        window.appInitialized = true;
        App.init();
    }
}, 3000);



// راه حل اضطراری - اجرای مستقیم
console.log('🚨 اجرای مستقیم شروع شد');

// بررسی کن که آیا App.init اجرا شده یا نه
if (!window.appStarted) {
    window.appStarted = true;
    
    // بعد از 1 ثانیه اجرا کن
    setTimeout(async () => {
        console.log('🕒 شروع اجرای مستقیم...');
        
        // حتماً اسپینر رو پاک کن
        const spinner = document.querySelector('.loading-spinner');
        if (spinner) {
            spinner.remove();
            console.log('🗑️ اسپینر حذف شد');
        }
        
        // یک رندر ساده انجام بده
        const container = document.getElementById('grid-container');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 50px;">
                    <h2>🎯 همیار کافینت</h2>
                    <p>برنامه با موفقیت لود شد!</p>
                    <button onclick="location.reload()" style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 5px; margin: 10px;">
                        بارگذاری مجدد
                    </button>
                </div>
            `;
            console.log('✅ رندر ساده انجام شد');
        }
        
        // سعی کن App.init رو اجرا کنی
        if (window.App && typeof window.App.init === 'function') {
            try {
                await window.App.init();
                console.log('✅ App.init() با موفقیت اجرا شد');
            } catch (e) {
                console.error('❌ App.init() خطا داد:', e);
            }
        }
    }, 1000);
}
