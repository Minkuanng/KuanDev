// Extracted from auth/login.html

class OTPVerifier {
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
        }

        const otpVerifier = new OTPVerifier();
        let pendingUser = null;
        let otpAttempts = 3;
        let isVerifying = false;

        function applyTheme() {
            if (localStorage.getItem('theme') === 'dark') {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
            const savedTheme = localStorage.getItem('theme_name') || 'default';
            document.body.classList.remove(
                'theme-galaxy', 'theme-ocean', 'theme-forest', 
                'theme-sunset', 'theme-cherry', 'theme-neon',
                'theme-lavender', 'theme-mint', 'theme-coffee'
            );
            if (savedTheme !== 'default') {
                document.body.classList.add('theme-' + savedTheme);
            }
        }
        applyTheme();
        window.addEventListener('storage', function(e) {
            if (e.key === 'theme' || e.key === 'theme_name') { applyTheme(); }
        });

        const loginForm = document.getElementById('loginForm');
        const loginInput = document.getElementById('loginInput');
        const passwordInput = document.getElementById('password');
        const messageDiv = document.getElementById('message');
        const togglePasswordBtn = document.getElementById('togglePassword');
        const termsCheckbox = document.getElementById('termsCheckbox');
        const termsError = document.getElementById('termsError');

        let isPasswordVisible = false;
        togglePasswordBtn.addEventListener('click', () => {
            isPasswordVisible = !isPasswordVisible;
            passwordInput.type = isPasswordVisible ? 'text' : 'password';
            togglePasswordBtn.innerHTML = isPasswordVisible ?
                `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>` :
                `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>`;
        });

        function showMessage(text, type) {
            messageDiv.textContent = text;
            messageDiv.className = 'message ' + type;
            messageDiv.style.display = 'block';
        }

        function hideMessage() { messageDiv.style.display = 'none'; }

        function showOTPModal() {
            document.getElementById('twofaModal').classList.add('active');
            document.getElementById('otpInput').value = '';
            document.getElementById('otpError').classList.remove('show');
            otpAttempts = 3;
            document.getElementById('attemptCount').textContent = otpAttempts;
            setTimeout(() => document.getElementById('otpInput').focus(), 200);
        }

        function closeOTPModal() {
            document.getElementById('twofaModal').classList.remove('active');
            pendingUser = null;
            otpAttempts = 3;
            isVerifying = false;
            document.getElementById('btnVerifyOTP').disabled = false;
            document.getElementById('btnVerifyOTP').textContent = '✅ Xác nhận';
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

            if (!pendingUser) {
                document.getElementById('otpError').textContent = '❌ Lỗi: Không tìm thấy thông tin đăng nhập!';
                document.getElementById('otpError').classList.add('show');
                return;
            }

            isVerifying = true;
            const btn = document.getElementById('btnVerifyOTP');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xác thực...';

            try {
                const isValid = await otpVerifier.authenticator.check(otpValue, pendingUser.twofaSecret);
                if (isValid) {
                    document.getElementById('otpError').classList.remove('show');
                    otpInput.classList.add('success');
                    btn.innerHTML = '✅ Thành công!';
                    
                    await db.ref('presence/' + pendingUser.uid).set(true);
                    db.ref('presence/' + pendingUser.uid).onDisconnect().set(false);
                    showMessage('✅ Đăng nhập thành công! Đang chuyển hướng...', 'success');
                    
                    setTimeout(() => {
                        closeOTPModal();
                        window.location.href = '../index';
                    }, 1000);
                } else {
                    otpAttempts--;
                    document.getElementById('attemptCount').textContent = otpAttempts;
                    otpInput.classList.add('error');
                    document.getElementById('otpError').textContent = `❌ Mã OTP không đúng! Còn ${otpAttempts} lần thử.`;
                    document.getElementById('otpError').classList.add('show');
                    if (otpAttempts <= 0) {
                        document.getElementById('otpError').textContent = '❌ Bạn đã nhập sai quá nhiều lần! Vui lòng đăng nhập lại.';
                        setTimeout(() => {
                            closeOTPModal();
                            pendingUser = null;
                            showMessage('⚠️ Đã hủy đăng nhập do nhập sai quá nhiều lần.', 'error');
                        }, 2000);
                        return;
                    }
                    otpInput.value = '';
                    otpInput.focus();
                }
            } catch (error) {
                document.getElementById('otpError').textContent = '❌ Lỗi xác thực: ' + error.message;
                document.getElementById('otpError').classList.add('show');
            }

            isVerifying = false;
            btn.disabled = false;
            btn.innerHTML = '✅ Xác nhận';
        }

        document.getElementById('otpInput').addEventListener('keydown', function(e) {
            if (e.key === 'Enter') verifyOTP();
        });
        document.getElementById('otpInput').addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '');
            if (this.value.length === 6) {
                document.getElementById('otpError').classList.remove('show');
                this.classList.remove('error');
            }
        });

        async function findEmailByUsername(username) {
            try {
                const snapshot = await db.ref('users').once('value');
                const users = snapshot.val();
                if (!users) return null;
                for (const uid in users) {
                    if (users[uid].user && users[uid].user.toLowerCase() === username.toLowerCase()) {
                        return { email: users[uid].email, uid: uid, data: users[uid] };
                    }
                }
                return null;
            } catch (e) {
                console.error('Lỗi tìm username:', e);
                return null;
            }
        }

        async function checkUserBlocked(uid) {
            try {
                const snapshot = await db.ref('users/' + uid + '/blocked').once('value');
                return snapshot.val() === true;
            } catch (e) { return false; }
        }

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideMessage();
            
            if (!termsCheckbox.checked) {
                termsError.classList.add('show');
                termsCheckbox.style.borderColor = '#e74c6f';
                setTimeout(() => {
                    termsError.classList.remove('show');
                    termsCheckbox.style.borderColor = '';
                }, 3000);
                return;
            }
            termsError.classList.remove('show');
            
            const loginValue = loginInput.value.trim();
            const password = passwordInput.value.trim();

            if (!loginValue || !password) {
                showMessage('⚠️ Vui lòng nhập đầy đủ thông tin!', 'error');
                return;
            }

            const submitBtn = document.getElementById('loginBtn');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '⏳ Đang xử lý...';

            try {
                let email = loginValue;
                let userInfo = null;
                
                if (!loginValue.includes('@')) {
                    const result = await findEmailByUsername(loginValue);
                    if (!result) {
                        showMessage('❌ Không tìm thấy người dùng!', 'error');
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '🚀 Đăng Nhập';
                        return;
                    }
                    email = result.email;
                    userInfo = result;
                }

                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                
                const isBlocked = await checkUserBlocked(userCredential.user.uid);
                if (isBlocked) {
                    await auth.signOut();
                    showMessage('🚫 Tài khoản của bạn đã bị khóa!', 'error');
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '🚀 Đăng Nhập';
                    return;
                }

                const userData = userInfo ? userInfo.data : null;
                const uid = userCredential.user.uid;
                let twofaSecret = null;
                
                if (userData && userData.twofaSecret) {
                    twofaSecret = userData.twofaSecret;
                } else {
                    const snap = await db.ref('users/' + uid + '/twofaSecret').once('value');
                    twofaSecret = snap.val();
                }
                
                const twofaEnabled = twofaSecret && twofaSecret.length > 0;

                if (twofaEnabled) {
                    pendingUser = {
                        uid: uid,
                        twofaSecret: twofaSecret,
                        email: email
                    };
                    showOTPModal();
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '🚀 Đăng Nhập';
                    return;
                }

                await db.ref('presence/' + uid).set(true);
                db.ref('presence/' + uid).onDisconnect().set(false);
                showMessage('✅ Đăng nhập thành công! Đang chuyển hướng...', 'success');
                submitBtn.innerHTML = '✅ Thành công!';
                
                setTimeout(() => {
                    window.location.href = '../index';
                }, 1500);
                
            } catch (error) {
                let errorMessage = '❌ Đăng nhập thất bại! ';
                switch (error.code) {
                    case 'auth/user-not-found': errorMessage += 'Email không tồn tại.'; break;
                    case 'auth/wrong-password': errorMessage += 'Mật khẩu không đúng.'; break;
                    case 'auth/invalid-email': errorMessage += 'Email không hợp lệ.'; break;
                    case 'auth/too-many-requests': errorMessage += 'Quá nhiều yêu cầu. Thử lại sau.'; break;
                    default: errorMessage += error.message;
                }
                showMessage(errorMessage, 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '🚀 Đăng Nhập';
            }
        });

        loginInput.focus();

        auth.onAuthStateChanged(async (user) => {
            if (user) {
                try {
                    const isBlocked = await checkUserBlocked(user.uid);
                    if (!isBlocked) {
                        await db.ref('presence/' + user.uid).set(true);
                        db.ref('presence/' + user.uid).onDisconnect().set(false);
                        showMessage('👋 Bạn đã đăng nhập! Nhấn đăng nhập để tiếp tục.', 'info');
                    }
                } catch (e) { console.log('Lỗi auto check:', e); }
            }
        });

