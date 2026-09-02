// Extracted from user/profile.html

let currentUser = null;
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
            const isDark = localStorage.getItem('theme') === 'dark';
            document.body.classList.toggle('dark-mode', isDark);
            const theme = localStorage.getItem('theme_name') || 'default';
            document.body.className = document.body.className.replace(/theme-\w+/g, '');
            if (theme !== 'default') document.body.classList.add('theme-' + theme);
        }
        applyTheme();

        function hideLoading() {
            const overlay = document.getElementById('loadingOverlay');
            overlay.classList.add('hidden');
            setTimeout(() => overlay.style.display = 'none', 500);
        }

        function showLoading() {
            const overlay = document.getElementById('loadingOverlay');
            overlay.style.display = 'flex';
            overlay.classList.remove('hidden');
        }

        function getDaysBetween(date1, date2) {
            const diff = Math.abs(date2 - date1);
            return Math.ceil(diff / (1000 * 60 * 60 * 24));
        }

        function refreshBalance() {
            const user = auth.currentUser;
            if (user) {
                db.ref('users/' + user.uid + '/balance').once('value', snap => {
                    const bal = snap.val() || 0;
                    document.getElementById('balanceAmount').textContent = bal.toLocaleString('vi-VN');
                    document.getElementById('profileBalance').textContent = bal.toLocaleString('vi-VN') + ' VND';
                    showToast('🔄 Đã làm mới số dư!', 'success');
                });
            }
        }

        // ===== AUTH =====
        auth.onAuthStateChanged(async (user) => {
            if (isDataLoaded) return;
            if (!user) { window.location.replace('../auth/login'); return; }
            currentUser = user;
            
            db.ref('presence/' + user.uid).set(true);
            db.ref('presence/' + user.uid).onDisconnect().set(false);

            // Lấy thông tin user
            const userSnap = await db.ref('users/' + user.uid).once('value');
            const userData = userSnap.val();

            const name = user.displayName || userData?.user || user.email || 'U';
            const avatarChar = name.charAt(0).toUpperCase();
            document.getElementById('avatar').textContent = avatarChar;
            document.getElementById('userName').textContent = name;
            document.getElementById('userEmail').textContent = user.email || '';
            document.getElementById('displayEmail').textContent = user.email || 'Chưa có';
            document.getElementById('displayName').textContent = user.displayName || userData?.user || 'Chưa cập nhật';
            document.getElementById('displayUid').textContent = user.uid;
            document.getElementById('displayCreated').textContent = user.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleString('vi-VN') : '---';

            // Số ngày tham gia
            if (user.metadata.creationTime) {
                const created = new Date(user.metadata.creationTime);
                const now = new Date();
                const days = getDaysBetween(created, now);
                document.getElementById('memberDays').textContent = days + ' ngày';
            }

            // Admin badge
            if (userData?.isAdmin) {
                document.getElementById('adminBadgeContainer').innerHTML = '<span class="admin-badge"><i class="fas fa-crown"></i> ADMIN</span>';
            }

            // Status online
            const statusEl = document.getElementById('userStatus');
            db.ref('presence/' + user.uid).on('value', snap => {
                const online = snap.val() === true;
                statusEl.className = 'avatar-status' + (online ? '' : ' offline');
                statusEl.title = online ? '🟢 Đang hoạt động' : '⚪ Không hoạt động';
            });

            // Balance
            db.ref('users/' + user.uid + '/balance').on('value', snap => {
                const bal = snap.val() || 0;
                document.getElementById('balanceAmount').textContent = bal.toLocaleString('vi-VN');
                document.getElementById('profileBalance').textContent = bal.toLocaleString('vi-VN') + ' VND';
            });

            // Last login
            db.ref('users/' + user.uid + '/lastLogin').on('value', snap => {
                const lastLogin = snap.val();
                document.getElementById('displayLastLogin').textContent = lastLogin ? new Date(lastLogin).toLocaleString('vi-VN') : 'Lần đầu';
            });

            // Total orders & spent from history
            db.ref('history/' + user.uid).on('value', snap => {
                const data = snap.val() || {};
                const keys = Object.keys(data);
                document.getElementById('totalOrders').textContent = keys.length;
                let totalSpent = 0;
                keys.forEach(key => {
                    totalSpent += data[key].price || 0;
                });
                document.getElementById('totalSpent').textContent = totalSpent.toLocaleString('vi-VN') + 'đ';
            });

            // Notifications
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

            if (!isDataLoaded) { isDataLoaded = true; hideLoading(); }
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
            const popup = document.getElementById('notifPopup');
            popup.classList.toggle('active');
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

        function logout() {
            if (confirm('Đăng xuất?')) {
                const user = auth.currentUser;
                if (user) db.ref('presence/' + user.uid).set(false);
                auth.signOut().then(() => {
                    window.location.replace('../auth/login');
                });
            }
        }

        window.addEventListener('storage', function(e) {
            if (e.key === 'theme' || e.key === 'theme_name') { applyTheme(); }
        });

        showLoading();
        setTimeout(() => { if (!isDataLoaded) hideLoading(); }, 3000);

