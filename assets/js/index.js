// Extracted from index.html

let isDataLoaded = false;
        let currentUser = null;
        let selectedCategory = 'all';
        let categoriesData = {};
        let productsData = {};
        let vouchersData = {};
        let currentProduct = null;
        let currentQuantity = 1;
        let currentVoucherCode = null;
        let currentVoucherDiscount = 0;
        let isProcessing = false;

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

        function showLoading() {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) { overlay.style.display = 'flex'; overlay.classList.remove('hidden'); }
        }

        function loadDataWithRetry() {
            return new Promise((resolve) => {
                let loaded = false;
                let timeoutId = null;
                
                const productsRef = db.ref('products');
                productsRef.on('value', (snapshot) => {
                    productsData = snapshot.val() || {};
                    renderCategories();
                    renderProductsByCategory();
                    if (!loaded) {
                        loaded = true;
                        if (timeoutId) clearTimeout(timeoutId);
                        isDataLoaded = true;
                        hideLoading();
                        resolve();
                    }
                });
                
                const categoriesRef = db.ref('categories');
                categoriesRef.on('value', (snapshot) => {
                    categoriesData = snapshot.val() || {};
                    renderCategories();
                    renderProductsByCategory();
                });
                
                db.ref('vouchers').on('value', (snapshot) => {
                    vouchersData = snapshot.val() || {};
                });
                
                timeoutId = setTimeout(() => {
                    if (!loaded) {
                        loaded = true;
                        isDataLoaded = true;
                        renderCategories();
                        renderProductsByCategory();
                        hideLoading();
                        resolve();
                    }
                }, 2500);
            });
        }

        function forceLoadData() {
            if (!isDataLoaded) {
                if (Object.keys(productsData).length === 0) productsData = {};
                if (Object.keys(categoriesData).length === 0) categoriesData = {};
                renderCategories();
                renderProductsByCategory();
                isDataLoaded = true;
                hideLoading();
            }
        }

        function renderCategories() {
            const grid = document.getElementById('categoryGrid');
            const countEl = document.getElementById('categoryCount');
            const keys = Object.keys(categoriesData);
            countEl.textContent = `(${keys.length} mục)`;
            
            const allLabel = '📦 Tất cả';
            const allCount = Object.keys(productsData).length;
            
            let html = `
                <div class="category-item ${selectedCategory === 'all' ? 'active' : ''}" onclick="selectCategory('all')">
                    <div class="cat-image" style="font-size:18px;">📦</div>
                    <div class="cat-info">
                        <div class="cat-name">${allLabel}</div>
                        <div class="cat-count">${allCount} sp</div>
                    </div>
                </div>
            `;
            
            keys.forEach(key => {
                const cat = categoriesData[key];
                const productCount = Object.keys(productsData).filter(pid => productsData[pid] && productsData[pid].category === key).length;
                const isActive = selectedCategory === key ? 'active' : '';
                const imageUrl = cat.image || '';
                const icon = cat.icon || '📁';
                
                html += `
                    <div class="category-item ${isActive}" onclick="selectCategory('${key}')">
                        <div class="cat-image">
                            ${imageUrl ? `<img src="${imageUrl}" alt="${cat.name}" onerror="this.style.display='none';this.parentElement.textContent='${icon}'" />` : icon}
                        </div>
                        <div class="cat-info">
                            <div class="cat-name">${cat.name || 'Chưa đặt tên'}</div>
                            <div class="cat-count">${productCount} sp</div>
                        </div>
                    </div>
                `;
            });
            
            grid.innerHTML = html;
        }

        function selectCategory(categoryId) {
            selectedCategory = categoryId;
            renderCategories();
            renderProductsByCategory();
        }

        function renderProductsByCategory() {
            const container = document.getElementById('productContainer');
            
            let categoryKeys = Object.keys(categoriesData);
            if (selectedCategory !== 'all') {
                categoryKeys = categoryKeys.filter(k => k === selectedCategory);
            }
            
            if (categoryKeys.length === 0) {
                container.innerHTML = `<div class="product-empty"><span class="big-icon">📦</span><p>Chưa có danh mục nào</p></div>`;
                return;
            }
            
            let html = '';
            let hasProduct = false;
            
            categoryKeys.forEach(catKey => {
                const cat = categoriesData[catKey];
                const products = Object.keys(productsData)
                    .filter(pid => productsData[pid] && productsData[pid].category === catKey)
                    .map(pid => ({ id: pid, ...productsData[pid] }));
                
                if (products.length === 0) return;
                hasProduct = true;
                
                const catImage = cat.image || '';
                const catIcon = cat.icon || '📁';
                const catName = cat.name || 'Chưa đặt tên';
                
                html += `
                    <div class="category-container">
                        <div class="category-container-header">
                            <div class="cat-logo">
                                ${catImage ? `<img src="${catImage}" onerror="this.style.display='none';this.parentElement.textContent='${catIcon}'" />` : catIcon}
                            </div>
                            <div class="cat-title">${catName}</div>
                            <div class="cat-count-badge">${products.length} sản phẩm</div>
                        </div>
                        <div class="product-grid-in-category">
                `;
                
                products.forEach(product => {
                    const dataArray = product.data ? product.data.split('\n').filter(d => d.trim() !== '') : [];
                    const stock = dataArray.length;
                    const isOutOfStock = stock <= 0;
                    const price = product.price ? product.price.toLocaleString('vi-VN') : '0';
                    const image = product.image || '';
                    const icon = product.icon || '📦';
                    const desc = product.description || '';
                    const statusText = isOutOfStock ? 'Hết hàng' : 'Còn hàng';
                    const statusClass = isOutOfStock ? 'unavailable' : 'available';
                    
                    html += `
                        <div class="product-card">
                            <div class="product-top-row">
                                <div class="product-image">
                                    ${image ? `<img src="${image}" alt="${product.name}" onerror="this.style.display='none';this.parentElement.textContent='${icon}'" />` : icon}
                                </div>
                                <div class="product-name-area">
                                    <div class="product-name">${product.name || 'Sản phẩm'}</div>
                                </div>
                            </div>
                            <div class="product-price-stock">
                                <div class="product-price-box">${price} VND</div>
                                <div class="product-stock-box">
                                    <i class="fas fa-boxes"></i>
                                    <span class="${isOutOfStock ? 'out-of-stock' : 'in-stock'}">${stock}</span>
                                </div>
                            </div>
                            <div class="product-status ${statusClass}">
                                ${isOutOfStock ? '🔴 Hết hàng' : '🟢 Còn hàng'}
                            </div>
                            ${desc ? `<div class="product-desc-full"><i class="fas fa-info-circle"></i> ${desc}</div>` : ''}
                            <button class="btn-buy" ${isOutOfStock ? 'disabled' : ''} onclick="openBuyPopup('${product.id}')">
                                ${isOutOfStock ? 'Hết hàng' : '<i class="fas fa-shopping-cart"></i> Mua ngay'}
                            </button>
                        </div>
                    `;
                });
                
                html += `
                        </div>
                    </div>
                `;
            });
            
            if (!hasProduct) {
                container.innerHTML = `<div class="product-empty"><span class="big-icon">📦</span><p>Không có sản phẩm trong danh mục này</p></div>`;
                return;
            }
            
            container.innerHTML = html;
        }

        function openBuyPopup(productId) {
            const product = productsData[productId];
            if (!product) {
                showToast('Sản phẩm không tồn tại!', 'error');
                return;
            }
            
            const dataArray = product.data ? product.data.split('\n').filter(d => d.trim() !== '') : [];
            const stock = dataArray.length;
            if (stock <= 0) {
                showToast('Sản phẩm đã hết hàng!', 'error');
                return;
            }
            
            currentProduct = {
                id: productId,
                ...product,
                dataArray: dataArray
            };
            currentQuantity = 1;
            currentVoucherCode = null;
            currentVoucherDiscount = 0;
            
            const iconEl = document.getElementById('popupProductIcon');
            if (product.image) {
                iconEl.innerHTML = `<img src="${product.image}" onerror="this.parentElement.textContent='${product.icon || '📦'}'" />`;
            } else {
                iconEl.textContent = product.icon || '📦';
            }
            document.getElementById('popupProductName').textContent = product.name || 'Sản phẩm';
            document.getElementById('popupProductPrice').textContent = (product.price || 0).toLocaleString('vi-VN') + ' VND';
            document.getElementById('popupBalance').textContent = (currentUser?.balance || 0).toLocaleString('vi-VN') + ' VND';
            document.getElementById('qtyNumber').textContent = '1';
            document.getElementById('popupVoucherInput').value = '';
            document.getElementById('popupVoucherStatus').textContent = '';
            document.getElementById('popupVoucherStatus').className = '';
            
            updateTotalPrice();
            document.getElementById('orderPopup').classList.add('active');
        }

        function changeQuantity(delta) {
            if (!currentProduct) return;
            const stock = currentProduct.dataArray ? currentProduct.dataArray.length : 0;
            const newQty = currentQuantity + delta;
            if (newQty < 1) return;
            if (newQty > stock) {
                showToast('Số lượng vượt quá tồn kho!', 'error');
                return;
            }
            currentQuantity = newQty;
            document.getElementById('qtyNumber').textContent = currentQuantity;
            updateTotalPrice();
        }

        function applyPopupVoucher() {
            const input = document.getElementById('popupVoucherInput');
            const code = input.value.trim().toUpperCase();
            const statusEl = document.getElementById('popupVoucherStatus');
            
            if (!code) {
                statusEl.textContent = '⚠️ Nhập mã!';
                statusEl.className = 'applied-voucher';
                statusEl.style.color = 'var(--danger)';
                return;
            }
            
            const voucher = vouchersData[code];
            if (!voucher) {
                statusEl.textContent = '❌ Không hợp lệ!';
                statusEl.className = 'applied-voucher';
                statusEl.style.color = 'var(--danger)';
                return;
            }
            
            if (voucher.usedCount >= voucher.maxUses) {
                statusEl.textContent = '❌ Hết lượt!';
                statusEl.className = 'applied-voucher';
                statusEl.style.color = 'var(--danger)';
                return;
            }
            
            currentVoucherCode = code;
            if (voucher.type === 'percent') {
                currentVoucherDiscount = voucher.value / 100;
                statusEl.textContent = `✅ Giảm ${voucher.value}%`;
            } else {
                currentVoucherDiscount = voucher.value;
                statusEl.textContent = `✅ -${voucher.value.toLocaleString('vi-VN')}đ`;
            }
            statusEl.className = 'applied-voucher';
            statusEl.style.color = 'var(--success)';
            
            updateTotalPrice();
            showToast('✅ Đã áp mã!', 'success');
        }

        function updateTotalPrice() {
            if (!currentProduct) return;
            const basePrice = currentProduct.price || 0;
            let total = basePrice * currentQuantity;
            
            if (currentVoucherCode) {
                const voucher = vouchersData[currentVoucherCode];
                if (voucher) {
                    if (voucher.type === 'percent') {
                        total = total * (1 - voucher.value / 100);
                    } else {
                        total = Math.max(0, total - voucher.value);
                    }
                }
            }
            
            document.getElementById('popupTotalPrice').textContent = Math.round(total).toLocaleString('vi-VN') + ' VND';
        }

        function confirmOrderDirect() {
            if (isProcessing) {
                showToast('⏳ Đang xử lý, vui lòng đợi...', 'error');
                return;
            }
            
            if (!currentProduct) {
                showToast('❌ Không có sản phẩm!', 'error');
                return;
            }
            
            if (!currentUser) {
                showToast('Vui lòng đăng nhập!', 'error');
                return;
            }
            
            const dataArray = currentProduct.dataArray || [];
            if (dataArray.length < currentQuantity) {
                showToast('Số lượng vượt quá tồn kho!', 'error');
                return;
            }
            
            let price = (currentProduct.price || 0) * currentQuantity;
            let voucherUsed = null;
            let discountText = '';
            
            if (currentVoucherCode) {
                const voucher = vouchersData[currentVoucherCode];
                if (voucher && voucher.usedCount < voucher.maxUses) {
                    if (voucher.type === 'percent') {
                        const discount = price * voucher.value / 100;
                        price = price - discount;
                        discountText = `-${voucher.value}%`;
                    } else {
                        price = Math.max(0, price - voucher.value);
                        discountText = `-${voucher.value.toLocaleString('vi-VN')}đ`;
                    }
                    voucherUsed = currentVoucherCode;
                }
            }
            price = Math.round(price);
            
            if (currentUser.balance < price) {
                showToast('Số dư không đủ!', 'error');
                return;
            }
            
            isProcessing = true;
            const btn = document.getElementById('btnConfirmOrder');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
            
            const productId = currentProduct.id;
            const soldData = dataArray.slice(0, currentQuantity);
            const remainingData = dataArray.slice(currentQuantity);
            const remainingDataStr = remainingData.join('\n');
            
            const updates = {};
            updates[`users/${currentUser.uid}/balance`] = currentUser.balance - price;
            updates[`products/${productId}/data`] = remainingDataStr;
            updates[`products/${productId}/sold`] = (currentProduct.sold || 0) + currentQuantity;
            
            const orderCode = '#' + Math.random().toString(36).substring(2, 8).toUpperCase();
            const orderDataStr = soldData.join('\n');
            
            const orderRef = db.ref('orders').push();
            const orderData = {
                userId: currentUser.uid,
                userName: currentUser.displayName || currentUser.email || 'Khách hàng',
                productId: productId,
                productName: currentProduct.name,
                productImage: currentProduct.image || '',
                productIcon: currentProduct.icon || '📦',
                productDesc: currentProduct.description || '',
                productCategory: currentProduct.category || '',
                originalPrice: currentProduct.price || 0,
                price: price,
                quantity: currentQuantity,
                voucher: voucherUsed,
                discountText: discountText,
                orderCode: orderCode,
                orderData: orderDataStr,
                timestamp: Date.now(),
                status: 'success'
            };
            updates[orderRef.toString().replace('https://shop-c6777-default-rtdb.asia-southeast1.firebasedatabase.app/', '')] = orderData;
            
            const historyRef = db.ref('history/' + currentUser.uid).push();
            const historyData = {
                orderCode: orderCode,
                productName: currentProduct.name,
                productDesc: currentProduct.description || '',
                productCategory: currentProduct.category || '',
                price: price,
                quantity: currentQuantity,
                voucher: voucherUsed,
                discountText: discountText,
                orderData: orderDataStr,
                status: 'success',
                timestamp: Date.now(),
                type: 'purchase'
            };
            updates[historyRef.toString().replace('https://shop-c6777-default-rtdb.asia-southeast1.firebasedatabase.app/', '')] = historyData;
            
            if (voucherUsed) {
                updates[`vouchers/${voucherUsed}/usedCount`] = (vouchersData[voucherUsed]?.usedCount || 0) + 1;
            }
            
            db.ref().update(updates)
                .then(() => {
                    db.ref('users/' + currentUser.uid + '/balance').once('value', snap => {
                        const bal = snap.val() || 0;
                        document.getElementById('balanceAmount').textContent = bal.toLocaleString('vi-VN');
                        currentUser.balance = bal;
                    });
                    
                    if (productsData[productId]) {
                        productsData[productId].data = remainingDataStr;
                        productsData[productId].sold = (currentProduct.sold || 0) + currentQuantity;
                    }
                    
                    renderProductsByCategory();
                    closeOrderPopup();
                    showResultPopup(orderData);
                    showToast('✅ Mua thành công!', 'success');
                    
                    isProcessing = false;
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-shopping-cart"></i> Xác nhận mua';
                })
                .catch(err => {
                    showToast('❌ Lỗi: ' + err.message, 'error');
                    isProcessing = false;
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-shopping-cart"></i> Xác nhận mua';
                });
        }

        function closeOrderPopup() {
            document.getElementById('orderPopup').classList.remove('active');
            currentProduct = null;
            currentQuantity = 1;
            currentVoucherCode = null;
            currentVoucherDiscount = 0;
            const btn = document.getElementById('btnConfirmOrder');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-shopping-cart"></i> Xác nhận mua';
            isProcessing = false;
        }

        function showResultPopup(orderData) {
            const popup = document.getElementById('resultPopup');
            const grid = document.getElementById('resultInfoGrid');
            const productDetail = document.getElementById('resultProductDetail');
            const totalEl = document.getElementById('resultTotal');
            const codeText = document.getElementById('resultOrderCodeText');
            const statusIcon = document.getElementById('resultStatusIcon');
            const statusTitle = document.getElementById('resultStatusTitle');
            
            const isSuccess = orderData.status === 'success';
            statusIcon.textContent = isSuccess ? '✅' : '❌';
            statusTitle.textContent = isSuccess ? '🎉 Thành công!' : '❌ Thất bại!';
            statusTitle.style.color = isSuccess ? 'var(--success)' : 'var(--danger)';
            
            const price = orderData.price.toLocaleString('vi-VN');
            const orderCode = orderData.orderCode || '#' + Math.random().toString(36).substring(2, 8).toUpperCase();
            codeText.textContent = orderCode;
            
            const categoryName = categoriesData[orderData.productCategory]?.name || orderData.productCategory || 'Không có';
            const orderDataStr = orderData.orderData || 'Không có dữ liệu';
            
            grid.innerHTML = `
                <div class="info-item"><div class="label"><i class="fas fa-user"></i> Người mua</div><div class="value">${orderData.userName || 'Khách hàng'}</div></div>
                <div class="info-item"><div class="label"><i class="fas fa-tag"></i> Loại mục</div><div class="value">${categoryName}</div></div>
                <div class="info-item"><div class="label"><i class="fas fa-clock"></i> Thời gian</div><div class="value" style="font-size:11px;">${new Date(orderData.timestamp).toLocaleString('vi-VN')}</div></div>
                <div class="info-item"><div class="label"><i class="fas fa-boxes"></i> Số lượng</div><div class="value">${orderData.quantity || 1}</div></div>
                ${orderData.voucher ? `<div class="info-item full"><div class="label"><i class="fas fa-ticket-alt"></i> Mã giảm giá</div><div class="value" style="color:var(--success);">${orderData.voucher} ${orderData.discountText || ''}</div></div>` : ''}
                <div class="info-item full"><div class="label"><i class="fas fa-database"></i> Dữ liệu</div><div class="value" style="font-weight:400;font-size:11px;font-family:monospace;background:var(--bg-card);padding:3px 6px;border-radius:4px;border:1px solid var(--border-color);word-break:break-all;">${orderDataStr}</div></div>
            `;
            
            const image = orderData.productImage || orderData.productIcon || '📦';
            productDetail.innerHTML = `
                <div class="product-detail">
                    <div class="pd-image">
                        ${orderData.productImage ? `<img src="${orderData.productImage}" onerror="this.style.display='none';this.parentElement.textContent='${orderData.productIcon || '📦'}'" />` : (orderData.productIcon || '📦')}
                    </div>
                    <div class="pd-info">
                        <div class="pd-name">${orderData.productName || 'Sản phẩm'}</div>
                        ${orderData.productDesc ? `<div class="pd-desc"><i class="fas fa-info-circle"></i> ${orderData.productDesc}</div>` : ''}
                    </div>
                </div>
            `;
            
            totalEl.textContent = price;
            popup.classList.add('active');
        }

        function closeResultPopup() {
            document.getElementById('resultPopup').classList.remove('active');
        }

        auth.onAuthStateChanged(async (user) => {
            if (isDataLoaded && currentUser) return;
            
            if (!user) { 
                window.location.replace('auth/login'); 
                return; 
            }
            
            try {
                const blockSnap = await db.ref('users/' + user.uid + '/blocked').once('value');
                if (blockSnap.val() === true) {
                    await auth.signOut();
                    window.location.replace('auth/login');
                    return;
                }

                await db.ref('presence/' + user.uid).set(true);
                db.ref('presence/' + user.uid).onDisconnect().set(false);
                
                const userSnap = await db.ref('users/' + user.uid + '/balance').once('value');
                const balance = userSnap.val() || 0;
                document.getElementById('balanceAmount').textContent = balance.toLocaleString('vi-VN');
                currentUser = { uid: user.uid, balance: balance };
                
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
                
                await loadDataWithRetry();
                isDataLoaded = true;
                hideLoading();
                
            } catch (error) {
                console.error('Lỗi load dữ liệu:', error);
                hideLoading();
                forceLoadData();
            }
        });

        setTimeout(() => {
            if (!isDataLoaded) {
                forceLoadData();
            }
        }, 3000);

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

        function goHome() { closeMenu(); window.location.href = 'index'; }
        function goHistory() { closeMenu(); window.location.href = 'pages/history'; }
        function goTopup() { closeMenu(); showToast('💰 Đang phát triển!', 'error'); }
        function goEarn() { closeMenu(); window.location.href = 'pages/earn-money'; }
        function goSupport() { closeMenu(); window.location.href = 'pages/support'; }
        function goToProfile() { window.location.href = 'user/profile'; }
        function goToSecurity() { window.location.href = 'user/security'; }
        function goToBalance() { window.location.href = 'user/balance'; }
        function goToSettings() { window.location.href = 'user/settings'; }

        function logout() {
            if (confirm('Đăng xuất?')) {
                const user = auth.currentUser;
                if (user) {
                    db.ref('presence/' + user.uid).set(false);
                }
                auth.signOut().then(() => {
                    window.location.replace('auth/login');
                });
            }
        }

        document.getElementById('popupVoucherInput').addEventListener('keydown', function(e) {
            if (e.key === 'Enter') applyPopupVoucher();
        });

        document.getElementById('orderPopup').addEventListener('click', function(e) {
            if (e.target === this) closeOrderPopup();
        });
        document.getElementById('resultPopup').addEventListener('click', function(e) {
            if (e.target === this) closeResultPopup();
        });

        window.addEventListener('storage', function(e) {
            if (e.key === 'theme' || e.key === 'theme_name') { applyTheme(); }
        });

        showLoading();

