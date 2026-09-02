// Extracted from pages/support.html

// ===== Inline script 1 =====
        // ===== VARIABLES =====
        let currentUser = null;
        let currentUserData = null;
        let isAdmin = false;
        let selectedUserId = null;
        let allUsers = {};
        let onlineUsers = {};
        let chatListeners = {};
        let messageCache = {};
        let isSending = false;

        const ADMIN_EMAIL = 'qn781159@gmail.com';
        const ADMIN_UID = 'KuanZAdmin'; // fallback

        // ===== THEME =====
        function applyTheme() {
            const isDark = localStorage.getItem('theme') === 'dark';
            document.body.classList.toggle('dark-mode', isDark);
            const theme = localStorage.getItem('theme_name') || 'default';
            document.body.className = document.body.className.replace(/theme-\w+/g, '');
            if (theme !== 'default') document.body.classList.add('theme-' + theme);
        }
        applyTheme();

        // ===== TOAST =====
        function showToast(msg, type = '') {
            const el = document.getElementById('toast');
            el.textContent = msg;
            el.className = 'toast ' + type;
            el.classList.add('show');
            clearTimeout(el.timeout);
            el.timeout = setTimeout(() => el.classList.remove('show'), 2500);
        }

        // ===== LOADING =====
        function hideLoading() {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) { overlay.classList.add('hidden');
                overlay.style.display = 'none'; }
        }

        // ===== NOTIFICATIONS =====
        function loadNotifications(uid) {
            db.ref('notifications').on('value', snap => {
                const notifs = snap.val();
                const list = document.getElementById('notifList');
                const dot = document.getElementById('notifDot');
                if (notifs) {
                    const keys = Object.keys(notifs).reverse();
                    let html = '',
                        hasUnread = false;
                    keys.forEach(key => {
                        const n = notifs[key];
                        const isUnread = !n.readBy || !n.readBy[uid];
                        if (isUnread) hasUnread = true;
                        html +=
                            `<div class="notif-item ${isUnread?'unread':''}"><i class="fas fa-bell"></i> ${n.message}<span class="time"><i class="far fa-clock"></i> ${new Date(n.timestamp).toLocaleString('vi-VN')}</span></div>`;
                    });
                    list.innerHTML = html;
                    dot.classList.toggle('show', hasUnread && localStorage.getItem('notifEnabled') !== 'false');
                } else {
                    list.innerHTML = `<div class="empty"><i class="far fa-bell-slash"></i> Chưa có thông báo</div>`;
                    dot.classList.remove('show');
                }
            });
        }

        // ===== USER LIST =====
        function loadUsers() {
            db.ref('users').on('value', snap => {
                allUsers = snap.val() || {};
                // Lọc bỏ admin khỏi danh sách người dùng cho admin
                const filtered = {};
                Object.keys(allUsers).forEach(key => {
                    if (!allUsers[key].isAdmin) {
                        filtered[key] = allUsers[key];
                    }
                });
                allUsers = filtered;
                renderUserList();
                document.getElementById('userCount').textContent = Object.keys(allUsers).length;
            });

            db.ref('presence').on('value', snap => {
                onlineUsers = snap.val() || {};
                renderUserList();
            });
        }

        function renderUserList() {
            const container = document.getElementById('usersScroll');
            const search = document.getElementById('userSearch').value.toLowerCase().trim();

            let filteredUsers = {};
            Object.keys(allUsers).forEach(key => {
                const user = allUsers[key];
                const name = (user.user || user.email || '').toLowerCase();
                const email = (user.email || '').toLowerCase();
                if (name.includes(search) || email.includes(search)) {
                    filteredUsers[key] = user;
                }
            });

            const keys = Object.keys(filteredUsers);
            if (keys.length === 0) {
                container.innerHTML = `
                    <div class="empty-users">
                        <span class="icon">👤</span>
                        ${search ? 'Không tìm thấy người dùng' : 'Chưa có người dùng'}
                    </div>
                `;
                return;
            }

            let html = '';
            keys.forEach(key => {
                const user = filteredUsers[key];
                const isOnline = onlineUsers[key] === true;
                const name = user.user || user.email || 'Người dùng';
                const email = user.email || '';
                const initial = name.charAt(0).toUpperCase() || '?';
                const color = getColorFromString(key);
                const isActive = selectedUserId === key;
                const unread = getUnreadCount(key);

                html += `
                    <div class="user-item ${isActive ? 'active' : ''}" onclick="selectUser('${key}')">
                        <div class="avatar" style="background:${color}">${initial}</div>
                        <div class="info">
                            <div class="name">${name}</div>
                            <div class="email">${email}</div>
                        </div>
                        <span class="badge ${isOnline ? 'online' : 'offline'}">${isOnline ? '🟢' : '⚪'}</span>
                        <div class="unread-dot ${unread > 0 ? 'show' : ''}"></div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        function filterUsers() { renderUserList(); }

        function getColorFromString(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = str.charCodeAt(i) + ((hash << 5) - hash);
            }
            const colors = ['#2b7fc4', '#27ae60', '#e74c6f', '#f39c12', '#6c5ce7', '#00b894', '#fd79a8', '#0984e3', '#fdcb6e',
                '#e17055'
            ];
            return colors[Math.abs(hash) % colors.length];
        }

        function getUnreadCount(userId) {
            const uid = currentUser ? currentUser.uid : null;
            if (!uid) return 0;
            const key = `${uid}_${userId}`;
            const msgs = messageCache[key] || [];
            return msgs.filter(m => m.senderId !== uid && !m.read).length;
        }

        // ===== SELECT USER =====
        function selectUser(userId) {
            if (selectedUserId === userId) return;
            selectedUserId = userId;
            renderUserList();
            loadChatHistory(userId);
            updateChatHeader(userId);
            markAsRead(userId);
        }

        function updateChatHeader(userId) {
            const user = allUsers[userId];
            if (!user) {
                document.getElementById('chatName').textContent = 'Admin';
                document.getElementById('chatStatus').textContent = 'Minh Quang';
                document.getElementById('chatAvatar').textContent = '🟢';
                return;
            }
            const name = user.user || user.email || 'Người dùng';
            const initial = name.charAt(0).toUpperCase() || '?';
            const isOnline = onlineUsers[userId] === true;
            document.getElementById('chatName').textContent = name;
            document.getElementById('chatStatus').textContent = isOnline ? '🟢 Đang hoạt động' : '⚪ Không hoạt động';
            document.getElementById('chatAvatar').textContent = initial;
            document.getElementById('chatAvatar').style.background = getColorFromString(userId);
        }

        // ===== LOAD CHAT HISTORY =====
        function loadChatHistory(userId) {
            const container = document.getElementById('chatMessages');
            const uid = currentUser ? currentUser.uid : null;
            if (!uid || !userId) {
                container.innerHTML = `
                    <div class="empty-chat">
                        <span class="icon">💬</span>
                        <div class="text">Chọn người dùng để bắt đầu trò chuyện</div>
                    </div>
                `;
                return;
            }

            // Tạo key cho chat
            const chatKey = getChatKey(uid, userId);

            // Hủy listener cũ
            if (chatListeners[chatKey]) {
                db.ref('chats/' + chatKey).off();
                delete chatListeners[chatKey];
            }

            container.innerHTML = `
                <div style="text-align:center;padding:20px;color:var(--text-muted);">
                    <i class="fas fa-spinner fa-spin"></i> Đang tải tin nhắn...
                </div>
            `;

            // Lắng nghe tin nhắn
            const ref = db.ref('chats/' + chatKey);
            chatListeners[chatKey] = ref.on('value', snap => {
                const data = snap.val() || {};
                const messages = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

                // Lưu cache
                messageCache[chatKey] = messages;

                renderMessages(messages, uid, userId);
                scrollToBottom();

                // Đánh dấu đã đọc nếu đang xem
                if (selectedUserId === userId) {
                    markAsRead(userId);
                }
            });
        }

        function renderMessages(messages, uid, userId) {
            const container = document.getElementById('chatMessages');
            if (!messages || messages.length === 0) {
                const name = allUsers[userId]?.user || 'Người dùng';
                container.innerHTML = `
                    <div class="empty-chat">
                        <span class="icon">💬</span>
                        <div class="text">Chưa có tin nhắn</div>
                        <div class="sub">Hãy gửi tin nhắn đầu tiên</div>
                    </div>
                `;
                return;
            }

            let html = '';
            let lastDate = '';

            messages.forEach(msg => {
                const isOwn = msg.senderId === uid;
                const msgDate = new Date(msg.timestamp).toDateString();
                if (msgDate !== lastDate) {
                    lastDate = msgDate;
                    html += `<div class="message-date-divider">${new Date(msg.timestamp).toLocaleDateString('vi-VN')}</div>`;
                }

                const senderName = isOwn ? 'Bạn' : (msg.senderName || allUsers[msg.senderId]?.user || 'Người dùng');
                const time = new Date(msg.timestamp).toLocaleTimeString('vi-VN');

                html += `
                    <div class="message ${isOwn ? 'own' : 'other'}">
                        ${!isOwn ? `<span class="msg-sender">${senderName}</span>` : ''}
                        ${msg.message}
                        <span class="msg-time">${time}</span>
                    </div>
                `;
            });

            container.innerHTML = html;
        }

        function scrollToBottom() {
            const container = document.getElementById('chatMessages');
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
            }, 50);
        }

        // ===== MARK AS READ =====
        function markAsRead(userId) {
            const uid = currentUser ? currentUser.uid : null;
            if (!uid || !userId) return;
            const chatKey = getChatKey(uid, userId);
            const msgs = messageCache[chatKey] || [];
            const updates = {};
            msgs.forEach(msg => {
                if (msg.senderId !== uid && !msg.read && msg.id) {
                    updates[msg.id + '/read'] = true;
                }
            });
            if (Object.keys(updates).length > 0) {
                db.ref('chats/' + chatKey).update(updates);
            }
            // Cập nhật lại user list
            renderUserList();
        }

        // ===== SEND MESSAGE =====
        function sendMessage() {
            const input = document.getElementById('chatInput');
            const text = input.value.trim();
            if (!text) { showToast('⚠️ Nhập tin nhắn!', 'error'); return; }
            if (!currentUser) { showToast('⚠️ Vui lòng đăng nhập!', 'error'); return; }
            if (!selectedUserId) { showToast('⚠️ Chọn người nhận!', 'error'); return; }

            if (isSending) return;
            isSending = true;

            const uid = currentUser.uid;
            const chatKey = getChatKey(uid, selectedUserId);
            const name = currentUserData?.user || currentUser.displayName || currentUser.email || 'Người dùng';

            db.ref('chats/' + chatKey).push({
                senderId: uid,
                senderName: name,
                message: text,
                timestamp: Date.now(),
                read: false
            }).then(() => {
                input.value = '';
                isSending = false;
                scrollToBottom();
            }).catch(err => {
                showToast('❌ Lỗi gửi: ' + err.message, 'error');
                isSending = false;
            });
        }

        // ===== GET CHAT KEY =====
        function getChatKey(uid1, uid2) {
            // Sắp xếp để luôn có cùng key cho 2 người
            const sorted = [uid1, uid2].sort();
            return sorted.join('_');
        }

        // ===== CLEAR CHAT =====
        function clearChat() {
            if (!selectedUserId) { showToast('⚠️ Chọn người dùng trước!', 'error'); return; }
            if (!confirm('🗑️ Xóa toàn bộ tin nhắn với người này?')) return;

            const uid = currentUser ? currentUser.uid : null;
            if (!uid) return;
            const chatKey = getChatKey(uid, selectedUserId);

            db.ref('chats/' + chatKey).remove()
                .then(() => {
                    showToast('✅ Đã xóa tin nhắn!', 'success');
                    messageCache[chatKey] = [];
                    renderMessages([], uid, selectedUserId);
                })
                .catch(err => showToast('❌ Lỗi: ' + err.message, 'error'));
        }

        // ===== EMOJI =====
        function toggleEmoji() {
            const input = document.getElementById('chatInput');
            const emojis = ['😊', '😂', '❤️', '😍', '🥰', '😘', '😅', '🤣', '🙃', '😉', '😇', '🥺', '😎', '🤩', '😤', '😡', '🤬', '😱',
                '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
                '🤯', '😳', '🥵', '🥶', '😶‍🌫️', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬',
                '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑',
                '🤠', '😈', '👿', '👹', '👺', '💀', '☠️', '👻', '👽', '👾', '🤖', '💩', '😺', '😸', '😻', '😽', '🙀', '😿', '😹'
            ];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            input.value += randomEmoji;
            input.focus();
        }

        // ===== AUTH =====
        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.replace('../auth/login');
                return;
            }
            currentUser = user;

            // Lấy dữ liệu user
            const snap = await db.ref('users/' + user.uid).once('value');
            currentUserData = snap.val() || {};

            // Kiểm tra admin
            isAdmin = currentUserData.isAdmin === true || user.email === ADMIN_EMAIL;

            // Cập nhật balance
            db.ref('users/' + user.uid + '/balance').on('value', snap => {
                document.getElementById('balanceAmount').textContent = (snap.val() || 0).toLocaleString('vi-VN');
            });

            // Presence
            db.ref('presence/' + user.uid).set(true);
            db.ref('presence/' + user.uid).onDisconnect().set(false);

            // Notifications
            loadNotifications(user.uid);

            // Load users
            loadUsers();

            // Nếu là admin, hiển thị danh sách user
            if (isAdmin) {
                document.getElementById('userList').style.display = 'flex';
            } else {
                // Người dùng thường: chỉ chat với admin
                document.getElementById('userList').style.display = 'none';
                // Tự động chọn admin
                const adminId = await getAdminId();
                if (adminId) {
                    selectUser(adminId);
                } else {
                    showToast('⚠️ Không tìm thấy admin!', 'error');
                }
            }

            hideLoading();
        });

        // ===== GET ADMIN ID =====
        async function getAdminId() {
            try {
                const snap = await db.ref('users').once('value');
                const users = snap.val() || {};
                for (const key in users) {
                    if (users[key].isAdmin === true || users[key].email === ADMIN_EMAIL) {
                        return key;
                    }
                }
                return null;
            } catch (e) {
                return null;
            }
        }

        // ===== MENU =====
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
                    if (notifs) Object.keys(notifs).forEach(key => db.ref('notifications/' + key + '/readBy/' + user.uid)
                        .set(true));
                });
                document.getElementById('notifDot').classList.remove('show');
            }
        }

        // ===== CÁC HÀM CHUYỂN HƯỚNG ĐÃ SỬA =====
        function goHome() { 
            closeMenu();
            window.location.href = '../index'; 
        }

        function goHistory() { 
            closeMenu();
            window.location.href = '../pages/history'; 
        }

        function goTopup() { 
            closeMenu();
            showToast('💰 Đang phát triển!', 'error'); 
        }
        
        function goEarn() { 
            closeMenu();
            window.location.href = '../pages/earn-money';

        }
        
        function goSupport() { 
            closeMenu();
            window.location.href = '../pages/support'; 
        }

        // ===== CÁC HÀM CHUYỂN HƯỚNG ĐẾN user/ =====
        function goToProfile() { 
            closeMenu();
            window.location.href = '../user/profile'; 
        }

        function goToSecurity() { 
            closeMenu();
            window.location.href = '../user/security'; 
        }

        function goToBalance() { 
            closeMenu();
            window.location.href = '../user/balance'; 
        }

        function goToSettings() { 
            closeMenu();
            window.location.href = '../user/settings'; 
        }

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

        // Ẩn loading sau 3s nếu chưa ẩn
        setTimeout(() => { if (document.getElementById('loadingOverlay') && !document.getElementById('loadingOverlay')
                .classList.contains('hidden')) hideLoading(); }, 3000);

