// Extracted from user/balance.html

let currentUser = null;
        let allTransactions = [];
        let currentFilter = 'all';

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

        // ===== LOAD BALANCE & TRANSACTIONS =====
        function loadBalanceHistory(uid) {
            // Lắng nghe số dư
            db.ref('users/' + uid + '/balance').on('value', (snap) => {
                const bal = snap.val() || 0;
                document.getElementById('balanceAmount').textContent = bal.toLocaleString('vi-VN');
                document.getElementById('currentBalance').innerHTML = bal.toLocaleString('vi-VN') + ' <span class="currency">VND</span>';
            });

            // Lắng nghe lịch sử giao dịch từ balanceHistory
            db.ref('balanceHistory/' + uid).on('value', (snapshot) => {
                const data = snapshot.val() || {};
                allTransactions = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
                // Sắp xếp theo thời gian mới nhất
                allTransactions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                updateStats();
                renderTransactions(currentFilter);
            });

            // Cũng lắng nghe từ history để đồng bộ nếu có
            db.ref('history/' + uid).on('value', (snapshot) => {
                const data = snapshot.val() || {};
                // Kiểm tra xem có giao dịch mới từ history không
                const historyKeys = Object.keys(data);
                if (historyKeys.length > 0) {
                    // Lấy balanceHistory hiện tại
                    db.ref('balanceHistory/' + uid).once('value', (snap) => {
                        const existing = snap.val() || {};
                        let hasNew = false;
                        historyKeys.forEach(key => {
                            const item = data[key];
                            // Nếu chưa có trong balanceHistory thì thêm vào
                            if (!existing[key] && item.type === 'purchase') {
                                hasNew = true;
                                const txData = {
                                    type: 'expense',
                                    amount: item.price || 0,
                                    description: item.productName || 'Mua hàng',
                                    timestamp: item.timestamp || Date.now(),
                                    orderCode: item.orderCode || '',
                                    productName: item.productName || '',
                                    productCategory: item.productCategory || ''
                                };
                                db.ref('balanceHistory/' + uid + '/' + key).set(txData);
                            }
                        });
                    });
                }
            });
        }

        function updateStats() {
            let income = 0, expense = 0;
            allTransactions.forEach(t => {
                if (t.type === 'income') income += t.amount || 0;
                else if (t.type === 'expense') expense += t.amount || 0;
            });
            document.getElementById('totalIncome').textContent = income.toLocaleString('vi-VN') + 'đ';
            document.getElementById('totalExpense').textContent = expense.toLocaleString('vi-VN') + 'đ';
            document.getElementById('totalTransactions').textContent = allTransactions.length;
        }

        function renderTransactions(filter) {
            const container = document.getElementById('transactionList');
            let filtered = allTransactions;
            
            if (filter === 'income') {
                filtered = allTransactions.filter(t => t.type === 'income');
            } else if (filter === 'expense') {
                filtered = allTransactions.filter(t => t.type === 'expense');
            }

            if (filtered.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <span class="icon">📭</span>
                        <span class="text">Không có giao dịch ${filter === 'income' ? 'nhận' : filter === 'expense' ? 'dùng' : ''}</span>
                    </div>
                `;
                return;
            }

            let html = '';
            filtered.forEach(t => {
                const isIncome = t.type === 'income';
                const icon = isIncome ? 'fa-arrow-down' : 'fa-arrow-up';
                const cls = isIncome ? 'income' : 'expense';
                const amount = (t.amount || 0).toLocaleString('vi-VN') + 'đ';
                const time = t.timestamp ? new Date(t.timestamp).toLocaleString('vi-VN') : 'Không rõ';
                const title = t.description || (isIncome ? 'Nhận tiền' : 'Sử dụng tiền');
                const productInfo = t.productName ? ` • ${t.productName}` : '';
                const categoryInfo = t.productCategory ? ` • ${t.productCategory}` : '';
                const orderInfo = t.orderCode ? ` • Mã: ${t.orderCode}` : '';

                html += `
                    <div class="transaction-item">
                        <div class="tx-icon ${cls}"><i class="fas ${icon}"></i></div>
                        <div class="tx-info">
                            <div class="tx-title">${title}</div>
                            <div class="tx-desc">${productInfo}${categoryInfo}${orderInfo}</div>
                            <div class="tx-time"><i class="far fa-clock"></i> ${time}</div>
                        </div>
                        <div class="tx-amount ${cls}">${isIncome ? '+' : '-'} ${amount}</div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        function filterTransactions(filter) {
            currentFilter = filter;
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.filter === filter);
            });
            renderTransactions(filter);
        }

        function refreshData() {
            const user = auth.currentUser;
            if (user) {
                // Force refresh balance
                db.ref('users/' + user.uid + '/balance').once('value', snap => {
                    const bal = snap.val() || 0;
                    document.getElementById('balanceAmount').textContent = bal.toLocaleString('vi-VN');
                    document.getElementById('currentBalance').innerHTML = bal.toLocaleString('vi-VN') + ' <span class="currency">VND</span>';
                });
                // Force refresh transactions
                db.ref('balanceHistory/' + user.uid).once('value', snap => {
                    const data = snap.val() || {};
                    allTransactions = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                    allTransactions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                    updateStats();
                    renderTransactions(currentFilter);
                    showToast('🔄 Đã làm mới!', 'success');
                });
            }
        }

        // ===== LOAD NOTIFICATIONS =====
        function loadNotifications(uid) {
            db.ref('notifications').on('value', snap => {
                const notifs = snap.val();
                const list = document.getElementById('notifList');
                const dot = document.getElementById('notifDot');
                if (notifs) {
                    const keys = Object.keys(notifs).reverse();
                    let html = '', hasUnread = false;
                    keys.forEach(key => {
                        const n = notifs[key];
                        const isUnread = !n.readBy || !n.readBy[uid];
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
        }

        // ===== AUTH =====
        auth.onAuthStateChanged((user) => {
            if (!user) {
                window.location.replace('../auth/login');
                return;
            }
            currentUser = user;
            db.ref('presence/' + user.uid).set(true);
            db.ref('presence/' + user.uid).onDisconnect().set(false);
            
            loadBalanceHistory(user.uid);
            loadNotifications(user.uid);
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

        window.addEventListener('storage', function(e) {
            if (e.key === 'theme' || e.key === 'theme_name') { applyTheme(); }
        });

