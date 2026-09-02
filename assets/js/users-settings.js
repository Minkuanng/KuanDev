// Extracted from user/settings.html

let lang = localStorage.getItem('lang') || 'vi';
        let currentTheme = localStorage.getItem('theme_name') || 'default';
        let isDataLoaded = false;

        function showToast(msg, type = '') {
            const el = document.getElementById('toast');
            el.textContent = msg;
            el.className = 'toast ' + type;
            el.classList.add('show');
            clearTimeout(el.timeout);
            el.timeout = setTimeout(() => el.classList.remove('show'), 2500);
        }

        function applyTheme() {
            const isDark = localStorage.getItem('theme') === 'dark' || currentTheme === 'dark';
            document.body.classList.toggle('dark-mode', isDark);
            document.body.className = document.body.className.replace(/theme-\w+/g, '');
            if (currentTheme !== 'default' && currentTheme !== 'dark' && currentTheme !== 'light') {
                document.body.classList.add('theme-' + currentTheme);
            }
            const darkToggle = document.getElementById('darkModeToggle');
            if (darkToggle) darkToggle.classList.toggle('active', isDark);

            const names = {
                default: 'Mặc định', galaxy: 'Galaxy', ocean: 'Ocean',
                forest: 'Forest', sunset: 'Sunset', cherry: 'Cherry',
                neon: 'Neon', lavender: 'Lavender', mint: 'Mint',
                coffee: 'Coffee', dark: 'Dark', light: 'Light'
            };
            document.getElementById('currentThemeDisplay').textContent = names[currentTheme] || 'Mặc định';
            document.querySelectorAll('.theme-option').forEach(el => {
                el.classList.toggle('active', el.dataset.theme === currentTheme);
            });
            updateStatusTexts();
        }

        function updateStatusTexts() {
            const isDark = localStorage.getItem('theme') === 'dark' || currentTheme === 'dark';
            const darkStatus = document.getElementById('darkModeStatus');
            if (darkStatus) {
                darkStatus.textContent = isDark ? 'Bật' : 'Tắt';
                darkStatus.className = 'status ' + (isDark ? 'on' : 'off');
            }

            const notif = localStorage.getItem('notifEnabled') !== 'false';
            const notifStatus = document.getElementById('notifStatus');
            if (notifStatus) {
                notifStatus.textContent = notif ? 'Bật' : 'Tắt';
                notifStatus.className = 'status ' + (notif ? 'on' : 'off');
            }
            const notifToggle = document.getElementById('notifToggle');
            if (notifToggle) notifToggle.classList.toggle('active', notif);

            const auto = localStorage.getItem('autoView') !== 'false';
            const autoStatus = document.getElementById('autoViewStatus');
            if (autoStatus) {
                autoStatus.textContent = auto ? 'Bật' : 'Tắt';
                autoStatus.className = 'status ' + (auto ? 'on' : 'off');
            }
            const autoToggle = document.getElementById('autoViewToggle');
            if (autoToggle) autoToggle.classList.toggle('active', auto);
        }

        function openThemeModal() {
            document.getElementById('themeModal').classList.add('active');
            document.querySelectorAll('.theme-option').forEach(el => {
                el.classList.toggle('active', el.dataset.theme === currentTheme);
            });
        }

        function closeThemeModal() {
            document.getElementById('themeModal').classList.remove('active');
        }

        function selectThemeModal(theme) {
            if (theme === 'dark') {
                localStorage.setItem('theme', 'dark');
                currentTheme = 'default';
            } else if (theme === 'light') {
                localStorage.setItem('theme', 'light');
                currentTheme = 'default';
            } else {
                localStorage.setItem('theme', 'light');
                currentTheme = theme;
                localStorage.setItem('theme_name', theme);
            }
            applyTheme();
            closeThemeModal();
            showToast('✅ Đã chọn theme!', 'success');
        }

        function toggleDarkMode() {
            const isDark = localStorage.getItem('theme') === 'dark' || currentTheme === 'dark';
            if (isDark) {
                localStorage.setItem('theme', 'light');
                currentTheme = localStorage.getItem('theme_name') || 'default';
            } else {
                localStorage.setItem('theme', 'dark');
                currentTheme = 'default';
            }
            applyTheme();
            showToast('✅ Đã chuyển chế độ!', 'success');
        }

        function toggleNotification() {
            const enabled = localStorage.getItem('notifEnabled') !== 'false';
            localStorage.setItem('notifEnabled', enabled ? 'false' : 'true');
            document.getElementById('notifToggle').classList.toggle('active');
            updateStatusTexts();
            showToast(enabled ? '🔕 Đã tắt thông báo' : '🔔 Đã bật thông báo', 'success');
        }

        function toggleAutoView() {
            const auto = localStorage.getItem('autoView') !== 'false';
            localStorage.setItem('autoView', auto ? 'false' : 'true');
            document.getElementById('autoViewToggle').classList.toggle('active');
            updateStatusTexts();
            showToast(auto ? '👁️ Đã tắt tự động xem' : '👁️ Đã bật tự động xem', 'success');
        }

        function changeLanguage(l) {
            lang = l;
            localStorage.setItem('lang', l);
            document.getElementById('currentLangDisplay').textContent = lang === 'vi' ? '🇻🇳 Tiếng Việt' : '🇬🇧 English';
            document.getElementById('langSelect').value = l;
            updateStatusTexts();
            showToast(lang === 'vi' ? '✅ Đã chuyển sang Tiếng Việt!' : '✅ Switched to English!', 'success');
        }

        function goToBalance() { window.location.href = 'balance'; }

        // ===== AUTH =====
        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.replace('../auth/login');
                return;
            }
            db.ref('presence/' + user.uid).set(true);
            db.ref('presence/' + user.uid).onDisconnect().set(false);
            db.ref('users/' + user.uid + '/balance').on('value', snap => {
                document.getElementById('balanceAmount').textContent = (snap.val() || 0).toLocaleString('vi-VN');
            });
            db.ref('users/' + user.uid + '/isAdmin').once('value', snap => {
                if (snap.val() === true) document.getElementById('adminSection').style.display = 'block';
            });
            db.ref('notifications').on('value', snap => {
                const notifs = snap.val();
                const list = document.getElementById('notifList');
                const dot = document.getElementById('notifDot');
                if (notifs) {
                    const keys = Object.keys(notifs).reverse();
                    let html = '', hasUnread = false;
                    keys.forEach(key => {
                        const n = notifs[key];
                        const isUnread = !n.readBy || !n.readBy[user.uid];
                        if (isUnread) hasUnread = true;
                        html += `<div class="notif-item ${isUnread?'unread':''}"><i class="fas fa-bell"></i> ${n.message}<span class="time"><i class="far fa-clock"></i> ${new Date(n.timestamp).toLocaleString('vi-VN')}</span></div>`;
                    });
                    list.innerHTML = html;
                    dot.classList.toggle('show', hasUnread && localStorage.getItem('notifEnabled') !== 'false');
                } else {
                    list.innerHTML = `<div class="empty"><i class="far fa-bell-slash"></i> Chưa có thông báo</div>`;
                    dot.classList.remove('show');
                }
            });
            if (!isDataLoaded) { isDataLoaded = true; }
        });

        // ===== MENU FUNCTIONS =====
        function toggleMenu() { document.getElementById('sideMenu').classList.toggle('active'); document.getElementById('menuOverlay').classList.toggle('active'); }
        function closeMenu() { document.getElementById('sideMenu').classList.remove('active'); document.getElementById('menuOverlay').classList.remove('active'); }
        function togglePopup(e) { e.stopPropagation(); document.getElementById('settingsPopup').classList.toggle('active'); }
        document.addEventListener('click', function(e) {
            const popup = document.getElementById('settingsPopup');
            const wrapper = document.querySelector('.settings-wrapper');
            if (!wrapper.contains(e.target)) popup.classList.remove('active');
        });

        function toggleNotif() {
            document.getElementById('notifPopup').classList.toggle('active');
            const user = auth.currentUser;
            if (user && localStorage.getItem('autoView') !== 'false') {
                db.ref('notifications').once('value', snap => {
                    const notifs = snap.val();
                    if (notifs) Object.keys(notifs).forEach(key => db.ref('notifications/' + key + '/readBy/' + user.uid).set(true));
                });
                document.getElementById('notifDot').classList.remove('show');
            }
        }

        function goHome() { closeMenu(); window.location.href = '../index'; }
        function goHistory() { closeMenu(); window.location.href = '../pages/history'; }
        function goTopup() { closeMenu(); showToast('💰 Đang phát triển!', 'error'); }
        function goEarn() { closeMenu(); window.location.href = '../pages/earn-money'; }
        function goSupport() { closeMenu(); window.location.href = '../pages/support'; }
        function goToProfile() { window.location.href = 'profile'; }
        function goToSecurity() { window.location.href = 'security'; }
        function goToBalance() { window.location.href = 'balance'; }
        function goToSettings() { window.location.href = 'settings'; }
        function goToAdmin() { window.location.href = '../assets/html/admin.html'; }

        function logout() {
            if (confirm('Đăng xuất?')) {
                const user = auth.currentUser;
                if (user) db.ref('presence/' + user.uid).set(false);
                auth.signOut().then(() => {
                    window.location.replace('../auth/login');
                });
            }
        }

        document.getElementById('themeModal').addEventListener('click', function(e) {
            if (e.target === this) closeThemeModal();
        });

        document.getElementById('langSelect').value = lang;
        document.getElementById('currentLangDisplay').textContent = lang === 'vi' ? '🇻🇳 Tiếng Việt' : '🇬🇧 English';
        document.getElementById('notifToggle').classList.toggle('active', localStorage.getItem('notifEnabled') !== 'false');
        document.getElementById('autoViewToggle').classList.toggle('active', localStorage.getItem('autoView') !== 'false');

        applyTheme();

