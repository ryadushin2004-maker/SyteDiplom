/* ============================================================
   ДАННЫЕ ТОВАРОВ + КОРЗИНА
   ============================================================ */
let PRODUCTS = [];
let CART = [];                     // локальная корзина

async function loadProducts() {
  try {
    const res = await fetch("http://localhost:3000/products");
    PRODUCTS = await res.json();
    renderCatalog(PRODUCTS);
  } catch (err) {
    console.error("Не удалось загрузить товары:", err);
    // fallback на демо-товары, если сервер не ответил
  }
}

function renderCatalog(products) {
  const grid = document.getElementById('catalog-grid');
  grid.innerHTML = products.map(p => `
    <div class="product-card" data-category="${p.category}" data-name="${p.name}" data-article="${p.article}">
      <div class="product-img-wrap">
        <div class="product-img-placeholder">
          ${p.image ? `<img src="${p.image}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;">` : `<i class="fa-solid ${p.icon || 'fa-box'}"></i>`}
        </div>
      </div>
      <div class="product-info">
        <span class="product-category">${p.category}</span>
        <h3 class="product-name">${p.name}</h3>
        <p class="product-desc">${p.description || ''}</p>
        <div class="product-article">Арт.: ${p.article}</div>
        <div class="product-footer">
          <span class="product-price">${Number(p.price || 0).toLocaleString('ru-RU')} ₽</span>
          <button class="btn-order" onclick="addToCart(this, '${p.name.replace(/'/g, "\\'")}', ${p.id})">
            <i class="fa-solid fa-cart-plus"></i> В корзину
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

/* ============================================================
   АВТОРИЗАЦИЯ (ИСПРАВЛЕНА)
   ============================================================ */
async function handleLogin(event) {
  event.preventDefault();   // ← обязательно, чтобы не перезагружалась страница

  const login = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errBlock = document.getElementById('auth-error');

  try {
    const response = await fetch("http://localhost:3000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password })
    });

    const data = await response.json();

    if (data.result === "SUCCESS") {
      localStorage.setItem("userId", data.id);
      localStorage.setItem("login", login);
      window.currentUserId = data.id;
      errBlock.classList.add('hidden');

      document.getElementById('header-username').textContent = login;

      document.getElementById('auth-screen').classList.remove('active');
      document.getElementById('app-screen').classList.add('active');

      loadProducts();
      loadOrders();
      loadProfile();
      showToast(`Добро пожаловать, ${login}!`);
    } else {
      errBlock.classList.remove('hidden');
    }
  } catch (err) {
    console.error(err);
    showToast("Ошибка соединения с сервером", true);
  }
}

async function handleRegister(event) {
  event.preventDefault();

  const login    = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-password-confirm').value;

  const errBox  = document.getElementById('reg-error');
  const errText = document.getElementById('reg-error-text');

  // ── Валидация на клиенте ──
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login)) {
    errText.textContent = 'Введите корректный email';
    errBox.classList.remove('hidden'); return;
  }
  if (login.length > 100) {
    errText.textContent = 'Email слишком длинный';
    errBox.classList.remove('hidden'); return;
  }
  if (password !== confirm) {
    errText.textContent = 'Пароли не совпадают';
    errBox.classList.remove('hidden'); return;
  }

  errBox.classList.add('hidden');

  try {
    const response = await fetch("http://localhost:3000/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password })
    });

    const result = await response.text();

    if (result === "OK") {
      showToast('Аккаунт создан! Выполняем вход...');

      // Автоматический вход после регистрации
      const loginResp = await fetch("http://localhost:3000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password })
      });
      const loginData = await loginResp.json();

      if (loginData.result === "SUCCESS") {
        localStorage.setItem("userId", loginData.id);
        localStorage.setItem("login", login);
        window.currentUserId = loginData.id;
        document.getElementById('header-username').textContent = login;
        document.getElementById('auth-screen').classList.remove('active');
        document.getElementById('app-screen').classList.add('active');
        loadProducts();
        loadOrders();
      }
    } else if (result === "EXISTS") {
      errText.textContent = 'Пользователь с таким логином уже существует';
      errBox.classList.remove('hidden');
    } else if (result === "LIMIT") {
      errText.textContent = 'Слишком много попыток. Подождите 15 минут';
      errBox.classList.remove('hidden');
    } else {
      // Сервер вернул текст ошибки валидации (400) или другое
      errText.textContent = result || 'Ошибка сервера';
      errBox.classList.remove('hidden');
    }
  } catch (err) {
    console.error(err);
    errText.textContent = 'Нет соединения с сервером';
    errBox.classList.remove('hidden');
  }
}

// ========== ВЫХОД ============
function logout() {
  localStorage.removeItem("userId");
  localStorage.removeItem("login");

  location.reload();
}
/* ============================================================
   КОРЗИНА
   ============================================================ */
function addToCart(btn, productName, productId) {
  if (!window.currentUserId) {
    showToast('Войдите в аккаунт для добавления в корзину', true);
    return;
  }

  if (CART.find(item => item.id === productId)) {
    showToast('Товар уже в корзине', true);
    return;
  }

  const product = PRODUCTS.find(p => p.id === productId);
  if (product) {
  CART.push({
    id: product.id,
    name: product.name,
    price: Number(product.price),
    quantity: 1
  });
}

  btn.innerHTML = '<i class="fa-solid fa-check"></i> В корзине';
  btn.disabled = true;
  showToast(`«${productName}» добавлен в корзину`);
  loadOrders();

}

function removeFromCart(productId) {
  CART = CART.filter(item => item.id !== productId);
}


// ======= Заказ =======
async function checkoutCart() {
  if (CART.length === 0 || !window.currentUserId) return;

  await fetch("http://localhost:3000/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: window.currentUserId,
      items: CART
    })
  });

  showToast(`Заказ оформлен!`);
  CART = [];
  loadOrders();
}

/* ============================================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ============================================================ */
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = message;
  toast.style.background = isError ? '#cc0000' : '#1a2332';
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ========= ПОКАЗ/СКРЫТИЕ ПАРОЛЯ =========
function togglePassword() {
  const input = document.getElementById('password');
  const icon  = document.getElementById('eye-icon');
  if (!input || !icon) return;
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fa-solid fa-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'fa-solid fa-eye';
  }
}

function togglePassField(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon  = document.getElementById(iconId);
  if (!input || !icon) return;
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fa-solid fa-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'fa-solid fa-eye';
  }
}

function switchAuthTab(tab) {
  const loginPanel = document.getElementById('auth-panel-login');
  const regPanel   = document.getElementById('auth-panel-register');
  const loginBtn   = document.getElementById('tab-login-btn');
  const regBtn     = document.getElementById('tab-register-btn');

  if (tab === 'login') {
    loginPanel.style.display = '';
    regPanel.style.display = 'none';
    loginBtn.classList.add('active');
    regBtn.classList.remove('active');
  } else {
    loginPanel.style.display = 'none';
    regPanel.style.display = '';
    loginBtn.classList.remove('active');
    regBtn.classList.add('active');
  }
}

/* ============================================================
   ИНИЦИАЛИЗАЦИЯ
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {
  const savedId = localStorage.getItem("userId");
  const savedLogin = localStorage.getItem("login");

  if (savedId) {
    window.currentUserId = Number(savedId);

    document.getElementById('header-username').textContent = savedLogin;
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('app-screen').classList.add('active');

    loadProducts();
    loadOrders();
    loadProfile();
    switchAuthTab('login');
  }
});

// ================= НАВИГАЦИЯ =================
function showTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.remove('active');
  });

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  const tab = document.getElementById('tab-' + tabName);
  if (tab) tab.classList.add('active');

  const btn = document.getElementById('nav-' + tabName);
  if (btn) btn.classList.add('active');

  if (tabName === 'orders')  loadOrders();
  if (tabName === 'profile') loadProfile();
}

// ================= ФИЛЬТРАЦИЯ =================

function filterCatalog(category, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  document.querySelectorAll('.product-card').forEach(card => {
    if (category === 'all' || card.dataset.category === category) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
}

// ============= ЗАКАЗЫ ==========
async function loadOrders() {
  if (!window.currentUserId) return;

  try {
    const res = await fetch(`http://localhost:3000/orders/${window.currentUserId}`);

    if (!res.ok) {
      throw new Error("Ошибка сервера");
    }

    const data = await res.json();
    renderOrders(data);
    updateOrderStats(data);

  } catch (err) {
  console.error(err);

  if (document.getElementById('tab-orders')?.classList.contains('active')) {
    showToast("Ошибка при загрузке заказов", true);
  }
}
}

function renderOrders(orders) {
  const tbody = document.getElementById('orders-tbody');
  if (!tbody) return;

  // 🔥 ЕСЛИ ЕСТЬ КОРЗИНА — ПОКАЗЫВАЕМ ЕЁ
  if (CART.length > 0) {
    let total = 0;

    tbody.innerHTML = CART.map((item, index) => {
      total += Number(item.price || 0);

      return `
        <tr>
          <td><strong>#${index + 1}</strong></td>
          <td>${item.name}</td>
          <td>—</td>
          <td><span class="status-badge status-ready">В корзине</span></td>
          <td>${Number(item.price).toLocaleString('ru-RU')} ₽</td>
        </tr>
      `;
    }).join('') + `
      <tr style="background:#e6f2ff;font-weight:700;">
        <td colspan="4" style="text-align:right;">Итого:</td>
        <td>${total.toLocaleString('ru-RU')} ₽</td>
      </tr>
      <tr>
        <td colspan="5" style="text-align:center;">
          <button onclick="checkoutCart()" class="btn-primary">
            Оформить заказ
          </button>
        </td>
      </tr>
    `;

    return;
  }

  // 🔽 ЕСЛИ КОРЗИНЫ НЕТ — ПОКАЗЫВАЕМ ЗАКАЗЫ

  if (!orders || orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; color:#6b7a8d; padding:32px;">
          <i class="fa-solid fa-box-open"></i><br>
          У вас пока нет заказов
        </td>
      </tr>`;
    return;
  }

  const statusClass = {
    'Создан': 'status-ready',
    'В пути': 'status-transit',
    'Готов к выдаче': 'status-ready',
    'Выдан': 'status-done'
  };

  tbody.innerHTML = orders.map((o, index) => {
    const itemsList = o.items?.map(i => i.name).join(", ") || "—";
    const date = new Date(o.created_at).toLocaleDateString('ru-RU');
    const cls = statusClass[o.status] || 'status-transit';
    const total = Number(o.total_price || 0).toLocaleString('ru-RU');

    return `
      <tr>
	<td><strong>#${index + 1}</strong></td>
        <td>${itemsList}</td>
        <td>${date}</td>
        <td><span class="status-badge ${cls}">${o.status}</span></td>
        <td><strong>${total} ₽</strong></td>
      </tr>`;
  }).join('');
}

function updateOrderStats(orders) {
  const elReady   = document.getElementById('stat-ready');
  const elTransit = document.getElementById('stat-transit');
  const elDone    = document.getElementById('stat-done');

  if (!elReady || !elTransit || !elDone) return;

  const ready   = orders.filter(o => o.status === 'Готов к выдаче' || o.status === 'Создан').length;
  const transit = orders.filter(o => o.status === 'В пути').length;
  const done    = orders.filter(o => o.status === 'Выдан').length;

  elReady.textContent   = ready;
  elTransit.textContent = transit;
  elDone.textContent    = done;
}

// ============ ЛИЧНЫЙ КАБИНЕТ ===========

async function loadProfile() {
  if (!window.currentUserId) return;
  try {
    const res  = await fetch(`http://localhost:3000/profile/${window.currentUserId}`);
    if (!res.ok) return;
    const data = await res.json();
    renderProfile(data);
  } catch (err) {
    console.error("Ошибка загрузки профиля:", err);
  }
}

function renderProfile(data) {
  const fullName = [
    data.lastname,
    data.firstname,
    data.middlename
  ].filter(Boolean).join(' ');

  document.getElementById('profile-name').textContent  = fullName || '—';
  document.getElementById('profile-email').textContent = data.login || '—';     // login = email
  document.getElementById('profile-phone').textContent = data.phone  || '—';
  document.getElementById('profile-max').textContent   = data.max_id || '—';

  // Заполняем поля формы редактирования (чтобы при повторном открытии были актуальные данные)
  document.getElementById('edit-lastname').value   = data.lastname   || '';
  document.getElementById('edit-firstname').value  = data.firstname  || '';
  document.getElementById('edit-middlename').value = data.middlename || '';
  document.getElementById('edit-phone').value      = data.phone      || '';
  document.getElementById('edit-max').value        = data.max_id     || '';
}

function toggleEditProfile() {
  const sec = document.getElementById('edit-profile-section');
  sec.style.display = sec.style.display === 'none' ? 'block' : 'none';
}

async function saveProfile() {
  const lastname   = document.getElementById('edit-lastname').value.trim();
  const firstname  = document.getElementById('edit-firstname').value.trim();
  const middlename = document.getElementById('edit-middlename').value.trim();
  const phone      = document.getElementById('edit-phone').value.trim();
  const max_id     = document.getElementById('edit-max').value.trim();

  if (!firstname || !lastname) {
    showToast('Введите имя и фамилию', true);
    return;
  }

  try {
    const res = await fetch(`http://localhost:3000/profile/${window.currentUserId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        lastname, 
        firstname, 
        middlename, 
        phone, 
        max_id 
      })
    });

    if (res.ok) {
      showToast('Профиль успешно сохранён');
      toggleEditProfile();     // закрываем форму редактирования
      await loadProfile();     // ← сразу обновляем данные на странице
    } else {
      const text = await res.text();
      showToast(text || 'Ошибка при сохранении', true);
    }
  } catch (err) {
    console.error(err);
    showToast('Нет соединения с сервером', true);
  }
}

async function changePassword() {
  const cur      = document.getElementById('cur-pass').value;
  const newPass  = document.getElementById('new-pass').value;
  const confPass = document.getElementById('conf-pass').value;
  const errBox   = document.getElementById('pass-error');
  const errText  = document.getElementById('pass-error-text');

  const showErr = (msg) => {
    errText.textContent = msg;
    errBox.classList.remove('hidden');
  };

  errBox.classList.add('hidden');

  if (!cur || !newPass || !confPass) {
    showErr('Заполните все поля'); return;
  }
  if (newPass.length < 4) {
    showErr('Новый пароль должен быть не менее 4 символов'); return;
  }
  if (newPass !== confPass) {
    showErr('Новые пароли не совпадают'); return;
  }

  try {
    const res = await fetch(`http://localhost:3000/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id:      window.currentUserId,
        old_password: cur,
        new_password: newPass
      })
    });

    const result = await res.text();

    if (result === 'OK') {
      document.getElementById('cur-pass').value  = '';
      document.getElementById('new-pass').value  = '';
      document.getElementById('conf-pass').value = '';
      showToast('Пароль успешно обновлён');
    } else if (result === 'WRONG') {
      showErr('Текущий пароль введён неверно');
    } else {
      showErr('Ошибка сервера');
    }
  } catch (err) {
    console.error(err);
    showErr('Нет соединения с сервером');
  }
}

// ============ БОКОВОЕ МЕНЮ ===========
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  sidebar.classList.toggle('open');
  overlay.classList.toggle('show');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
}

// ========= СТРОКА ПОИСКА ===========
function handleSearch(value) {
  const box       = document.getElementById('search-suggestions');
  const clearBtn  = document.getElementById('clear-search-btn');
  const search    = value.toLowerCase().trim();

  if (clearBtn) clearBtn.style.display = value ? 'flex' : 'none';

  if (!value) {
    box.innerHTML = '';
    box.style.display = 'none';
    renderCatalog(PRODUCTS); // восстанавливаем полный каталог
    return;
  }

  const filtered = PRODUCTS.filter(p =>
    (p.name    && p.name.toLowerCase().includes(search)) ||
    (p.article && String(p.article).toLowerCase().includes(search))
  );

  if (filtered.length === 0) {
    box.innerHTML = "<div class='suggest-item'>Ничего не найдено</div>";
    box.style.display = 'block';
    return;
  }

  box.innerHTML = filtered.map(p => `
    <div class="suggest-item" onclick="selectProduct(${p.id})">
      <strong>${p.name}</strong><br>
      <small>Арт.: ${p.article}</small>
    </div>
  `).join('');

  box.style.display = 'block';
}

function clearSearch() {
  const input    = document.getElementById('search-input');
  const box      = document.getElementById('search-suggestions');
  const clearBtn = document.getElementById('clear-search-btn');
  if (input)    input.value = '';
  if (box)      { box.innerHTML = ''; box.style.display = 'none'; }
  if (clearBtn) clearBtn.style.display = 'none';
  renderCatalog(PRODUCTS);
}

function selectProduct(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;


  const box = document.getElementById('search-suggestions');
  if (box) { box.innerHTML = ''; box.style.display = 'none'; }

  // Подсвечиваем карточку в каталоге
  renderCatalog(PRODUCTS);
  setTimeout(() => {
    const cards = document.querySelectorAll('.product-card');
    for (const card of cards) {
      if (card.dataset.article === product.article) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.outline = '3px solid #0080ff';
        setTimeout(() => { card.style.outline = ''; }, 2000);
        break;
      }
    }
  }, 100);
}

function phoneMask(input) {
  let val = input.value.replace(/\D/g, ''); // только цифры

  if (val.length > 11) val = val.slice(0, 11);

  let formatted = '+7';
  if (val.length > 1) formatted += ' (' + val.slice(1, 4);
  if (val.length > 4) formatted += ') ' + val.slice(4, 7);
  if (val.length > 7) formatted += '-' + val.slice(7, 9);
  if (val.length > 9) formatted += '-' + val.slice(9, 11);

  input.value = formatted;
}