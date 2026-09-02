// Extracted from auth/signup.html

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
            if (e.key === 'theme' || e.key === 'theme_name') {
                applyTheme();
            }
        });

        const signupForm = document.getElementById('signupForm');
        const fullNameInput = document.getElementById('fullName');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const messageDiv = document.getElementById('message');
        const togglePasswordBtn = document.getElementById('togglePassword');
        const termsCheckbox = document.getElementById('termsCheckbox');
        const termsError = document.getElementById('termsError');
        const usernameStatus = document.getElementById('usernameStatus');
        const emailStatus = document.getElementById('emailStatus');
        const signupBtn = document.getElementById('signupBtn');

        const strengthContainer = document.getElementById('passwordStrength');
        const strengthBarFill = document.getElementById('strengthBarFill');
        const strengthValue = document.getElementById('strengthValue');

        let usernameCheckTimeout = null;
        let emailCheckTimeout = null;

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
            setTimeout(() => { messageDiv.style.display = 'none'; }, 5000);
        }

        function validateUsername(username) {
            return /^[a-zA-Z0-9]+$/.test(username);
        }

        async function checkUsernameExists(username) {
            try {
                const snapshot = await db.ref('users').once('value');
                const users = snapshot.val();
                if (!users) return false;
                for (const uid in users) {
                    if (users[uid].user && users[uid].user.toLowerCase() === username.toLowerCase()) {
                        return true;
                    }
                }
                return false;
            } catch (error) {
                console.error('Lỗi kiểm tra username:', error);
                return false;
            }
        }

        async function checkEmailExists(email) {
            try {
                const snapshot = await db.ref('users').once('value');
                const users = snapshot.val();
                if (!users) return false;
                for (const uid in users) {
                    if (users[uid].email && users[uid].email.toLowerCase() === email.toLowerCase()) {
                        return true;
                    }
                }
                return false;
            } catch (error) {
                console.error('Lỗi kiểm tra email:', error);
                return false;
            }
        }

        function updateUsernameStatus(status, message, icon) {
            usernameStatus.className = 'input-status ' + status;
            usernameStatus.querySelector('.icon').textContent = icon;
            usernameStatus.querySelector('span:last-child').textContent = message;
            fullNameInput.className = status;
        }

        function updateEmailStatus(status, message, icon) {
            emailStatus.className = 'input-status ' + status;
            emailStatus.querySelector('.icon').textContent = icon;
            emailStatus.querySelector('span:last-child').textContent = message;
            emailInput.className = status;
        }

        function checkPasswordStrength(password) {
            let score = 0;
            if (password.length >= 6) score++;
            if (password.length >= 10) score++;
            if (/[a-z]/.test(password)) score++;
            if (/[A-Z]/.test(password)) score++;
            if (/[0-9]/.test(password)) score++;
            if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
            
            let strength = 'weak';
            let label = 'Yếu 🔓';
            
            if (score >= 5) {
                strength = 'strong';
                label = 'Mạnh 🔒';
            } else if (score >= 3) {
                strength = 'medium';
                label = 'Trung bình 🔐';
            } else if (score >= 1) {
                strength = 'weak';
                label = 'Yếu 🔓';
            } else {
                strength = 'none';
                label = '--';
            }

            strengthBarFill.className = 'strength-bar-fill';
            if (password.length > 0) {
                strengthBarFill.classList.add(strength);
            }

            strengthValue.textContent = label;
            strengthValue.className = 'value';
            if (password.length > 0 && strength !== 'none') {
                strengthValue.classList.add(strength);
            }

            if (password.length > 0) {
                strengthContainer.classList.add('show');
            } else {
                strengthContainer.classList.remove('show');
            }

            return { score, strength };
        }

        fullNameInput.addEventListener('input', function() {
            const username = this.value.trim();
            clearTimeout(usernameCheckTimeout);
            
            if (username.length === 0) {
                updateUsernameStatus('idle', 'Chỉ chấp nhận chữ cái (a-z, A-Z) và số (0-9)', 'ℹ️');
                return;
            }

            if (username.length < 2) {
                updateUsernameStatus('invalid', 'Tên phải có ít nhất 2 ký tự!', '❌');
                return;
            }

            if (!validateUsername(username)) {
                updateUsernameStatus('invalid', 'Chỉ được dùng chữ cái và số, không ký tự đặc biệt!', '❌');
                return;
            }

            updateUsernameStatus('checking', 'Đang kiểm tra...', '⏳');

            usernameCheckTimeout = setTimeout(async () => {
                try {
                    const exists = await checkUsernameExists(username);
                    if (exists) {
                        updateUsernameStatus('invalid', 'Tên người dùng đã được sử dụng!', '❌');
                    } else {
                        updateUsernameStatus('valid', 'Tên người dùng hợp lệ!', '✅');
                    }
                } catch (error) {
                    updateUsernameStatus('invalid', 'Lỗi kiểm tra!', '❌');
                }
            }, 500);
        });

        emailInput.addEventListener('input', function() {
            const email = this.value.trim();
            clearTimeout(emailCheckTimeout);
            
            if (email.length === 0) {
                updateEmailStatus('idle', 'Nhập email để kiểm tra', 'ℹ️');
                return;
            }

            if (!email.includes('@') || !email.includes('.')) {
                updateEmailStatus('invalid', 'Email không hợp lệ!', '❌');
                return;
            }

            updateEmailStatus('checking', 'Đang kiểm tra...', '⏳');

            emailCheckTimeout = setTimeout(async () => {
                try {
                    const exists = await checkEmailExists(email);
                    if (exists) {
                        updateEmailStatus('invalid', 'Email đã được sử dụng!', '❌');
                    } else {
                        updateEmailStatus('valid', 'Email hợp lệ!', '✅');
                    }
                } catch (error) {
                    updateEmailStatus('invalid', 'Lỗi kiểm tra!', '❌');
                }
            }, 500);
        });

        passwordInput.addEventListener('input', function() {
            checkPasswordStrength(this.value);
        });

        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
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
            
            const fullName = fullNameInput.value.trim();
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();

            if (!fullName || !email || !password) {
                showMessage('⚠️ Vui lòng nhập đầy đủ thông tin!', 'error');
                return;
            }

            if (!validateUsername(fullName)) {
                showMessage('❌ Tên người dùng chỉ được chứa chữ cái và số!', 'error');
                return;
            }

            if (fullName.length < 2) {
                showMessage('❌ Users phải có ít nhất 2 ký tự!', 'error');
                return;
            }

            const usernameExists = await checkUsernameExists(fullName);
            if (usernameExists) {
                showMessage('❌ Tên người dùng đã được sử dụng!', 'error');
                return;
            }

            const emailExists = await checkEmailExists(email);
            if (emailExists) {
                showMessage('❌ Email đã được sử dụng!', 'error');
                return;
            }

            if (password.length < 6) {
                showMessage('❌ Mật khẩu phải có ít nhất 6 ký tự!', 'error');
                return;
            }

            const strengthResult = checkPasswordStrength(password);
            if (strengthResult.strength === 'weak' && password.length > 0) {
                const confirmWeak = confirm('⚠️ Mật khẩu của bạn đang ở mức Yếu. Bạn có chắc chắn muốn tiếp tục?');
                if (!confirmWeak) {
                    return;
                }
            }

            signupBtn.disabled = true;
            signupBtn.textContent = '⏳ Đang xử lý...';

            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                await userCredential.user.updateProfile({ displayName: fullName });

                await db.ref('users/' + userCredential.user.uid).set({
                    user: fullName,
                    email: email,
                    balance: 0,
                    blocked: false,
                    isAdmin: email === 'qn781159@gmail.com',
                    createdAt: new Date().toISOString()
                });

                showMessage('✅ Đăng ký thành công!', 'success');
                setTimeout(() => {
                    window.location.href = '../index';
                }, 1500);
            } catch (error) {
                let errorMessage = '❌ Đăng ký thất bại! ';
                switch (error.code) {
                    case 'auth/email-already-in-use': errorMessage += 'Email đã được sử dụng.'; break;
                    case 'auth/invalid-email': errorMessage += 'Email không hợp lệ.'; break;
                    case 'auth/weak-password': errorMessage += 'Mật khẩu quá yếu.'; break;
                    default: errorMessage += error.message;
                }
                showMessage(errorMessage, 'error');
                signupBtn.disabled = false;
                signupBtn.textContent = '🚀 Đăng Ký';
            }
        });

        fullNameInput.focus();

