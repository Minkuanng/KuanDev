// Extracted from Admin/index.html

// ===== Inline script 1 =====
        const storage = firebase.storage();

        // ===== VARIABLES =====
        let isAdmin = false;
        let categoriesData = {};
        let productsData = {};
        let ordersData = {};
        let vouchersData = {};
        let usersData = {};
        let onlineUsersMap = {};
        let currentUserUid = null;

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

        // ===== LOADING =====
        function hideLoading() {
            const overlay = document.querySelector('.loading-overlay');
            if (overlay) { overlay.classList.add('hidden');
                overlay.style.display = 'none'; }
        }
        function showLoading() {
            const overlay = document.querySelector('.loading-overlay');
            if (overlay) { overlay.style.display = 'flex';
                overlay.classList.remove('hidden'); }
        }

        // ===== SEARCH ORDER =====
        function searchOrder() {
            const input = document.getElementById('orderSearchInput');
            const query = input.value.trim();
            const resultDiv = document.getElementById('searchResult');
            
            if (!query) {
                resultDiv.classList.remove('active');
                resultDiv.innerHTML = '';
                return;
            }

            let foundOrder = null;
            let foundKey = null;
            
            const searchCode = query.toUpperCase();
            Object.keys(ordersData).forEach(key => {
                const order = ordersData[key];
                const orderCode = (order.orderCode || '').toUpperCase();
                const cleanQuery = searchCode.replace('#', '');
                const cleanCode = orderCode.replace('#', '');
                if (cleanCode.includes(cleanQuery) || cleanCode === cleanQuery) {
                    foundOrder = { ...order, id: key };
                    foundKey = key;
                }
                if (!foundOrder && order.productName && order.productName.toLowerCase().includes(query.toLowerCase())) {
                    foundOrder = { ...order, id: key };
                    foundKey = key;
                }
            });

            if (!foundOrder) {
                resultDiv.classList.add('active');
                resultDiv.innerHTML = `
                    <div class="result-card" style="border-color:var(--danger);">
                        <div class="not-found">
                            <span class="icon">🔍</span>
                            <p>Không tìm thấy đơn hàng với mã "<strong>${query}</strong>"</p>
                            <p style="font-size:11px;margin-top:4px;">Vui lòng kiểm tra lại mã đơn hàng (VD: #ABC123)</p>
                        </div>
                    </div>
                `;
                return;
            }

            const order = foundOrder;
            const status = order.status || 'success';
            const statusText = status === 'success' ? '✅ Thành công' : '❌ Thất bại';
            const statusClass = status === 'success' ? 'success' : 'failed';
            const price = (order.price || 0).toLocaleString('vi-VN');
            const time = order.timestamp ? new Date(order.timestamp).toLocaleString('vi-VN') : 'Không rõ';
            const orderCode = order.orderCode || '#' + foundKey.substring(0, 6).toUpperCase();
            const categoryName = categoriesData[order.productCategory]?.name || order.productCategory || 'Không có';
            const orderData = order.orderData || 'Không có dữ liệu';

            resultDiv.classList.add('active');
            resultDiv.innerHTML = `
                <div class="result-card">
                    <div class="result-header">
                        <span class="order-code"><i class="fas fa-key"></i> ${orderCode}</span>
                        <span class="order-status ${statusClass}">${statusText}</span>
                    </div>
                    <div class="result-body">
                        <div class="info-item"><span class="label">Sản phẩm</span><span class="value highlight">${order.productName || 'Không tên'}</span></div>
                        <div class="info-item"><span class="label">Danh mục</span><span class="value">${categoryName}</span></div>
                        <div class="info-item"><span class="label">Người mua</span><span class="value">${order.userName || 'Khách hàng'}</span></div>
                        <div class="info-item"><span class="label">Số lượng</span><span class="value">${order.quantity || 1}</span></div>
                        <div class="info-item"><span class="label">Giá</span><span class="value highlight">${price} VND</span></div>
                        <div class="info-item"><span class="label">Thời gian</span><span class="value" style="font-size:11px;">${time}</span></div>
                        ${order.voucher ? `<div class="info-item"><span class="label">Mã giảm giá</span><span class="value" style="color:var(--success);">${order.voucher} ${order.discountText || ''}</span></div>` : ''}
                        ${order.productDesc ? `<div class="info-item" style="grid-column:1/-1;"><span class="label">Mô tả</span><span class="value" style="font-weight:400;font-size:11px;">${order.productDesc}</span></div>` : ''}
                    </div>
                    <div class="result-data">
                        <div class="data-label"><i class="fas fa-database"></i> Dữ liệu nhận được</div>
                        <div class="data-content" id="orderDataContent">${orderData}</div>
                    </div>
                    <div class="result-actions">
                        <button class="btn-copy" onclick="copyOrderDataFromSearch()"><i class="fas fa-copy"></i> Sao chép</button>
                        <button class="btn-download" onclick="downloadOrderDataFromSearch()"><i class="fas fa-download"></i> Tải xuống</button>
                        <button class="btn-delete" onclick="deleteOrderFromSearch('${foundKey}')"><i class="fas fa-trash"></i> Xóa đơn</button>
                    </div>
                </div>
            `;
            
            resultDiv.dataset.orderKey = foundKey;
            resultDiv.dataset.orderData = orderData;
        }

        function copyOrderDataFromSearch() {
            const resultDiv = document.getElementById('searchResult');
            const data = resultDiv.dataset.orderData || '';
            if (!data) { showToast('Không có dữ liệu để sao chép!', 'error'); return; }
            if (navigator.clipboard) {
                navigator.clipboard.writeText(data)
                    .then(() => showToast('✅ Đã sao chép dữ liệu!', 'success'))
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

        function downloadOrderDataFromSearch() {
            const resultDiv = document.getElementById('searchResult');
            const data = resultDiv.dataset.orderData || '';
            const key = resultDiv.dataset.orderKey || '';
            const order = ordersData[key] || {};
            const orderCode = order.orderCode || key.substring(0, 6);
            try {
                const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `DuLieu_DonHang_${orderCode.replace('#', '')}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 5000);
                showToast('✅ Đã tải xuống!', 'success');
            } catch (error) {
                showToast('❌ Lỗi khi tải file!', 'error');
            }
        }

        function deleteOrderFromSearch(key) {
            if (!confirm('🗑️ Bạn có chắc muốn xóa đơn hàng này?')) return;
            db.ref('orders/' + key).remove()
                .then(() => {
                    showToast('✅ Đã xóa đơn hàng!', 'success');
                    clearSearch();
                    renderOrders();
                    updateDashboard();
                })
                .catch(err => showToast('❌ Lỗi: ' + err.message, 'error'));
        }

        function clearSearch() {
            document.getElementById('orderSearchInput').value = '';
            const resultDiv = document.getElementById('searchResult');
            resultDiv.classList.remove('active');
            resultDiv.innerHTML = '';
        }

        // ===== LOAD ALL DATA =====
        function loadAllData() {
            db.ref('users').on('value', snap => { usersData = snap.val() || {};
                renderUsers();
                updateDashboard(); });
            db.ref('presence').on('value', snap => { onlineUsersMap = snap.val() || {};
                renderUsers(); });
            db.ref('categories').on('value', snap => { categoriesData = snap.val() || {};
                renderCategories();
                updateCategorySelect();
                updateDashboard(); });
            db.ref('products').on('value', snap => { productsData = snap.val() || {};
                renderProducts();
                updateDashboard(); });
            db.ref('orders').on('value', snap => { ordersData = snap.val() || {};
                renderOrders();
                updateDashboard(); });
            db.ref('vouchers').on('value', snap => { vouchersData = snap.val() || {};
                renderVouchers();
                updateDashboard(); });
            loadNotifications();
            setTimeout(() => { hideLoading(); }, 2000);
        }

        // ===== NOTIFICATIONS =====
        function loadNotifications() {
            db.ref('notifications').on('value', snap => {
                const notifs = snap.val();
                const list = document.getElementById('notifList');
                const dot = document.getElementById('notifDot');
                const uid = currentUserUid || auth.currentUser?.uid;
                
                if (notifs) {
                    const keys = Object.keys(notifs).reverse();
                    let html = '', hasUnread = false;
                    keys.forEach(key => {
                        const n = notifs[key];
                        const isUnread = !n.readBy || !n.readBy[uid];
                        if (isUnread && uid) hasUnread = true;
                        const time = n.timestamp ? new Date(n.timestamp).toLocaleString('vi-VN') : '';
                        const msg = n.message || 'Thông báo';
                        html += `<div class="notif-item ${isUnread && uid ? 'unread' : ''}">
                            <i class="fas fa-bell"></i>
                            <div class="notif-content">
                                <div>${msg}</div>
                                ${time ? `<span class="time"><i class="far fa-clock"></i> ${time}</span>` : ''}
                            </div>
                            <button class="delete-notif" onclick="deleteNotification('${key}')" title="Xóa thông báo">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>`;
                    });
                    list.innerHTML = html;
                    dot.classList.toggle('show', hasUnread && localStorage.getItem('notifEnabled') !== 'false');
                } else {
                    list.innerHTML = `<div class="empty"><i class="far fa-bell-slash"></i> Chưa có thông báo</div>`;
                    dot.classList.remove('show');
                }
            });
        }

        function deleteNotification(key) {
            if (!confirm('🗑️ Bạn có chắc muốn xóa thông báo này?')) return;
            db.ref('notifications/' + key).remove()
                .then(() => { showToast('✅ Đã xóa thông báo!', 'success'); })
                .catch(err => { showToast('❌ Lỗi: ' + err.message, 'error'); });
        }

        function sendAdminNotification() {
            const input = document.getElementById('adminChatInput');
            const msg = input.value.trim();
            if (!msg) { showToast('⚠️ Nhập nội dung thông báo!', 'error'); return; }
            if (!currentUserUid && !auth.currentUser) { showToast('⚠️ Vui lòng đăng nhập!', 'error'); return; }
            
            const uid = currentUserUid || auth.currentUser.uid;
            db.ref('users/' + uid).once('value', snap => {
                const userData = snap.val();
                const adminName = userData?.user || userData?.email || 'Admin';
                db.ref('notifications').push({
                    message: `📢 ${adminName}: ${msg}`,
                    timestamp: Date.now(),
                    from: 'admin',
                    readBy: {}
                }).then(() => {
                    showToast('✅ Đã gửi thông báo!', 'success');
                    input.value = '';
                }).catch(err => showToast('❌ ' + err.message, 'error'));
            });
        }

        document.getElementById('adminChatInput').addEventListener('keydown', function(e) {
            if (e.key === 'Enter') sendAdminNotification();
        });

        function toggleNotif() {
            const popup = document.getElementById('notifPopup');
            popup.classList.toggle('active');
            const uid = currentUserUid || auth.currentUser?.uid;
            if (uid && localStorage.getItem('autoView') !== 'false') {
                db.ref('notifications').once('value', snap => {
                    const notifs = snap.val();
                    if (notifs) Object.keys(notifs).forEach(key => db.ref('notifications/' + key + '/readBy/' + uid).set(true));
                });
                document.getElementById('notifDot').classList.remove('show');
            }
        }

        // ===== UPDATE DASHBOARD =====
        function updateDashboard() {
            const u = Object.keys(usersData).length;
            const c = Object.keys(categoriesData).length;
            const p = Object.keys(productsData).length;
            const o = Object.keys(ordersData).length;
            const v = Object.keys(vouchersData).length;
            document.getElementById('dashUsers').textContent = u;
            document.getElementById('dashCategories').textContent = c;
            document.getElementById('dashProducts').textContent = p;
            document.getElementById('dashOrders').textContent = o;
            document.getElementById('dashVouchers').textContent = v;

            let todayRevenue = 0, todayOrders = 0, totalSold = 0, blocked = 0, online = 0;
            const today = new Date(); today.setHours(0,0,0,0);
            Object.keys(ordersData).forEach(key => {
                const ord = ordersData[key];
                totalSold += ord.quantity || 0;
                if (ord.timestamp >= today.getTime()) {
                    todayRevenue += ord.price || 0;
                    todayOrders++;
                }
            });
            Object.keys(usersData).forEach(key => {
                if (usersData[key].blocked === true) blocked++;
                if (onlineUsersMap[key] === true) online++;
            });
            document.getElementById('dashRevenue').textContent = todayRevenue.toLocaleString('vi-VN') + 'đ';
            document.getElementById('dashTodayOrders').textContent = todayOrders;
            document.getElementById('dashTotalSold').textContent = totalSold;
            document.getElementById('dashOnlineUsers').textContent = online;
            document.getElementById('dashBlockedUsers').textContent = blocked;
        }

        // ===== SWITCH TAB =====
        function switchTab(tab) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById('tab-' + tab).classList.add('active');
            if (tab === 'users') renderUsers();
            if (tab === 'categories') renderCategories();
            if (tab === 'products') renderProducts();
            if (tab === 'orders') renderOrders();
            if (tab === 'vouchers') renderVouchers();
            if (tab === 'dashboard') updateDashboard();
        }

        // ===== RENDER USERS =====
        function renderUsers() {
            const container = document.getElementById('userGrid');
            const keys = Object.keys(usersData);
            if (keys.length === 0) { container.innerHTML =
                `<div class="empty-state"><span class="icon">👤</span>Chưa có người dùng</div>`; return; }
            let html = '';
            keys.forEach(key => {
                const u = usersData[key];
                if (u.isAdmin === true) return;
                const isOnline = onlineUsersMap[key] === true;
                const isBlocked = u.blocked === true;
                const name = u.user || u.email || 'Chưa đặt tên';
                const email = u.email || 'Không có email';
                const initial = name.charAt(0).toUpperCase() || '?';
                const statusClass = isBlocked ? 'blocked' : (isOnline ? 'online' : 'offline');
                const statusText = isBlocked ? '🔒 Đã khóa' : (isOnline ? '🟢 Online' : '⚪ Offline');
                html += `
                    <div class="user-card">
                        <div class="user-header">
                            <div class="avatar">${initial}</div>
                            <div class="info">
                                <div class="name">${name}</div>
                                <div class="email">${email}</div>
                            </div>
                        </div>
                        <div class="balance"><i class="fas fa-coins"></i> ${(u.balance||0).toLocaleString('vi-VN')} VND</div>
                        <div><span class="status ${statusClass}">${statusText}</span></div>
                        <div class="actions">
                            <button class="add" onclick="openMoneyModal('${key}','${name.replace(/'/g,"\\'")}',${u.balance||0},'add')"><i class="fas fa-plus"></i></button>
                            <button class="sub" onclick="openMoneyModal('${key}','${name.replace(/'/g,"\\'")}',${u.balance||0},'sub')"><i class="fas fa-minus"></i></button>
                            ${isBlocked ? 
                                `<button class="unblock" onclick="toggleBlock('${key}',false)"><i class="fas fa-unlock"></i></button>` :
                                `<button class="block" onclick="toggleBlock('${key}',true)"><i class="fas fa-lock"></i></button>`
                            }
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        function loadUsersAdmin() { renderUsers();
            showToast('🔄 Đã làm mới!', 'success'); }

        function toggleBlock(uid, block) {
            if (confirm(block ? '🔒 Khóa người dùng này?' : '🔓 Mở khóa?')) {
                db.ref('users/' + uid + '/blocked').set(block).then(() => {
                    showToast(block ? '✅ Đã khóa!' : '✅ Đã mở khóa!', 'success');
                }).catch(err => showToast('❌ ' + err.message, 'error'));
            }
        }

        // ===== MONEY =====
        function openMoneyModal(uid, name, balance, action) {
            document.getElementById('moneyModalTitle').textContent = action === 'add' ? '💰 Cộng tiền' : '💰 Trừ tiền';
            document.getElementById('moneyUserName').textContent = name;
            document.getElementById('moneyCurrentBalance').textContent = balance.toLocaleString('vi-VN') + ' VND';
            document.getElementById('moneyAmount').value = '';
            document.getElementById('moneyNote').value = '';
            document.getElementById('moneyUserId').value = uid;
            document.getElementById('moneyModal').classList.add('active');
        }

        function closeMoneyModal() { document.getElementById('moneyModal').classList.remove('active'); }

        function moneyAction(action) {
            const uid = document.getElementById('moneyUserId').value;
            const amount = parseInt(document.getElementById('moneyAmount').value);
            const note = document.getElementById('moneyNote').value.trim() || 'Admin điều chỉnh';
            if (!uid || !amount || amount <= 0) { showToast('❌ Nhập số tiền hợp lệ!', 'error'); return; }
            const isAdd = action === 'add';
            db.ref('users/' + uid + '/balance').transaction(c => { const v = c || 0; return isAdd ? v + amount : Math.max(0,
                    v - amount); })
                .then(r => {
                    showToast(`✅ ${isAdd?'Cộng':'Trừ'} ${amount.toLocaleString('vi-VN')}đ thành công!`, 'success');
                    closeMoneyModal();
                }).catch(err => showToast('❌ ' + err.message, 'error'));
        }

        // ===== CATEGORY CRUD =====
        function renderCategories() {
            const container = document.getElementById('categoryList');
            const keys = Object.keys(categoriesData);
            if (keys.length === 0) { container.innerHTML =
                `<div class="empty-state"><span class="icon">📁</span>Chưa có mục</div>`; return; }
            let html = '';
            keys.forEach(key => {
                const c = categoriesData[key];
                const count = Object.keys(productsData).filter(p => productsData[p]?.category === key).length;
                const img = c.image || '';
                html += `
                    <div class="category-item">
                        <div class="icon">${img ? `<img src="${img}" onerror="this.parentElement.textContent='${c.icon||'📁'}'" />` : (c.icon||'📁')}</div>
                        <div class="info"><div class="name">${c.name||'Chưa tên'}</div><div class="count">${count} sp</div></div>
                        <div class="actions">
                            <button class="edit" onclick="editCategory('${key}')"><i class="fas fa-edit"></i></button>
                            <button class="del" onclick="deleteCategory('${key}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        function updateCategorySelect() {
            const sel = document.getElementById('productCategory');
            sel.innerHTML = '<option value="">Chọn mục</option>';
            Object.keys(categoriesData).forEach(k => {
                const c = categoriesData[k];
                sel.innerHTML += `<option value="${k}">${c.icon||'📁'} ${c.name}</option>`;
            });
        }

        function openCategoryModal() {
            document.getElementById('categoryModalTitle').textContent = 'Thêm mục';
            document.getElementById('categoryName').value = '';
            document.getElementById('categoryIcon').value = '📁';
            document.getElementById('categoryImage').value = '';
            document.getElementById('categoryImagePreview').textContent = '🖼️';
            document.getElementById('categoryEditId').value = '';
            document.getElementById('categoryModal').classList.add('active');
            document.getElementById('categoryImage').oninput = function() {
                const p = document.getElementById('categoryImagePreview');
                const v = this.value.trim();
                p.innerHTML = v ? `<img src="${v}" onerror="this.parentElement.textContent='❌'" />` : '🖼️';
            };
        }

        function closeCategoryModal() { document.getElementById('categoryModal').classList.remove('active'); }

        function editCategory(key) {
            const c = categoriesData[key];
            if (!c) return;
            document.getElementById('categoryModalTitle').textContent = 'Sửa mục';
            document.getElementById('categoryName').value = c.name || '';
            document.getElementById('categoryIcon').value = c.icon || '📁';
            document.getElementById('categoryImage').value = c.image || '';
            document.getElementById('categoryEditId').value = key;
            const p = document.getElementById('categoryImagePreview');
            p.innerHTML = c.image ? `<img src="${c.image}" onerror="this.parentElement.textContent='❌'" />` : '🖼️';
            document.getElementById('categoryModal').classList.add('active');
        }

        function saveCategory() {
            const name = document.getElementById('categoryName').value.trim();
            const icon = document.getElementById('categoryIcon').value.trim() || '📁';
            const image = document.getElementById('categoryImage').value.trim();
            const editId = document.getElementById('categoryEditId').value;
            if (!name) { showToast('❌ Nhập tên mục!', 'error'); return; }
            const data = { name, icon };
            if (image) data.image = image;
            const ref = editId ? db.ref('categories/' + editId) : db.ref('categories').push();
            ref.set(data).then(() => { showToast(editId ? '✅ Đã cập nhật!' : '✅ Đã thêm!', 'success');
                closeCategoryModal(); })
                .catch(err => showToast('❌ ' + err.message, 'error'));
        }

        function deleteCategory(key) {
            if (confirm('🗑️ Xóa mục này?')) {
                db.ref('categories/' + key).remove().then(() => showToast('✅ Đã xóa!', 'success'))
                    .catch(err => showToast('❌ ' + err.message, 'error'));
            }
        }

        function confirmDeleteAllCategories() {
            if (confirm('🗑️ Xóa TẤT CẢ mục?')) {
                db.ref('categories').remove().then(() => showToast('✅ Đã xóa tất cả!', 'success'))
                    .catch(err => showToast('❌ ' + err.message, 'error'));
            }
        }

        // ===== PRODUCT IMAGE UPLOAD =====
        function uploadProductImage() {
            const fileInput = document.getElementById('productImageInput');
            const file = fileInput.files[0];
            if (!file) return;
            const ext = file.name.split('.').pop().toLowerCase();
            if (!['jpg','jpeg','png','gif','webp','svg'].includes(ext)) {
                showToast('❌ Chỉ hỗ trợ ảnh!', 'error');
                return;
            }
            const path = `product_images/${Date.now()}_${file.name}`;
            const ref = storage.ref(path);
            const uploadTask = ref.put(file);
            uploadTask.on('state_changed', null,
                err => { showToast('❌ Lỗi upload: ' + err.message, 'error'); },
                () => {
                    ref.getDownloadURL().then(url => {
                        document.getElementById('productImage').value = url;
                        document.getElementById('productImagePreview').innerHTML =
                            `<img src="${url}" onerror="this.parentElement.textContent='❌'" />`;
                        showToast('✅ Đã tải ảnh lên!', 'success');
                    }).catch(err => showToast('❌ ' + err.message, 'error'));
                }
            );
        }

        // ===== PRODUCT CRUD =====
        function renderProducts() {
            const container = document.getElementById('productGrid');
            const keys = Object.keys(productsData);
            if (keys.length === 0) { container.innerHTML =
                `<div class="empty-state"><span class="icon">📦</span>Kho hàng trống</div>`; return; }
            let html = '';
            keys.forEach(key => {
                const p = productsData[key];
                let dataArray = [];
                if (p.data) {
                    dataArray = p.data.split('\n').filter(d => d.trim() !== '');
                }
                const stock = dataArray.length;
                const catName = categoriesData[p.category]?.name || 'Không mục';
                const catIcon = categoriesData[p.category]?.icon || '📁';
                html += `
                    <div class="product-card">
                        <div class="top">
                            <div class="img">${p.image ? `<img src="${p.image}" onerror="this.parentElement.textContent='${p.icon||'📦'}'" />` : (p.icon||'📦')}</div>
                            <div class="title">
                                <div class="name">${p.name||'Sản phẩm'}</div>
                                <div class="cat">${catIcon} ${catName}</div>
                            </div>
                        </div>
                        <div class="details">
                            <div class="item"><div class="lbl">Giá</div><div class="val price">${(p.price||0).toLocaleString('vi-VN')}đ</div></div>
                            <div class="item"><div class="lbl">Tồn kho</div><div class="val stock">${stock}</div></div>
                            <div class="item"><div class="lbl">Đã bán</div><div class="val">${p.sold||0}</div></div>
                            <div class="item"><div class="lbl">Trạng thái</div><div class="val" style="color:${stock>0?'var(--success)':'var(--danger)'};font-size:10px;">${stock>0?'🟢 Còn':'🔴 Hết'}</div></div>
                        </div>
                        ${p.description ? `<div class="desc">${p.description}</div>` : ''}
                        <div class="actions">
                            <button class="edit" onclick="editProduct('${key}')"><i class="fas fa-edit"></i> Sửa</button>
                            <button class="data" onclick="openDataModal('${key}','${(p.name||'Sản phẩm').replace(/'/g,"\\'")}')"><i class="fas fa-database"></i> Data (${stock})</button>
                            <button class="del" onclick="deleteProduct('${key}')"><i class="fas fa-trash"></i> Xóa</button>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        function openProductModal() {
            document.getElementById('productModalTitle').textContent = 'Thêm sản phẩm';
            ['productName','productPrice','productCategory','productIcon','productImage','productDesc','productData'].forEach(id => {
                const el = document.getElementById(id);
                if (el && el.type !== 'number') el.value = '';
                else if (el) el.value = '';
            });
            document.getElementById('productIcon').value = '📦';
            document.getElementById('productImagePreview').textContent = '🖼️';
            document.getElementById('productEditId').value = '';
            updateCategorySelect();
            document.getElementById('productModal').classList.add('active');
            document.getElementById('productImageInput').value = '';
            document.getElementById('productImage').oninput = function() {
                const p = document.getElementById('productImagePreview');
                const v = this.value.trim();
                p.innerHTML = v ? `<img src="${v}" onerror="this.parentElement.textContent='❌'" />` : '🖼️';
            };
        }

        function closeProductModal() { document.getElementById('productModal').classList.remove('active'); }

        function editProduct(key) {
            const p = productsData[key];
            if (!p) return;
            document.getElementById('productModalTitle').textContent = 'Sửa sản phẩm';
            document.getElementById('productName').value = p.name || '';
            document.getElementById('productPrice').value = p.price || '';
            document.getElementById('productCategory').value = p.category || '';
            document.getElementById('productIcon').value = p.icon || '📦';
            document.getElementById('productImage').value = p.image || '';
            document.getElementById('productDesc').value = p.description || '';
            document.getElementById('productData').value = p.data || '';
            document.getElementById('productEditId').value = key;
            const preview = document.getElementById('productImagePreview');
            preview.innerHTML = p.image ? `<img src="${p.image}" onerror="this.parentElement.textContent='❌'" />` : '🖼️';
            document.getElementById('productImageInput').value = '';
            updateCategorySelect();
            document.getElementById('productModal').classList.add('active');
        }

        function saveProduct() {
            const name = document.getElementById('productName').value.trim();
            const price = parseInt(document.getElementById('productPrice').value);
            const category = document.getElementById('productCategory').value;
            const icon = document.getElementById('productIcon').value.trim() || '📦';
            const image = document.getElementById('productImage').value.trim();
            const description = document.getElementById('productDesc').value.trim();
            const dataRaw = document.getElementById('productData').value;
            
            // Tách dòng bằng \n và \r\n, lọc bỏ dòng trống
            const dataLines = dataRaw.split(/\r?\n/).map(d => d.trim()).filter(d => d !== '');
            const dataString = dataLines.join('\n');
            const editId = document.getElementById('productEditId').value;
            
            if (!name) { showToast('❌ Nhập tên sản phẩm!', 'error'); return; }
            if (!price || price < 0) { showToast('❌ Nhập giá hợp lệ!', 'error'); return; }
            if (!category) { showToast('❌ Chọn mục!', 'error'); return; }
            if (dataLines.length === 0) { showToast('❌ Nhập ít nhất 1 dữ liệu!', 'error'); return; }
            
            const data = { name, price, category, icon, data: dataString, sold: 0 };
            if (image) data.image = image;
            if (description) data.description = description;
            
            const ref = editId ? db.ref('products/' + editId) : db.ref('products').push();
            ref.set(data)
                .then(() => {
                    const count = dataLines.length;
                    showToast(editId ? '✅ Đã cập nhật!' : `✅ Đã thêm ${count} món!`, 'success');
                    closeProductModal();
                })
                .catch(err => showToast('❌ ' + err.message, 'error'));
        }

        function deleteProduct(key) {
            if (confirm('🗑️ Xóa sản phẩm?')) {
                db.ref('products/' + key).remove().then(() => showToast('✅ Đã xóa!', 'success'))
                    .catch(err => showToast('❌ ' + err.message, 'error'));
            }
        }

        function confirmDeleteAllProducts() {
            if (confirm('🗑️ Xóa TẤT CẢ sản phẩm?')) {
                db.ref('products').remove().then(() => showToast('✅ Đã xóa tất cả!', 'success'))
                    .catch(err => showToast('❌ ' + err.message, 'error'));
            }
        }

        // ===== DATA MANAGEMENT =====
        function openDataModal(productId, productName) {
            const p = productsData[productId];
            if (!p) { showToast('❌ Không tìm thấy!', 'error'); return; }
            
            let dataArray = [];
            if (p.data) {
                dataArray = p.data.split('\n').filter(d => d.trim() !== '');
            }
            
            document.getElementById('dataProductName').textContent = productName;
            document.getElementById('dataCount').textContent = dataArray.length;
            document.getElementById('dataProductId').value = productId;
            document.getElementById('dataNewItem').value = '';
            renderDataList(dataArray);
            document.getElementById('dataModal').classList.add('active');
        }

        function renderDataList(data) {
            const container = document.getElementById('dataList');
            if (!data || data.length === 0) { 
                container.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:4px;">Chưa có dữ liệu</div>`; 
                document.getElementById('dataCount').textContent = '0';
                return; 
            }
            let html = '';
            data.forEach((item, i) => {
                const displayItem = item || 'Không có dữ liệu';
                html += `
                    <div class="item">
                        <span>${i+1}. ${displayItem}</span>
                        <span class="remove" onclick="removeDataItem(${i})"><i class="fas fa-times"></i></span>
                    </div>
                `;
            });
            container.innerHTML = html;
            document.getElementById('dataCount').textContent = data.length;
        }

        function addDataItem() {
            const input = document.getElementById('dataNewItem');
            const newItem = input.value.trim();
            if (!newItem) { showToast('❌ Nhập dữ liệu!', 'error'); return; }
            
            const productId = document.getElementById('dataProductId').value;
            const p = productsData[productId];
            if (!p) { showToast('❌ Không tìm thấy sản phẩm!', 'error'); return; }
            
            let current = [];
            if (p.data) {
                current = p.data.split('\n').filter(d => d.trim() !== '');
            }
            
            current.push(newItem);
            const newStr = current.join('\n');
            
            db.ref('products/' + productId + '/data').set(newStr)
                .then(() => {
                    showToast('✅ Đã thêm dữ liệu mới!', 'success');
                    productsData[productId].data = newStr;
                    renderDataList(current);
                    renderProducts();
                    input.value = '';
                })
                .catch(err => showToast('❌ Lỗi: ' + err.message, 'error'));
        }

        function removeDataItem(index) {
            if (!confirm('🗑️ Xóa dữ liệu này?')) return;
            
            const productId = document.getElementById('dataProductId').value;
            const p = productsData[productId];
            if (!p) { showToast('❌ Không tìm thấy sản phẩm!', 'error'); return; }
            
            let current = [];
            if (p.data) {
                current = p.data.split('\n').filter(d => d.trim() !== '');
            }
            
            if (index < 0 || index >= current.length) {
                showToast('❌ Không tìm thấy dữ liệu để xóa!', 'error');
                return;
            }
            
            current.splice(index, 1);
            const newStr = current.join('\n');
            
            db.ref('products/' + productId + '/data').set(newStr)
                .then(() => {
                    showToast('✅ Đã xóa dữ liệu!', 'success');
                    productsData[productId].data = newStr;
                    renderDataList(current);
                    renderProducts();
                })
                .catch(err => showToast('❌ Lỗi: ' + err.message, 'error'));
        }

        function closeDataModal() { 
            document.getElementById('dataModal').classList.remove('active'); 
        }

        // ===== ORDERS =====
        function renderOrders() {
            const container = document.getElementById('ordersList');
            const keys = Object.keys(ordersData);
            if (keys.length === 0) { container.innerHTML =
                `<div class="empty-state"><span class="icon">📦</span>Chưa có đơn hàng</div>`; return; }
            let html = '';
            const sorted = keys.sort((a, b) => (ordersData[b]?.timestamp || 0) - (ordersData[a]?.timestamp || 0));
            sorted.forEach(key => {
                const o = ordersData[key];
                const status = o.status || 'success';
                html += `
                    <div class="order-item">
                        <div class="img">${o.productImage ? `<img src="${o.productImage}" onerror="this.parentElement.textContent='${o.productIcon||'📦'}'" />` : (o.productIcon||'📦')}</div>
                        <div class="info">
                            <div class="name">${o.productName||'Sản phẩm'}</div>
                            <div class="meta">
                                <span><i class="fas fa-coins"></i> ${(o.price||0).toLocaleString('vi-VN')}đ</span>
                                <span><i class="fas fa-user"></i> ${o.userName||'Khách'}</span>
                                <span class="code"><i class="fas fa-key"></i> ${o.orderCode||'#'+key.substring(0,6)}</span>
                                <span><i class="fas fa-clock"></i> ${new Date(o.timestamp).toLocaleString('vi-VN')}</span>
                            </div>
                        </div>
                        <span class="badge ${status}">${status==='success'?'✅ Thành công':'❌ Thất bại'}</span>
                        <button class="del-btn" onclick="deleteOrder('${key}')"><i class="fas fa-trash"></i></button>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        function deleteOrder(key) {
            if (confirm('🗑️ Xóa đơn hàng?')) {
                db.ref('orders/' + key).remove().then(() => showToast('✅ Đã xóa!', 'success'))
                    .catch(err => showToast('❌ ' + err.message, 'error'));
            }
        }

        function confirmDeleteAllOrders() {
            if (confirm('🗑️ Xóa TẤT CẢ đơn hàng?')) {
                db.ref('orders').remove().then(() => showToast('✅ Đã xóa tất cả!', 'success'))
                    .catch(err => showToast('❌ ' + err.message, 'error'));
            }
        }

        // ===== VOUCHERS =====
        function renderVouchers() {
            const container = document.getElementById('voucherList');
            const keys = Object.keys(vouchersData);
            if (keys.length === 0) { container.innerHTML =
                `<div class="empty-state"><span class="icon">🎫</span>Chưa có mã giảm giá</div>`; return; }
            let html = '';
            keys.forEach(key => {
                const v = vouchersData[key];
                const typeText = v.type === 'percent' ? `${v.value}%` : `${v.value.toLocaleString('vi-VN')}đ`;
                html += `
                    <div class="voucher-item">
                        <span class="code">${key}</span>
                        <span class="info">Giảm ${typeText} • ${v.usedCount||0}/${v.maxUses||0} lượt</span>
                        <button class="del-btn" onclick="deleteVoucher('${key}')"><i class="fas fa-trash"></i></button>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        function openVoucherModal() {
            document.getElementById('voucherCode').value = '';
            document.getElementById('voucherType').value = 'percent';
            document.getElementById('voucherValue').value = '';
            document.getElementById('voucherMaxUses').value = '10';
            document.getElementById('voucherModal').classList.add('active');
        }

        function closeVoucherModal() { document.getElementById('voucherModal').classList.remove('active'); }

        function saveVoucher() {
            const code = document.getElementById('voucherCode').value.trim().toUpperCase();
            const type = document.getElementById('voucherType').value;
            const value = parseInt(document.getElementById('voucherValue').value);
            const maxUses = parseInt(document.getElementById('voucherMaxUses').value) || 10;
            if (!code) { showToast('❌ Nhập mã!', 'error'); return; }
            if (!value || value <= 0) { showToast('❌ Nhập giá trị!', 'error'); return; }
            if (type === 'percent' && value > 100) { showToast('❌ % không quá 100!', 'error'); return; }
            db.ref('vouchers/' + code).set({ type, value, maxUses, usedCount: 0 })
                .then(() => { showToast('✅ Đã tạo!', 'success');
                    closeVoucherModal(); })
                .catch(err => showToast('❌ ' + err.message, 'error'));
        }

        function deleteVoucher(key) {
            if (confirm(`🗑️ Xóa mã "${key}"?`)) {
                db.ref('vouchers/' + key).remove().then(() => showToast('✅ Đã xóa!', 'success'))
                    .catch(err => showToast('❌ ' + err.message, 'error'));
            }
        }

        function confirmDeleteAllVouchers() {
            if (confirm('🗑️ Xóa TẤT CẢ mã?')) {
                db.ref('vouchers').remove().then(() => showToast('✅ Đã xóa tất cả!', 'success'))
                    .catch(err => showToast('❌ ' + err.message, 'error'));
            }
        }

        // ===== REFRESH =====
        function refreshAll() {
            showLoading();
            setTimeout(() => {
                loadAllData();
                setTimeout(() => { hideLoading();
                    showToast('🔄 Đã làm mới!', 'success'); }, 1000);
            }, 500);
        }

        // ===== AUTH =====
        auth.onAuthStateChanged((user) => {
            if (user) {
                currentUserUid = user.uid;
                db.ref('users/' + user.uid).once('value', snap => {
                    const data = snap.val();
                    if (!data || data.isAdmin !== true) {
                        alert('⚠️ Không có quyền truy cập!');
                        window.location.replace('../../index');
                        return;
                    }
                    isAdmin = true;
                    loadAllData();
                });
                db.ref('users/' + user.uid + '/balance').on('value', snap => {
                    document.getElementById('balanceAmount').textContent = (snap.val() || 0).toLocaleString('vi-VN');
                });
            } else {
                window.location.replace('../../auth/login');
            }
            setTimeout(() => { hideLoading(); }, 3000);
        });

        // ===== MENU =====
        function toggleMenu() { document.getElementById('sideMenu').classList.toggle('active');
            document.getElementById('menuOverlay').classList.toggle('active'); }
        function closeMenu() { document.getElementById('sideMenu').classList.remove('active');
            document.getElementById('menuOverlay').classList.remove('active'); }
        
        function togglePopup(e) { 
            e.stopPropagation();
            const popup = document.getElementById('settingsPopup');
            popup.classList.toggle('active');
        }
        
        document.addEventListener('click', function(e) {
            const popup = document.getElementById('settingsPopup');
            const wrapper = document.querySelector('.settings-wrapper');
            if (wrapper && !wrapper.contains(e.target)) {
                popup.classList.remove('active');
            }
        });

        // ===== CÁC HÀM CHUYỂN HƯỚNG ĐÃ ĐƯỢC SỬA =====
        function goHome() { closeMenu();
            window.location.href = '../../index'; }
        function goHistory() { closeMenu();
            window.location.href = '../../pages/history'; }
        function goTopup() { closeMenu();
            showToast('💰 Đang phát triển!', 'error'); }
        function goEarn() { closeMenu();
            window.location.href = '../../pages/earn-money'; }
        function goSupport() { closeMenu();
            window.location.href = '../../pages/support'; }
        
        // ===== CÁC HÀM CHUYỂN HƯỚNG ĐẾN user/ =====
        function goToProfile() { 
            closeMenu();
            window.location.href = '../../user/profile'; 
        }
        function goToSecurity() { 
            closeMenu();
            window.location.href = '../../user/security'; 
        }
        function goToBalance() { 
            closeMenu();
            window.location.href = '../../user/balance'; 
        }
        function goToSettings() { 
            closeMenu();
            window.location.href = '../../user/settings'; 
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

        document.querySelectorAll('.modal-overlay').forEach(el => {
            el.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('active'); });
        });

        window.addEventListener('storage', function(e) {
            if (e.key === 'theme' || e.key === 'theme_name') { applyTheme(); }
        });

        showLoading();

