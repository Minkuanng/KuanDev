// Extracted from pages/earn-money.html

let currentUser = null;
        let currentUserData = null;
        let bypassAmount = 300;
        let dailyLimit = 5;
        let cooldownSeconds = 30;
        let generatedLink = null;
        let isGenerating = false;

        const LINK4M_PROXY = '../api/link4m';
        const CHECKER_URL = 'https://kuandev.dpdns.org/assets/bypass/checker.html';

        // Mã 24 ký tự, cứ 4 ký tự có một dấu "-": XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
        const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        function generateBypassCode() {
            const bytes = new Uint8Array(24);
            crypto.getRandomValues(bytes);
            let raw = '';
            for (let i = 0; i < 24; i++) raw += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
            return raw.match(/.{1,4}/g).join('-');
        }

        function showToast(msg, type = '') {
            const el = document.getElementById('toast');
            el.textContent = msg;
            el.className = 'toast ' + type;
            el.classList.add('show');
            clearTimeout(el.timeout);
            el.timeout = setTimeout(() => el.classList.remove('show'), 3000);
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
            if (overlay) { overlay.classList.add('hidden'); overlay.style.display = 'none'; }
        }

        function showLoading() {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) { overlay.style.display = 'flex'; overlay.classList.remove('hidden'); }
        }

        async function loadSettings() {
            try {
                const snap = await db.ref('settings/bypass').once('value');
                const data = snap.val() || {};
                bypassAmount = 300;
                dailyLimit = data.dailyLimit || 5;
                cooldownSeconds = data.cooldownSeconds || 30;

                document.getElementById('perBypassAmount').textContent = bypassAmount.toLocaleString('vi-VN') + ' VND';
                document.getElementById('cooldownDisplay').textContent = cooldownSeconds + ' giây';
                document.getElementById('dailyLimitDisplay').textContent = dailyLimit + ' lần';
            } catch(e) {
                console.log('Lỗi load settings:', e);
            }
        }

        function getTodayKey() {
            const date = new Date();
            return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
        }

        async function loadUserStats(uid) {
            try {
                // Lấy tổng kiếm được
                const totalSnap = await db.ref('users/' + uid + '/totalEarned').once('value');
                const totalEarned = totalSnap.val() || 0;
                document.getElementById('totalEarned').textContent = totalEarned.toLocaleString('vi-VN') + 'đ';

                // Lấy số lần và tiền hôm nay từ earn-history
                const today = getTodayKey();
                const historySnap = await db.ref('earn-history/' + uid).orderByChild('timestamp').once('value');
                const data = historySnap.val() || {};
                let todayCount = 0;
                let todayAmount = 0;
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);

                Object.keys(data).forEach(key => {
                    const entry = data[key];
                    if (entry.timestamp && entry.timestamp >= todayStart.getTime() && entry.status === 'completed') {
                        todayCount++;
                        todayAmount += entry.amount || 0;
                    }
                });

                document.getElementById('todayCount').textContent = todayCount;
                document.getElementById('todayEarned').textContent = todayAmount.toLocaleString('vi-VN') + 'đ';

                // Load lịch sử
                loadHistory(uid);

            } catch(e) {
                console.log('Lỗi load stats:', e);
            }
        }

        async function loadHistory(uid) {
            const container = document.getElementById('historyList');
            try {
                const snap = await db.ref('earn-history/' + uid).orderByChild('timestamp').limitToLast(20).once('value');
                const data = snap.val() || {};
                const keys = Object.keys(data);

                if (keys.length === 0) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <span class="icon">📭</span>
                            <p>Chưa có lịch sử kiếm tiền</p>
                        </div>
                    `;
                    return;
                }

                let html = '';
                const sortedKeys = keys.sort((a, b) => (data[b].timestamp || 0) - (data[a].timestamp || 0));

                sortedKeys.forEach(key => {
                    const item = data[key];
                    const time = item.timestamp ? new Date(item.timestamp).toLocaleString('vi-VN') : 'Không rõ';
                    const amount = item.amount || 0;
                    const status = item.status || 'pending';
                    const statusText = status === 'completed' ? '✅ Thành công' : status === 'pending' ? '⏳ Chờ' : '❌ Thất bại';
                    const linkDisplay = item.link || 'Không rõ';
                    const shortLink = linkDisplay.length > 40 ? linkDisplay.substring(0, 40) + '...' : linkDisplay;

                    html += `
                        <div class="history-item">
                            <div class="h-left">
                                <span class="h-link" title="${linkDisplay}">🔗 ${shortLink}</span>
                                <span class="h-time"><i class="far fa-clock"></i> ${time}</span>
                            </div>
                            <div class="h-right">
                                <span class="h-amount">+${amount.toLocaleString('vi-VN')}đ</span>
                                <span class="h-status ${status}">${statusText}</span>
                            </div>
                        </div>
                    `;
                });

                container.innerHTML = html;

            } catch(e) {
                console.log('Lỗi load history:', e);
                container.innerHTML = `
                    <div class="empty-state">
                        <span class="icon">❌</span>
                        <p>Lỗi tải lịch sử</p>
                    </div>
                `;
            }
        }

        async function shortenLinkWithLink4m(longUrl) {
            try {
                const response = await fetch(`${LINK4M_PROXY}?url=${encodeURIComponent(longUrl)}`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' }
                });
                const raw = await response.text();
                let data;
                try { data = JSON.parse(raw); } catch { data = {}; }

                if (!response.ok) {
                    throw new Error(data.message || `Link4m HTTP ${response.status}`);
                }

                const shortened = data.shortenedUrl || data.shortened_url || data.url;
                if (data.status === 'success' && shortened) return shortened;
                throw new Error(data.message || 'Link4m không trả về shortenedUrl');
            } catch(e) {
                console.error('Lỗi Link4m API:', e);
                throw new Error('Không thể rút gọn link. Hãy kiểm tra API Link4m/Vercel Function.');
            }
        }

        async function generateBypassLink() {
            if (isGenerating) return;
            if (!currentUser) {
                showToast('⚠️ Vui lòng đăng nhập!', 'error');
                return;
            }

            isGenerating = true;
            const btn = document.getElementById('btnGenerate');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tạo link4m...';

            try {
                // Link đích là cố định: checker.html?code=RANDOM_CODE
                const finalCode = generateBypassCode();
                const checkerFullUrl = `${CHECKER_URL}?code=${encodeURIComponent(finalCode)}`;

                const tokenData = {
                    uid: currentUser.uid,
                    // Đây là link đích mà Link4m sẽ redirect về.
                    originalLink: checkerFullUrl,
                    checkerUrl: checkerFullUrl,
                    amount: 300,
                    status: 'pending',
                    createdAt: firebase.database.ServerValue.TIMESTAMP
                };

                // Tạo token trước, sau đó mới gọi Link4m.
                const tokenRef = db.ref('bypass-tokens/' + finalCode);
                const tokenSnap = await tokenRef.once('value');
                if (tokenSnap.exists()) {
                    throw new Error('Mã vừa bị trùng, vui lòng bấm lại.');
                }
                await tokenRef.set(tokenData);

                // Rút gọn chính xác checker URL.
                const shortened = await shortenLinkWithLink4m(checkerFullUrl);

                await tokenRef.update({
                    shortenedLink: shortened,
                    updatedAt: firebase.database.ServerValue.TIMESTAMP
                });

                generatedLink = {
                    original: checkerFullUrl,
                    shortened,
                    checker: checkerFullUrl,
                    code: finalCode
                };

                const resultBox = document.getElementById('resultBox');
                const resultLink = document.getElementById('resultLink');
                resultLink.innerHTML = `<a href="${shortened}" target="_blank" rel="noopener">${shortened}</a>`;
                resultBox.classList.add('active');

                await db.ref('bypass-logs/' + currentUser.uid).push({
                    link: checkerFullUrl,
                    shortened,
                    checkerLink: checkerFullUrl,
                    code: finalCode,
                    status: 'generated',
                    amount: 300,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                });

                showToast('✅ Đã tạo Link4m thành công!', 'success');
            } catch(e) {
                console.error('Lỗi tạo link:', e);
                showToast('❌ Không thể tạo link: ' + (e.message || e), 'error');
            } finally {
                isGenerating = false;
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Tạo link vượt ngay';
            }
        }

        function visitResultLink() {
            if (!generatedLink) {
                showToast('⚠️ Chưa có link!', 'error');
                return;
            }
            window.open(generatedLink.shortened, '_blank');
        }

        function goHome() { closeMenu(); window.location.href = '../../index'; }
        function goHistory() { closeMenu(); window.location.href = '../../pages/history'; }
        function goTopup() { closeMenu(); showToast('💰 Đang phát triển!', 'error'); }
        function goEarn() { closeMenu(); window.location.href = 'earn-money'; }
        function goSupport() { closeMenu(); window.location.href = '../../pages/support'; }
        function goToProfile() { window.location.href = '../../user/profile'; }
        function goToSecurity() { window.location.href = '../../user/security'; }
        function goToBalance() { window.location.href = '../../user/balance'; }
        function goToSettings() { window.location.href = '../../user/settings'; }

        function toggleMenu() {
            document.getElementById('sideMenu').classList.toggle('active');
            document.getElementById('menuOverlay').classList.toggle('active');
        }

        function closeMenu() {
            document.getElementById('sideMenu').classList.remove('active');
            document.getElementById('menuOverlay').classList.remove('active');
        }

        function togglePopup(e) {
            e.stopPropagation();
            document.getElementById('settingsPopup').classList.toggle('active');
        }

        document.addEventListener('click', function(e) {
            const popup = document.getElementById('settingsPopup');
            const wrapper = document.querySelector('.settings-wrapper');
            if (wrapper && !wrapper.contains(e.target)) {
                popup.classList.remove('active');
            }
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

        function logout() {
            if (confirm('Đăng xuất?')) {
                const user = auth.currentUser;
                if (user) db.ref('presence/' + user.uid).set(false);
                auth.signOut().then(() => {
                    window.location.replace('../../auth/login');
                });
            }
        }

        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.replace('../../auth/login.html?redirect=' + encodeURIComponent(window.location.href));
                return;
            }
            currentUser = user;

            // Lấy dữ liệu user
            const userSnap = await db.ref('users/' + user.uid).once('value');
            currentUserData = userSnap.val() || {};

            // Cập nhật balance
            db.ref('users/' + user.uid + '/balance').on('value', snap => {
                const bal = snap.val() || 0;
                document.getElementById('balanceAmount').textContent = bal.toLocaleString('vi-VN');
            });

            // Load settings
            await loadSettings();

            // Load stats
            await loadUserStats(user.uid);

            // Presence
            db.ref('presence/' + user.uid).set(true);
            db.ref('presence/' + user.uid).onDisconnect().set(false);

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

            hideLoading();
        });

        window.addEventListener('storage', function(e) {
            if (e.key === 'theme' || e.key === 'theme_name') { applyTheme(); }
        });

        showLoading();
        setTimeout(() => { if (document.getElementById('loadingOverlay') && !document.getElementById('loadingOverlay').classList.contains('hidden')) hideLoading(); }, 3000);

