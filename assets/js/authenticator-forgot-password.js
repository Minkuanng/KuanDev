// Extracted from auth/forgot-password.html

// ===== Inline script 1 =====
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

        const forgotForm = document.getElementById('forgotForm');
        const emailInput = document.getElementById('email');
        const messageDiv = document.getElementById('message');

        function showMessage(text, type) {
            messageDiv.textContent = text;
            messageDiv.className = 'message ' + type;
            messageDiv.style.display = 'block';
            setTimeout(() => { messageDiv.style.display = 'none'; }, 6000);
        }

        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = emailInput.value.trim();

            if (!email) {
                showMessage('⚠️ Vui lòng nhập email!', 'error');
                return;
            }

            const submitBtn = forgotForm.querySelector('.btn-primary');
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Đang gửi...';

            try {
                await auth.sendPasswordResetEmail(email);
                showMessage('✅ Email đặt lại mật khẩu đã được gửi! Vui lòng kiểm tra hộp thư.', 'success');
                emailInput.value = '';
                setTimeout(() => {
                    submitBtn.disabled = false;
                    submitBtn.textContent = '📨 Gửi Email';
                }, 3000);
            } catch (error) {
                let errorMessage = '❌ Gửi email thất bại! ';
                switch (error.code) {
                    case 'auth/user-not-found': errorMessage += 'Email không tồn tại trong hệ thống.'; break;
                    case 'auth/invalid-email': errorMessage += 'Email không hợp lệ.'; break;
                    case 'auth/too-many-requests': errorMessage += 'Quá nhiều yêu cầu. Vui lòng thử lại sau.'; break;
                    default: errorMessage += error.message;
                }
                showMessage(errorMessage, 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = '📨 Gửi Email';
            }
        });

        emailInput.focus();

