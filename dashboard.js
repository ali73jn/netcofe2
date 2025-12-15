// ==================== تنظیمات اصلی ====================
const CONFIG = {
    BOOKMARKS_JSON_URL: "https://raw.githubusercontent.com/ali73jn/netcofe2/main/data/bookmarks.json",
    STORAGE_KEYS: {
        LAYOUT: 'netcofe_layout',
        BACKGROUND: 'netcofe_background',
        THEME: 'netcofe_theme',
        USER_BOOKMARKS: 'netcofe_user_bookmarks'
    }
};

// ==================== وضعیت برنامه ====================
let state = {
    isEditMode: false,
    isDarkMode: false,
    layoutMap: {},
    bookmarks: []
};

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
}

// ==================== مدیریت بوکمارک‌ها ====================
class BookmarkManager {
    static async loadBookmarks() {
        try {
            // بارگذاری بوکمارک‌های کاربر
            state.userBookmarks = StorageManager.get(CONFIG.STORAGE_KEYS.USER_BOOKMARKS) || [];
            
            // بارگذاری بوکمارک‌های مرکزی
            const response = await fetch(CONFIG.BOOKMARKS_JSON_URL);
            if (!response.ok) throw new Error('خطا در دریافت بوکمارک‌ها');
            
            const centralBookmarks = await response.json();
            state.bookmarks = centralBookmarks.bookmarks || centralBookmarks;
            
            // ادغام با بوکمارک‌های کاربر
            state.bookmarks = [...state.bookmarks, ...state.userBookmarks];
            
            return state.bookmarks;
        } catch (error) {
            console.error('خطا در بارگذاری بوکمارک‌ها:', error);
            // استفاده از بوکمارک‌های پیش‌فرض
            state.bookmarks = await this.getDefaultBookmarks();
            return state.bookmarks;
        }
    }

    static getDefaultBookmarks() {
        return [
            {
                id: 'google',
                title: 'گوگل',
                url: 'https://google.com',
                category: 'موتور جستجو'
            },
            {
                id: 'github',
                title: 'GitHub',
                url: 'https://github.com',
                category: 'توسعه'
            },
            {
                id: 'folder-example',
                title: 'پوشه نمونه',
                type: 'folder',
                category: 'سایر',
                children: []
            }
        ];
    }
}

// ==================== مدیریت تم ====================
class ThemeManager {
    static init() {
        const savedTheme = StorageManager.get(CONFIG.STORAGE_KEYS.THEME);
        if (savedTheme) {
            state.isDarkMode = savedTheme === 'dark';
        }
        this.applyTheme();
    }

    static applyTheme() {
        document.documentElement.setAttribute('data-theme', state.isDarkMode ? 'dark' : 'light');
        StorageManager.set(CONFIG.STORAGE_KEYS.THEME, state.isDarkMode ? 'dark' : 'light');
    }

    static toggleTheme() {
        state.isDarkMode = !state.isDarkMode;
        this.applyTheme();
    }
}

// ==================== رندرینگ ====================
class Renderer {
    static async renderDashboard() {
        const container = document.getElementById('grid-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        // اگر بوکمارکی نداریم
        if (state.bookmarks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>📚 بوکمارکی یافت نشد</h3>
                    <button id="add-first-bookmark" class="btn-success">افزودن اولین بوکمارک</button>
                </div>
            `;
            return;
        }
        
        // دسته‌بندی بوکمارک‌ها
        const categorized = this.categorizeBookmarks(state.bookmarks);
        
        // ایجاد کارت برای هر دسته‌بندی
        Object.entries(categorized).forEach(([category, items], index) => {
            const card = this.createCard(category, items, index);
            container.appendChild(card);
        });
    }
    
    static categorizeBookmarks(bookmarks) {
        const categories = {};
        
        bookmarks.forEach(bookmark => {
            const category = bookmark.category || 'سایر';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(bookmark);
        });
        
        return categories;
    }
    
    static createCard(category, items, index) {
        const card = document.createElement('div');
        card.className = 'bookmark-card';
        card.dataset.category = category;
        
        // محتوای کارت
        card.innerHTML = `
            <div class="card-header">
                <div class="card-title">${category} (${items.length})</div>
                <button class="card-btn btn-drag ${state.isEditMode ? '' : 'hidden'}">::</button>
            </div>
            <div class="card-content">
                <div class="bookmark-tiles">
                    ${items.map(item => `
                        <a href="${item.url || '#'}" class="tile" target="_blank">
                            <img src="icons/default_icon.png" class="tile-icon">
                            <div class="tile-name">${item.title}</div>
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
        
        return card;
    }
}

// ==================== مدیریت رویدادها ====================
class EventManager {
    static setup() {
        // دکمه حالت ویرایش
        document.getElementById('edit-mode-btn').addEventListener('click', () => {
            state.isEditMode = !state.isEditMode;
            const editBtn = document.getElementById('edit-mode-btn');
            const subControls = document.getElementById('sub-controls');
            
            editBtn.textContent = state.isEditMode ? '✅' : '✏️';
            editBtn.title = state.isEditMode ? 'خروج از حالت ویرایش' : 'حالت ویرایش';
            
            subControls.classList.toggle('hidden-controls', !state.isEditMode);
            subControls.classList.toggle('visible-controls', state.isEditMode);
            
            Renderer.renderDashboard();
        });
        
        // دکمه تغییر تم
        document.getElementById('toggle-theme-btn').addEventListener('click', () => {
            ThemeManager.toggleTheme();
        });
        
        // دکمه جستجو
        document.getElementById('search-btn').addEventListener('click', () => {
            const searchContainer = document.getElementById('search-container');
            searchContainer.classList.toggle('hidden');
        });
        
        // دکمه بستن جستجو
        document.getElementById('close-search').addEventListener('click', () => {
            document.getElementById('search-container').classList.add('hidden');
        });
        
        // ورودی جستجو
        document.getElementById('bookmark-search').addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const tiles = document.querySelectorAll('.tile');
            
            tiles.forEach(tile => {
                const title = tile.querySelector('.tile-name').textContent.toLowerCase();
                tile.classList.toggle('hidden', !title.includes(searchTerm));
            });
        });
    }
}

// ==================== راه‌اندازی برنامه ====================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // بارگذاری اولیه
        ThemeManager.init();
        
        // بارگذاری layout
        state.layoutMap = StorageManager.get(CONFIG.STORAGE_KEYS.LAYOUT) || {};
        
        // بارگذاری بوکمارک‌ها
        await BookmarkManager.loadBookmarks();
        
        // تنظیم رویدادها
        EventManager.setup();
        
        // رندر اولیه
        await Renderer.renderDashboard();
        
    } catch (error) {
        console.error('خطا در راه‌اندازی برنامه:', error);
        document.getElementById('grid-container').innerHTML = `
            <div class="error-state">
                <h3>❌ خطا در راه‌اندازی</h3>
                <p>${error.message}</p>
                <button onclick="location.reload()" class="btn-success">تلاش مجدد</button>
            </div>
        `;
    }
});