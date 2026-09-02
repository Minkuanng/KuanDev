// Extracted from assets/html/privacy-policy.html

// ===== Inline script 1 =====
// ===== THEME =====
        function applyTheme() {
            const isDark = localStorage.getItem('theme') === 'dark';
            document.body.classList.toggle('dark-mode', isDark);
            const theme = localStorage.getItem('theme_name') || 'default';
            document.body.className = document.body.className.replace(/theme-\w+/g, '');
            if (theme !== 'default') document.body.classList.add('theme-' + theme);
        }
        applyTheme();

        // ===== LOADING =====
        function hideLoading() {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                overlay.classList.add('hidden');
                overlay.style.display = 'none';
            }
        }

        // ===== TOAST =====
        function showToast(msg, type = '') {
            const el = document.getElementById('toast');
            el.textContent = msg;
            el.className = 'toast ' + type;
            el.classList.add('show');
            clearTimeout(el.timeout);
            el.timeout = setTimeout(() => el.classList.remove('show'), 2500);
        }

        // ===== SMOOTH SCROLL =====
        document.querySelectorAll('.toc a').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });

        // ===== APPLY THEME ON STORAGE CHANGE =====
        window.addEventListener('storage', function(e) {
            if (e.key === 'theme' || e.key === 'theme_name') {
                applyTheme();
            }
        });

        // ===== HIDE LOADING =====
        window.addEventListener('load', function() {
            setTimeout(hideLoading, 600);
        });

        // Fallback hide loading
        setTimeout(hideLoading, 2000);

