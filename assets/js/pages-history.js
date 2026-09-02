// Extracted from pages/history.html

let currentUser = null;
        let allOrders = [];
        let isDataLoaded = false;
        let categoriesData = {};
        let selectedOrders = new Set();

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
            if (overlay) { overlay.classList.add('hidden'); overlay.style.display = 'none'; }
        }

        function loadCategories() {
            db.ref('categories').on('value', snap => {
                categoriesData = snap.val() || {};
            });
        }

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

        function loadHistory(uid) {
            db.ref('history/' + uid).on('value', (snapshot) => {
                const data = snapshot.val() || {};
                allOrders = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                renderOrders(allOrders);
                updateStats(allOrders);
                selectedOrders.clear();
                updateDeleteButton();
            });
        }

        function getCategoryName(catId) {
            return categoriesData[catId]?.name || catId || 'Không có';
        }

        function truncateData(data, maxLen = 64) {
            if (!data) return { display: 'Không có dữ liệu', isTruncated: false, full: '' };
            const str = String(data);
            if (str.length <= maxLen) return { display: str, isTruncated: false, full: str };
            return { display: str.substring(0, maxLen) + '...', isTruncated: true, full: str };
        }

        function renderOrders(orders) {
            const container = document.getElementById('orderList');
            if (orders.length === 0) {
                container.innerHTML = `<div class="empty-state"><span class="big-icon">📦</span><p>Chưa có đơn hàng nào</p></div>`;
                return;
            }
            let html = '';
            orders.forEach(order => {
                const isChecked = selectedOrders.has(order.id);
                const image = order.productImage || order.productIcon || '📦';
                const price = (order.price || 0).toLocaleString('vi-VN');
                const time = new Date(order.timestamp).toLocaleString('vi-VN');
                const orderCode = order.orderCode || '#' + order.id.substring(0, 6).toUpperCase();
                const desc = order.productDesc || '';
                const quantity = order.quantity || 1;
                const status = order.status || 'success';
                const categoryName = getCategoryName(order.productCategory);
                const statusText = status === 'success' ? 'Thành công' : 'Thất bại';
                const statusClass = status === 'success' ? 'success' : 'failed';
                const orderData = order.orderData || '';
                const truncated = truncateData(orderData, 64);

                html += `
                    <div class="order-item">
                        <input type="checkbox" class="order-checkbox" data-id="${order.id}" ${isChecked ? 'checked' : ''} onchange="toggleOrderSelection('${order.id}')" />
                        <div class="order-header">
                            <div>
                                <div class="order-code"><i class="fas fa-key"></i> ${orderCode}</div>
                                <div class="order-time"><i class="far fa-clock"></i> ${time}</div>
                            </div>
                            <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
                                <span class="order-status ${statusClass}"><i class="fas ${status === 'success' ? 'fa-check-circle' : 'fa-times-circle'}"></i> ${statusText}</span>
                                <div class="order-price">${price} VND</div>
                            </div>
                        </div>
                        <div class="order-body">
                            <div class="order-image">
                                ${order.productImage ? `<img src="${order.productImage}" onerror="this.style.display='none';this.parentElement.textContent='${order.productIcon || '📦'}'" />` : (order.productIcon || '📦')}
                            </div>
                            <div class="order-details">
                                <div class="name">${order.productName || 'Sản phẩm'}</div>
                                ${desc ? `<div class="desc"><i class="fas fa-info-circle"></i> ${desc}</div>` : ''}
                                <div class="category"><i class="fas fa-tag"></i> ${categoryName}</div>
                                <div class="meta">
                                    <span><i class="fas fa-user"></i> ${order.userName || 'Khách hàng'}</span>
                                    <span><i class="fas fa-boxes"></i> SL: ${quantity}</span>
                                    ${order.voucher ? `<span><i class="fas fa-ticket-alt"></i> ${order.voucher} ${order.discountText || ''}</span>` : ''}
                                </div>
                                <div class="order-data">
                                    <span class="data-preview">${truncated.display}</span>
                                    ${truncated.isTruncated ? `<span class="data-full">${truncated.full}</span><button class="show-more-btn" onclick="toggleFullData(this)">Xem thêm</button>` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="order-actions">
                            <button class="view" onclick="viewOrderDetail('${order.id}')"><i class="fas fa-eye"></i> Xem chi tiết</button>
                            <button class="download" onclick="downloadOrder('${order.id}')"><i class="fas fa-download"></i> Tải TXT</button>
                            <button class="copy-data" onclick="copyOrderData('${order.id}')"><i class="fas fa-copy"></i> Copy</button>
                            <button class="delete-single" onclick="deleteSingleOrder('${order.id}')"><i class="fas fa-trash"></i> Xóa</button>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        function toggleFullData(btn) {
            const parent = btn.closest('.order-data');
            if (parent) {
                parent.classList.toggle('expanded');
                btn.textContent = parent.classList.contains('expanded') ? 'Thu gọn' : 'Xem thêm';
            }
        }

        function updateStats(orders) {
            document.getElementById('totalOrders').textContent = orders.length;
            const total = orders.reduce((sum, o) => sum + (o.price || 0), 0);
            document.getElementById('totalSpent').textContent = total.toLocaleString('vi-VN') + ' VND';
        }

        function filterOrders() {
            const search = document.getElementById('searchInput').value.toLowerCase().trim();
            const sort = document.getElementById('sortSelect').value;
            let filtered = allOrders.filter(order => {
                const name = (order.productName || '').toLowerCase();
                const code = (order.orderCode || '').toLowerCase();
                return name.includes(search) || code.includes(search);
            });
            switch (sort) {
                case 'newest': filtered.sort((a,b) => (b.timestamp||0) - (a.timestamp||0)); break;
                case 'oldest': filtered.sort((a,b) => (a.timestamp||0) - (b.timestamp||0)); break;
                case 'high': filtered.sort((a,b) => (b.price||0) - (a.price||0)); break;
                case 'low': filtered.sort((a,b) => (a.price||0) - (b.price||0)); break;
                default: filtered.sort((a,b) => (b.timestamp||0) - (a.timestamp||0));
            }
            renderOrders(filtered);
        }

        function clearFilter() {
            document.getElementById('searchInput').value = '';
            document.getElementById('sortSelect').value = 'newest';
            filterOrders();
        }

        function toggleOrderSelection(orderId) {
            if (selectedOrders.has(orderId)) selectedOrders.delete(orderId);
            else selectedOrders.add(orderId);
            updateDeleteButton();
            filterOrders();
        }

        function toggleSelectAll() {
            const filtered = getFilteredOrders();
            const allSelected = filtered.every(o => selectedOrders.has(o.id));
            if (allSelected) filtered.forEach(o => selectedOrders.delete(o.id));
            else filtered.forEach(o => selectedOrders.add(o.id));
            updateDeleteButton();
            filterOrders();
        }

        function getFilteredOrders() {
            const search = document.getElementById('searchInput').value.toLowerCase().trim();
            let filtered = allOrders.filter(order => {
                const name = (order.productName || '').toLowerCase();
                const code = (order.orderCode || '').toLowerCase();
                return name.includes(search) || code.includes(search);
            });
            return filtered;
        }

        function updateDeleteButton() {
            const btn = document.getElementById('deleteSelectedBtn');
            const count = selectedOrders.size;
            btn.disabled = count === 0;
            btn.innerHTML = `<i class="fas fa-trash"></i> Xóa đã chọn (${count})`;
        }

        function deleteSingleOrder(orderId) {
            if (!confirm('🗑️ Bạn có chắc muốn xóa đơn hàng này?')) return;
            db.ref('history/' + currentUser.uid + '/' + orderId).remove()
                .then(() => { showToast('✅ Đã xóa đơn hàng!', 'success'); })
                .catch(err => { showToast('❌ Lỗi: ' + err.message, 'error'); });
        }

        function deleteSelectedOrders() {
            if (selectedOrders.size === 0) { showToast('⚠️ Chưa chọn đơn hàng nào!', 'error'); return; }
            if (!confirm(`🗑️ Xóa ${selectedOrders.size} đơn hàng đã chọn?`)) return;
            const promises = [];
            selectedOrders.forEach(orderId => {
                promises.push(db.ref('history/' + currentUser.uid + '/' + orderId).remove());
            });
            Promise.all(promises)
                .then(() => { selectedOrders.clear(); showToast('✅ Đã xóa đơn hàng!', 'success'); updateDeleteButton(); })
                .catch(err => { showToast('❌ Lỗi: ' + err.message, 'error'); });
        }

        function deleteAllOrders() {
            if (allOrders.length === 0) { showToast('⚠️ Không có đơn hàng để xóa!', 'error'); return; }
            if (!confirm(`🗑️ Xóa TẤT CẢ ${allOrders.length} đơn hàng?`)) return;
            db.ref('history/' + currentUser.uid).remove()
                .then(() => { selectedOrders.clear(); showToast('✅ Đã xóa tất cả!', 'success'); updateDeleteButton(); })
                .catch(err => { showToast('❌ Lỗi: ' + err.message, 'error'); });
        }

        function copyOrderData(orderId) {
            const order = allOrders.find(o => o.id === orderId);
            if (!order) { showToast('❌ Không tìm thấy!', 'error'); return; }
            const data = order.orderData || 'Không có dữ liệu';
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(data)
                    .then(() => showToast('✅ Đã sao chép!', 'success'))
                    .catch(() => fallbackCopy(data));
            } else { fallbackCopy(data); }
        }

        function fallbackCopy(text) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.cssText = 'position:fixed;opacity:0;left:-9999px;';
            document.body.appendChild(textarea);
            textarea.select();
            try { document.execCommand('copy'); showToast('✅ Đã sao chép!', 'success'); } 
            catch (err) { showToast('❌ Không thể sao chép!', 'error'); }
            document.body.removeChild(textarea);
        }

        function viewOrderDetail(orderId) {
            const order = allOrders.find(o => o.id === orderId);
            if (!order) { showToast('❌ Không tìm thấy!', 'error'); return; }
            const container = document.getElementById('detailContent');
            const code = order.orderCode || '#' + orderId.substring(0, 6).toUpperCase();
            const price = (order.price || 0).toLocaleString('vi-VN');
            const time = new Date(order.timestamp).toLocaleString('vi-VN');
            const categoryName = getCategoryName(order.productCategory);
            const status = order.status || 'success';
            const statusText = status === 'success' ? '✅ Thành công' : '❌ Thất bại';
            const statusClass = status === 'success' ? 'status-success' : 'status-failed';
            const orderData = order.orderData || 'Không có dữ liệu';
            container.innerHTML = `
                <div class="detail-grid">
                    <div class="d-item"><div class="label"><i class="fas fa-key"></i> Mã đơn</div><div class="value" style="font-family:monospace;color:var(--accent);">${code}</div></div>
                    <div class="d-item"><div class="label"><i class="fas fa-box"></i> Sản phẩm</div><div class="value">${order.productName || 'Không tên'}</div></div>
                    <div class="d-item"><div class="label"><i class="fas fa-tag"></i> Loại mục</div><div class="value">${categoryName}</div></div>
                    <div class="d-item"><div class="label"><i class="fas fa-user"></i> Người mua</div><div class="value">${order.userName || 'Khách hàng'}</div></div>
                    <div class="d-item"><div class="label"><i class="fas fa-id-card"></i> Mã người dùng</div><div class="value" style="font-size:10px;font-family:monospace;">${order.userId || 'N/A'}</div></div>
                    <div class="d-item"><div class="label"><i class="fas fa-clock"></i> Thời gian</div><div class="value" style="font-size:10px;">${time}</div></div>
                    <div class="d-item"><div class="label"><i class="fas fa-boxes"></i> Số lượng</div><div class="value">${order.quantity || 1}</div></div>
                    <div class="d-item"><div class="label"><i class="fas fa-coins"></i> Giá</div><div class="value" style="color:var(--accent);">${price} VND</div></div>
                    <div class="d-item"><div class="label"><i class="fas fa-check-circle"></i> Trạng thái</div><div class="value ${statusClass}">${statusText}</div></div>
                    ${order.voucher ? `<div class="d-item full"><div class="label"><i class="fas fa-ticket-alt"></i> Mã giảm giá</div><div class="value" style="color:var(--success);">${order.voucher} ${order.discountText || ''}</div></div>` : ''}
                    ${order.productDesc ? `<div class="d-item full"><div class="label"><i class="fas fa-info-circle"></i> Mô tả</div><div class="value" style="font-weight:400;font-size:11px;">${order.productDesc}</div></div>` : ''}
                    <div class="d-item full"><div class="label"><i class="fas fa-database"></i> Dữ liệu nhận được</div><div class="value"><div class="data-item">${orderData}</div></div></div>
                </div>
            `;
            document.getElementById('detailModal').classList.add('active');
        }

        function closeDetailModal() { document.getElementById('detailModal').classList.remove('active'); }

        function downloadOrder(orderId) {
            const order = allOrders.find(o => o.id === orderId);
            if (!order) { showToast('❌ Không tìm thấy!', 'error'); return; }
            const orderData = order.orderData || 'Không có dữ liệu';
            try {
                const blob = new Blob([orderData], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'DuLieu_DonHang_' + (order.orderCode || orderId.substring(0, 6)).replace('#', '') + '.txt';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 5000);
                showToast('✅ Đã tải xuống!', 'success');
            } catch (error) {
                showToast('❌ Lỗi khi tải file!', 'error');
            }
        }

        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.replace('../auth/login');
                return;
            }
            currentUser = user;
            db.ref('presence/' + user.uid).set(true);
            db.ref('presence/' + user.uid).onDisconnect().set(false);
            db.ref('users/' + user.uid + '/balance').on('value', snap => {
                document.getElementById('balanceAmount').textContent = (snap.val() || 0).toLocaleString('vi-VN');
            });
            loadCategories();
            loadHistory(user.uid);
            loadNotifications(user.uid);
            if (!isDataLoaded) { isDataLoaded = true; hideLoading(); }
        });

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
        function goHistory() { closeMenu(); window.location.href = 'history'; }
        function goTopup() { closeMenu(); showToast('💰 Đang phát triển!', 'error'); }
        function goEarn() { closeMenu(); window.location.href = 'earn-money'; }
        function goSupport() { closeMenu(); window.location.href = 'support'; }
        function goToProfile() { window.location.href = '../user/profile'; }
        function goToSecurity() { window.location.href = '../user/security'; }
        function goToBalance() { window.location.href = '../user/balance'; }
        function goToSettings() { window.location.href = '../user/settings'; }

        function logout() {
            if (confirm('Đăng xuất?')) {
                const user = auth.currentUser;
                if (user) db.ref('presence/' + user.uid).set(false);
                auth.signOut().then(() => {
                    window.location.replace('../auth/login');
                });
            }
        }

        document.getElementById('detailModal').addEventListener('click', function(e) {
            if (e.target === this) closeDetailModal();
        });

        window.addEventListener('storage', function(e) {
            if (e.key === 'theme' || e.key === 'theme_name') { applyTheme(); }
        });

        setTimeout(() => { if (!isDataLoaded) hideLoading(); }, 3000);

