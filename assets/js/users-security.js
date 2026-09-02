// Extracted from user/security.html

// ===== Inline script 1 =====
// ===== OTP CLASS =====
        class SimpleOTP {
            constructor() {
                this.authenticator = {
                    check: (token, secret) => this.verifyTOTP(token, secret),
                    generate: (secret) => this.generateTOTP(secret)
                };
            }
            base32Decode(base32) {
                const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
                const bytes = []; let bits = 0, value = 0;
                for (let i = 0; i < base32.length; i++) {
                    const idx = alphabet.indexOf(base32[i].toUpperCase());
                    if (idx === -1) continue;
                    value = (value << 5) | idx; bits += 5;
                    if (bits >= 8) { bytes.push((value >> (bits - 8)) & 0xFF); bits -= 8; }
                }
                return new Uint8Array(bytes);
            }
            async hmacSha1(key, data) {
                const keyData = typeof key === 'string' ? this.base32Decode(key) : key;
                const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
                return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, data));
            }
            dynamicTruncation(hmac) {
                const offset = hmac[hmac.length - 1] & 0xF;
                const binary = ((hmac[offset] & 0x7F) << 24) | ((hmac[offset + 1] & 0xFF) << 16) | ((hmac[offset + 2] & 0xFF) << 8) | (hmac[offset + 3] & 0xFF);
                return binary % 1000000;
            }
            async generateHOTP(secret, counter) {
                const counterBytes = new Uint8Array(8);
                for (let i = 7; i >= 0; i--) { counterBytes[i] = counter & 0xFF; counter = counter >> 8; }
                const hmac = await this.hmacSha1(secret, counterBytes);
                return String(this.dynamicTruncation(hmac)).padStart(6, '0');
            }
            async generateTOTP(secret, window = 0) {
                return await this.generateHOTP(secret, Math.floor(Date.now() / 30000) + window);
            }
            async verifyTOTP(token, secret) {
                if (!token || token.length !== 6 || !secret || secret.length < 10) return false;
                try {
                    for (const w of [0, -1, 1]) {
                        if (await this.generateTOTP(secret, w) === token) return true;
                    }
                    return false;
                } catch { return false; }
            }
            generateSecret() {
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
                let secret = '';
                for (let i = 0; i < 16; i++) secret += chars.charAt(Math.floor(Math.random() * chars.length));
                return secret;
            }
        }

                const otp = new SimpleOTP();
        const authenticator = otp.authenticator;

        let currentUser = null;
        let is2FAEnabled = false;
        let twofaSecret = '';
        let isVerifying = false, isTurningOff = false;
        let verifyAttempts = 3, offAttempts = 3;
        let currentIP = '';

        // ===== IP & LOCATION =====
        async function getIPInfo() {
            try {
                const res = await fetch('https://ipapi.co/json/');
                const data = await res.json();
                return {
                    ip: data.ip || 'Không xác định',
                    city: data.city || 'Không xác định',
                    region: data.region || 'Không xác định',
                    country: data.country_name || 'Không xác định',
                    countryCode: data.country_code || '',
                    lat: data.latitude || 0,
                    lon: data.longitude || 0,
                    org: data.org || 'Không xác định'
                };
            } catch (e) {
                console.log('Lỗi lấy IP:', e);
                return { ip: 'Không xác định', city: 'Không xác định', region: 'Không xác định', country: 'Không xác định' };
            }
        }

        // ===== LỊCH SỬ ĐĂNG NHẬP =====
        function loadLoginHistory(uid) {
            const container = document.getElementById('loginHistoryList');
            db.ref('loginHistory/' + uid).orderByChild('timestamp').limitToLast(20).on('value', async (snap) => {
                const data = snap.val();
                if (!data) {
                    container.innerHTML = `
                        <div class="login-history-empty">
                            <span class="icon"><i class="fas fa-history"></i></span>
                            Chưa có lịch sử đăng nhập
                        </div>
                    `;
                    return;
                }

                // Lấy IP hiện tại
                const ipInfo = await getIPInfo();
                currentIP = ipInfo.ip;

                let html = '';
                const keys = Object.keys(data).reverse();
                keys.forEach(key => {
                    const item = data[key];
                    const isCurrent = item.ip === currentIP;
                    const time = item.timestamp ? new Date(item.timestamp).toLocaleString('vi-VN') : 'Không rõ';
                    const ip = item.ip || 'Không xác định';
                    const location = item.location || 'Không xác định';
                    const browser = item.browser || 'Không xác định';
                    
                    const locationIcon = item.countryCode ? `https://flagcdn.com/24x18/${item.countryCode.toLowerCase()}.png` : '';
                    
                    html += `
                        <div class="login-history-item">
                            <div class="lh-icon ${isCurrent ? 'current' : 'other'}">
                                <i class="fas ${isCurrent ? 'fa-circle-check' : 'fa-laptop'}"></i>
                            </div>
                            <div class="lh-info">
                                <div class="lh-ip">${ip}</div>
                                <div class="lh-location">
                                    ${locationIcon ? `<img src="${locationIcon}" style="width:18px;height:12px;border-radius:2px;object-fit:cover;" />` : ''}
                                    <i class="fas fa-map-pin"></i> ${location}
                                </div>
                                <div class="lh-time"><i class="far fa-clock"></i> ${time} • ${browser}</div>
                            </div>
                            <span class="lh-badge ${isCurrent ? 'current' : 'old'}">
                                ${isCurrent ? '🔵 Hiện tại' : '⚪ Cũ'}
                            </span>
                        </div>
                    `;
                });
                container.innerHTML = html;
            });
        }

        // ===== LƯU LỊCH SỬ ĐĂNG NHẬP (CHỈ KHI IP THAY ĐỔI) =====
        async function saveLoginHistoryIfNew(uid) {
            try {
                const ipInfo = await getIPInfo();
                const ip = ipInfo.ip;
                if (!ip || ip === 'Không xác định') return;

                // Kiểm tra IP cuối cùng
                const lastSnap = await db.ref('loginHistory/' + uid).orderByChild('timestamp').limitToLast(1).once('value');
                const lastData = lastSnap.val();
                let lastIP = null;
                if (lastData) {
                    const keys = Object.keys(lastData);
                    if (keys.length > 0) {
                        lastIP = lastData[keys[0]].ip;
                    }
                }

                // Chỉ lưu nếu IP khác hoặc chưa có lịch sử
                if (lastIP !== ip) {
                    const location = `${ipInfo.city}, ${ipInfo.region}, ${ipInfo.country}`;
                    const ua = navigator.userAgent;
                    let browser = 'Không xác định';
                    if (ua.indexOf('Chrome') > -1) browser = 'Chrome';
                    else if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
                    else if (ua.indexOf('Safari') > -1) browser = 'Safari';
                    else if (ua.indexOf('Edge') > -1) browser = 'Edge';
                    else if (ua.indexOf('Opera') > -1) browser = 'Opera';

                    await db.ref('loginHistory/' + uid).push({
                        ip: ip,
                        location: location,
                        city: ipInfo.city,
                        region: ipInfo.region,
                        country: ipInfo.country,
                        countryCode: ipInfo.countryCode,
                        browser: browser + ' - ' + (navigator.platform || 'Unknown'),
                        timestamp: Date.now()
                    });
                    
                    db.ref('users/' + uid + '/lastLogin').set(Date.now());
                    db.ref('users/' + uid + '/lastIP').set(ip);
                }
            } catch (e) { console.log('Lỗi lưu lịch sử:', e); }
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

        // ===== THEME =====
        function applyTheme() {
            const isDark = localStorage.getItem('theme') === 'dark';
            document.body.classList.toggle('dark-mode', isDark);
            const theme = localStorage.getItem('theme_name') || 'default';
            document.body.className = document.body.className.replace(/theme-\w+/g, '');
            if (theme !== 'default') document.body.classList.add('theme-' + theme);
        }
        applyTheme();

        // ===== 2FA STATUS =====
        function updateTwoFAStatus() {
            const toggle = document.getElementById('twofaToggle');
            if (!toggle) return;
            const isActive = toggle.classList.contains('active');
            const desc = document.getElementById('twofaStatusDesc');
            const badge = document.getElementById('twofaStatusBadge');
            if (isActive) {
                if (desc) { desc.textContent = 'Đã kích hoạt'; desc.style.color = 'var(--success)'; }
                if (badge) { badge.textContent = 'Bật'; badge.className = 'twofa-status on'; }
            } else {
                if (desc) { desc.textContent = 'Chưa kích hoạt'; desc.style.color = 'var(--text-muted)'; }
                if (badge) { badge.textContent = 'Tắt'; badge.className = 'twofa-status off'; }
            }
        }

        // ===== 2FA FUNCTIONS =====
        function toggleTwoFA() {
            const user = auth.currentUser;
            const toggle = document.getElementById('twofaToggle');
            if (!toggle) return;
            if (toggle.classList.contains('active')) {
                offAttempts = 3;
                document.getElementById('otpOffInput').value = '';
                document.getElementById('otpOffError').classList.remove('show');
                document.getElementById('offAttemptCount').textContent = offAttempts;
                document.getElementById('twofaOffModal').classList.add('active');
                setTimeout(() => document.getElementById('otpOffInput').focus(), 200);
                return;
            }
            const uid = user ? user.uid : null;
            if (!uid) { showToast('Vui lòng đăng nhập!', 'error'); return; }
            db.ref('users/' + uid + '/twofaEnabled').once('value').then((snap) => {
                if (snap.val() === true) { toggle.classList.add('active'); updateTwoFAStatus(); return; }
                twofaSecret = otp.generateSecret();
                document.getElementById('secretKeyDisplay').textContent = twofaSecret;
                document.getElementById('otpInput').value = '';
                document.getElementById('otpError').classList.remove('show');
                document.getElementById('otpInput').classList.remove('error', 'success');
                verifyAttempts = 3;
                document.getElementById('attemptCount').textContent = verifyAttempts;
                document.getElementById('twofaModal').classList.add('active');
                setTimeout(() => document.getElementById('otpInput').focus(), 200);
            });
        }

        function copySecret() {
            const secret = document.getElementById('secretKeyDisplay').textContent;
            const btn = document.getElementById('copyBtn');
            if (navigator.clipboard) {
                navigator.clipboard.writeText(secret).then(() => {
                    btn.innerHTML = '<i class="fas fa-check"></i> Đã sao chép!';
                    btn.classList.add('copied');
                    setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i> Sao chép'; btn.classList.remove('copied'); }, 2000);
                });
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = secret;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                btn.innerHTML = '<i class="fas fa-check"></i> Đã sao chép!';
                btn.classList.add('copied');
                setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i> Sao chép'; btn.classList.remove('copied'); }, 2000);
            }
        }

        function pasteOTP() {
            if (navigator.clipboard) {
                navigator.clipboard.readText().then(text => {
                    const cleaned = text.replace(/\D/g, '').slice(0, 6);
                    if (cleaned.length === 6) { document.getElementById('otpInput').value = cleaned; verifyOTP(); }
                    else { document.getElementById('otpError').textContent = '❌ Vui lòng dán đúng mã OTP 6 số!'; document.getElementById('otpError').classList.add('show'); }
                }).catch(() => showToast('Không thể đọc clipboard.', 'error'));
            } else showToast('Trình duyệt không hỗ trợ dán.', 'error');
        }

        function pasteOTPOff() {
            if (navigator.clipboard) {
                navigator.clipboard.readText().then(text => {
                    const cleaned = text.replace(/\D/g, '').slice(0, 6);
                    if (cleaned.length === 6) { document.getElementById('otpOffInput').value = cleaned; turnOff2FA(); }
                    else { document.getElementById('otpOffError').textContent = '❌ Vui lòng dán đúng mã OTP 6 số!'; document.getElementById('otpOffError').classList.add('show'); }
                }).catch(() => showToast('Không thể đọc clipboard.', 'error'));
            } else showToast('Trình duyệt không hỗ trợ dán.', 'error');
        }

        async function verifyOTP() {
            if (isVerifying) return;
            const otpInput = document.getElementById('otpInput');
            const otpValue = otpInput.value.trim();
            if (otpValue.length !== 6 || !/^\d{6}$/.test(otpValue)) {
                document.getElementById('otpError').textContent = '❌ Vui lòng nhập đúng mã OTP 6 số!';
                document.getElementById('otpError').classList.add('show');
                otpInput.classList.add('error');
                return;
            }
            isVerifying = true;
            const btn = document.getElementById('btnVerifyOTP');
            btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xác thực...';
            try {
                const user = auth.currentUser;
                let uid = user ? user.uid : null;
                if (!uid) { showToast('Vui lòng đăng nhập lại!', 'error'); isVerifying = false; btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Xác nhận'; return; }
                let secret = twofaSecret;
                if (!secret) { const snap = await db.ref('users/' + uid + '/twofaSecret').once('value'); secret = snap.val(); }
                if (!secret) { document.getElementById('otpError').textContent = '❌ Không tìm thấy secret key!'; document.getElementById('otpError').classList.add('show'); isVerifying = false; btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Xác nhận'; return; }
                const isValid = await authenticator.check(otpValue, secret);
                if (isValid) {
                    await db.ref('users/' + uid).update({ twofaEnabled: true, twofaSecret: secret });
                    otpInput.classList.remove('error'); otpInput.classList.add('success');
                    document.getElementById('otpError').classList.remove('show');
                    btn.innerHTML = '<i class="fas fa-check"></i> Thành công';
                    showToast('✅ Đã kích hoạt xác thực 2 lớp thành công!', 'success');
                    document.getElementById('twofaToggle').classList.add('active');
                    is2FAEnabled = true;
                    updateTwoFAStatus();
                    closeOTPModal();
                } else {
                    verifyAttempts--;
                    document.getElementById('attemptCount').textContent = verifyAttempts;
                    otpInput.classList.add('error');
                    document.getElementById('otpError').textContent = `❌ Mã OTP không đúng! Còn ${verifyAttempts} lần thử.`;
                    document.getElementById('otpError').classList.add('show');
                    if (verifyAttempts <= 0) {
                        document.getElementById('otpError').textContent = '❌ Bạn đã nhập sai quá nhiều lần!';
                        setTimeout(() => { closeOTPModal(); isVerifying = false; btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Xác nhận'; }, 2000);
                        return;
                    }
                    otpInput.value = ''; otpInput.focus();
                }
            } catch (error) { showToast('❌ Lỗi: ' + error.message, 'error'); }
            isVerifying = false;
            btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Xác nhận';
        }

        async function turnOff2FA() {
            if (isTurningOff) return;
            const otpInput = document.getElementById('otpOffInput');
            const otpValue = otpInput.value.trim();
            if (otpValue.length !== 6 || !/^\d{6}$/.test(otpValue)) {
                document.getElementById('otpOffError').textContent = '❌ Vui lòng nhập đúng mã OTP 6 số!';
                document.getElementById('otpOffError').classList.add('show');
                otpInput.classList.add('error');
                return;
            }
            isTurningOff = true;
            const btn = document.getElementById('btnTurnOff');
            btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xác thực...';
            try {
                const user = auth.currentUser;
                let uid = user ? user.uid : null;
                if (!uid) { showToast('Vui lòng đăng nhập lại!', 'error'); isTurningOff = false; btn.disabled = false; btn.innerHTML = '<i class="fas fa-unlock"></i> Tắt'; return; }
                const snap = await db.ref('users/' + uid + '/twofaSecret').once('value');
                const secret = snap.val();
                if (!secret) { document.getElementById('otpOffError').textContent = '❌ Không tìm thấy secret key!'; document.getElementById('otpOffError').classList.add('show'); isTurningOff = false; btn.disabled = false; btn.innerHTML = '<i class="fas fa-unlock"></i> Tắt'; return; }
                const isValid = await authenticator.check(otpValue, secret);
                if (isValid) {
                    await db.ref('users/' + uid).update({ twofaEnabled: false, twofaSecret: null });
                    otpInput.classList.remove('error'); otpInput.classList.add('success');
                    document.getElementById('otpOffError').classList.remove('show');
                    btn.innerHTML = '<i class="fas fa-check"></i> Thành công';
                    showToast('✅ Đã tắt xác thực 2 lớp!', 'success');
                    document.getElementById('twofaToggle').classList.remove('active');
                    is2FAEnabled = false;
                    updateTwoFAStatus();
                    closeTwoFAOff();
                } else {
                    offAttempts--;
                    document.getElementById('offAttemptCount').textContent = offAttempts;
                    otpInput.classList.add('error');
                    document.getElementById('otpOffError').textContent = `❌ Mã OTP không đúng! Còn ${offAttempts} lần thử.`;
                    document.getElementById('otpOffError').classList.add('show');
                    if (offAttempts <= 0) {
                        document.getElementById('otpOffError').textContent = '❌ Bạn đã nhập sai quá nhiều lần!';
                        setTimeout(() => { closeTwoFAOff(); isTurningOff = false; btn.disabled = false; btn.innerHTML = '<i class="fas fa-unlock"></i> Tắt'; }, 2000);
                        return;
                    }
                    otpInput.value = ''; otpInput.focus();
                }
            } catch (error) { showToast('❌ Lỗi: ' + error.message, 'error'); }
            isTurningOff = false;
            btn.disabled = false; btn.innerHTML = '<i class="fas fa-unlock"></i> Tắt';
        }

        function closeOTPModal() {
            document.getElementById('twofaModal').classList.remove('active');
            document.getElementById('otpInput').value = '';
            document.getElementById('otpError').classList.remove('show');
            isVerifying = false;
            document.getElementById('btnVerifyOTP').disabled = false;
            document.getElementById('btnVerifyOTP').innerHTML = '<i class="fas fa-check"></i> Xác nhận';
        }

        function closeTwoFAOff() {
            document.getElementById('twofaOffModal').classList.remove('active');
            document.getElementById('otpOffInput').value = '';
            document.getElementById('otpOffError').classList.remove('show');
            isTurningOff = false;
            document.getElementById('btnTurnOff').disabled = false;
            document.getElementById('btnTurnOff').innerHTML = '<i class="fas fa-unlock"></i> Tắt';
        }

        // ===== AUTH =====
        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.replace('../auth/login');
                return;
            }
            currentUser = user;
            db.ref('presence/' + user.uid).set(true);
            db.ref('presence/' + user.uid).onDisconnect().set(false);
            
            // Lưu lịch sử đăng nhập (chỉ khi IP thay đổi)
            await saveLoginHistoryIfNew(user.uid);
            loadLoginHistory(user.uid);
            
            db.ref('users/' + user.uid + '/balance').on('value', snap => {
                document.getElementById('balanceAmount').textContent = (snap.val() || 0).toLocaleString('vi-VN');
            });
            db.ref('users/' + user.uid + '/twofaEnabled').on('value', snap => {
                const enabled = snap.val() === true;
                document.getElementById('twofaToggle').classList.toggle('active', enabled);
                is2FAEnabled = enabled;
                updateTwoFAStatus();
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
        });

        // ===== CHANGE PASSWORD =====
        document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const current = document.getElementById('currentPassword').value;
            const newPass = document.getElementById('newPassword').value;
            const confirm = document.getElementById('confirmPassword').value;
            const msg = document.getElementById('message');
            if (newPass.length < 6) { msg.textContent = '❌ Mật khẩu tối thiểu 6 ký tự!'; msg.className = 'message error'; return; }
            if (newPass !== confirm) { msg.textContent = '❌ Mật khẩu không khớp!'; msg.className = 'message error'; return; }
            const btn = document.querySelector('.btn-change');
            btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
            try {
                const user = auth.currentUser;
                if (!user) {
                    showToast('Vui lòng đăng nhập lại!', 'error');
                    btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync"></i> Cập nhật mật khẩu';
                    return;
                }
                const credential = firebase.auth.EmailAuthProvider.credential(user.email, current);
                await user.reauthenticateWithCredential(credential);
                await user.updatePassword(newPass);
                msg.textContent = '✅ Đổi mật khẩu thành công!';
                msg.className = 'message success';
                document.getElementById('currentPassword').value = '';
                document.getElementById('newPassword').value = '';
                document.getElementById('confirmPassword').value = '';
                showToast('✅ Đổi mật khẩu thành công!', 'success');
            } catch (error) {
                let err = '❌ Lỗi: ';
                if (error.code === 'auth/wrong-password') err += 'Mật khẩu hiện tại sai!';
                else err += error.message;
                msg.textContent = err;
                msg.className = 'message error';
                showToast(err, 'error');
            }
            btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync"></i> Cập nhật mật khẩu';
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

        function logout() {
            if (confirm('Đăng xuất?')) {
                const user = auth.currentUser;
                if (user) db.ref('presence/' + user.uid).set(false);
                auth.signOut().then(() => {
                    window.location.replace('../auth/login');
                });
            }
        }

        document.getElementById('otpInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') verifyOTP(); });
        document.getElementById('otpInput')?.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '');
            if (this.value.length === 6) { document.getElementById('otpError').classList.remove('show'); this.classList.remove('error'); }
        });
        document.getElementById('otpOffInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') turnOff2FA(); });
        document.getElementById('otpOffInput')?.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '');
            if (this.value.length === 6) { document.getElementById('otpOffError').classList.remove('show'); this.classList.remove('error'); }
        });
        document.getElementById('twofaModal')?.addEventListener('click', function(e) { if (e.target === this) closeOTPModal(); });
        document.getElementById('twofaOffModal')?.addEventListener('click', function(e) { if (e.target === this) closeTwoFAOff(); });

        window.addEventListener('storage', function(e) {
            if (e.key === 'theme' || e.key === 'theme_name') { applyTheme(); }
        });

