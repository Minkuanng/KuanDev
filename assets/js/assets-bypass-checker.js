// Extracted from assets/bypass/checker.html

let currentUser = null;
        let linkData = null;
        let isChecking = false;
        let bypassAmount = 300;
        let dailyLimit = 5;
        let cooldownSeconds = 30;

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
        }
        applyTheme();

        async function loadSettings() {
            try {
                const snap = await db.ref('settings/bypass').once('value');
                const data = snap.val() || {};
                bypassAmount = 300;
                dailyLimit = data.dailyLimit || 5;
                cooldownSeconds = data.cooldownSeconds || 30;
                document.getElementById('displayAmount').textContent = `+${bypassAmount.toLocaleString('vi-VN')} VND`;
            } catch(e) { console.log('Lỗi load settings:', e); }
        }

        function getQueryParam(param) {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get(param);
        }

        async function loadLinkData() {
            const code = getQueryParam('code');

            if (!code) {
                document.getElementById('displayLink').textContent = '❌ Mã không hợp lệ!';
                showToast('Không tìm thấy mã vượt link!', 'error');
                return;
            }

            const normalizedCode = code.trim().toUpperCase();
            if (!/^[A-Z0-9]{4}(?:-[A-Z0-9]{4}){5}$/.test(normalizedCode)) {
                document.getElementById('displayLink').textContent = '❌ Mã không đúng định dạng!';
                showToast('Mã phải có 24 ký tự dạng XXXX-XXXX-XXXX-XXXX-XXXX-XXXX.', 'error');
                return;
            }

            const snap = await db.ref('bypass-tokens/' + normalizedCode).once('value');
            const data = snap.val();

            if (!data) {
                document.getElementById('displayLink').textContent = '❌ Mã không tồn tại hoặc đã bị xóa!';
                showToast('Mã vượt link không tồn tại!', 'error');
                return;
            }

            linkData = {
                code: normalizedCode,
                originalLink: data.originalLink || '',
                uid: data.uid,
                ref: data.shortenedLink || ''
            };

            document.getElementById('displayLink').textContent = linkData.originalLink || 'Link đã tạo';
            document.getElementById('displayAmount').textContent = '+300 VND';
        }

        function getTodayKey() {
            const date = new Date();
            return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
        }

        async function checkBypass() {
            if (isChecking) return;
            // Người vượt không cần đăng nhập.
            // Nếu chưa có session Firebase thì dùng anonymous auth để ghi nhận lượt.
            if (!currentUser) {
                try {
                    const cred = await auth.signInAnonymously();
                    currentUser = cred.user;
                } catch (e) {
                    throw new Error('Không thể xác nhận lượt vượt. Hãy bật Anonymous Authentication trong Firebase.');
                }
            }
            if (!linkData) {
                showToast('Không có dữ liệu link!', 'error');
                return;
            }

            const btn = document.getElementById('btnCheck');
            const statusEl = document.getElementById('statusMessage');
            isChecking = true;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xác nhận...';
            const autoBox = document.getElementById('autoClaimBox');
            if (autoBox) autoBox.style.display = 'none';
            statusEl.className = 'status-box pending';
            statusEl.textContent = '⏳ Đang tự động xác nhận mã...';
            statusEl.style.display = 'block';

            try {
                // UID nhận tiền = UID của người TẠO mã, không phải người đang vượt link.
                const ownerUid = linkData.uid;
                const today = getTodayKey();

                if (!ownerUid) {
                    throw new Error('Mã không có thông tin người tạo.');
                }

                // Không dùng cooldown/giới hạn ở checker.
                // Mỗi mã chỉ được nhận đúng 1 lần bằng transaction Firebase.
                // Claim atomically: chỉ lượt đầu tiên mới được cộng tiền.
                const tokenRef = db.ref('bypass-tokens/' + linkData.code);
                const claimResult = await tokenRef.transaction(current => {
                    if (!current || current.uid !== ownerUid || current.status !== 'pending') {
                        return;
                    }
                    return {
                        ...current,
                        status: 'claimed',
                        claimedBy: currentUser.uid,
                        claimedAt: firebase.database.ServerValue.TIMESTAMP
                    };
                });

                if (!claimResult.committed) {
                    statusEl.className = 'status-box failed';
                    statusEl.textContent = '❌ Mã này đã được sử dụng hoặc không còn hợp lệ.';
                    showToast('Mã đã được nhận tiền trước đó!', 'error');
                    return;
                }

                // Ghi lịch sử vào tài khoản CHỦ LINK.
                const earnRef = db.ref('earn-history/' + ownerUid).push();
                await earnRef.set({
                    link: linkData.originalLink,
                    shortenedLink: linkData.ref || '',
                    checkerLink: `${window.location.origin}${window.location.pathname}?code=${encodeURIComponent(linkData.code)}`,
                    code: linkData.code,
                    amount: bypassAmount,
                    status: 'completed',
                    createdBy: ownerUid,
                    verifiedBy: currentUser.uid,
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    date: today
                });

                // Cộng tiền cho CHỦ LINK.
                await db.ref('users/' + ownerUid + '/balance')
                    .transaction(current => (Number(current) || 0) + Number(bypassAmount));
                await db.ref('users/' + ownerUid + '/totalEarned')
                    .transaction(current => (Number(current) || 0) + Number(bypassAmount));

                await db.ref('bypass-logs/' + ownerUid).push({
                    link: linkData.originalLink,
                    shortenedLink: linkData.ref || '',
                    code: linkData.code,
                    status: 'success',
                    amount: bypassAmount,
                    claimedBy: currentUser.uid,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                });

                statusEl.className = 'status-box success';
                statusEl.textContent = `✅ Vượt thành công! ${bypassAmount.toLocaleString('vi-VN')}đ đã cộng cho chủ link.`;
                showToast(`✅ Thành công! Chủ link nhận ${bypassAmount.toLocaleString('vi-VN')}đ`, 'success');
                document.getElementById('displayAmount').textContent = `+${bypassAmount.toLocaleString('vi-VN')} VND`;
                btn.innerHTML = '<i class="fas fa-check"></i> Đã xác nhận';
            } catch(error) {
                console.error('Lỗi check bypass:', error);
                statusEl.className = 'status-box failed';
                statusEl.textContent = '❌ Lỗi: ' + (error.message || error);
                showToast('❌ Lỗi: ' + (error.message || error), 'error');
            } finally {
                if (!document.getElementById('statusMessage').classList.contains('success')) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-check-circle"></i> Xác nhận đã vượt';
                }
                isChecking = false;
            }
        }

        async function getIP() {
            try {
                const res = await fetch('https://api.ipify.org?format=json');
                const data = await res.json();
                return data.ip || 'unknown';
            } catch(e) {
                return 'unknown';
            }
        }

        function goBack() {
            window.location.href = '../../index';
        }

        auth.onAuthStateChanged(async (user) => {
            try {
                if (!user) {
                    // Người vượt không cần tài khoản KuanZGame.
                    const cred = await auth.signInAnonymously();
                    currentUser = cred.user;
                } else {
                    currentUser = user;
                }

                await loadSettings();
                await loadLinkData();

                if (linkData) {
                    document.getElementById('displayLink').textContent = linkData.originalLink || linkData.checkerUrl;
                    // Tự động cộng tiền ngay khi Link4m redirect về checker.
                    await checkBypass();
                }
            } catch (e) {
                console.error('Auto claim error:', e);
                const box = document.getElementById('autoClaimBox');
                if (box) {
                    box.className = 'status-box failed';
                    box.textContent = '❌ ' + (e.message || 'Không thể xác nhận lượt vượt.');
                }
            }
        });

        document.querySelectorAll('.modal-overlay, .order-popup-overlay').forEach(el => {
            if (el) el.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('active'); });
        });

        window.addEventListener('storage', function(e) {
            if (e.key === 'theme') { applyTheme(); }
        });

