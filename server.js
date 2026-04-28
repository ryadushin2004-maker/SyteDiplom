const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const bcrypt = require("bcrypt");
const rateLimit = require('express-rate-limit');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const pool = new Pool({
  user: "ryadushin_ai",
  host: "5942e-rw.db.pub.dbaas.postgrespro.ru",
  database: "dbdiploma",
  password: "P4m4Q#$#$2%",
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

// Проверка подключения к БД
pool.connect((err, client, release) => {
  if (err) {
    return console.error("Ошибка подключения к БД:", err.stack);
  }
  console.log("Подключение к БД успешно");
  release();
});

// Защита от перебора паролей

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 10,                   // максимум 10 попыток
  message: "LIMIT",
  standardHeaders: true,
  legacyHeaders: false,
});


// ================= РЕГИСТРАЦИЯ =================
app.post("/register", authLimiter, async (req, res) => {
  const { login, password } = req.body;
  console.log("[REGISTER] login:", login);
  
  console.log("REGISTER:", login);

  if (!login || !password) {
    return res.status(400).send("Ошибка");
  }
if (login.length < 3 || login.length > 50) {
  return res.status(400).send("Логин должен быть от 3 до 50 символов");
}
if (password.length < 4 || password.length > 100) {
  return res.status(400).send("Пароль должен быть от 4 до 100 символов");
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login)) {
  return res.status(400).send("Введите корректный email");
}

  try {
    // Проверяем, существует ли уже такой логин
    const existing = await pool.query(
      'SELECT id FROM ryadushin_ai.users WHERE login=$1',
      [login]
    );
    if (existing.rows.length > 0) {
      return res.send("EXISTS");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO ryadushin_ai.users (login, password) VALUES ($1, $2)',
      [login, hashedPassword]
    );

    res.send("OK");
}
  catch (err) {
  console.error("REGISTER ERROR:", err);
  res.status(500).send("Ошибка");
}
});


// ================= АВТОРИЗАЦИЯ =================
app.post("/login", authLimiter, async (req, res) => {
  const { login, password } = req.body;
  console.log("[LOGIN] login:", login);
  

  try {
    const result = await pool.query(
      'SELECT * FROM ryadushin_ai.users WHERE login=$1',
      [login]
    );

    if (result.rows.length === 0) {
      return res.send("FAIL");
    }

    const user = result.rows[0];

    // Сравниваем пароль с хэшем
    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      res.json({ result: "SUCCESS", id: user.id });
    } else {
      res.json({ result: "FAIL" });
    }

  } catch (err) {
    console.error("Ошибка логина:", err);
    res.status(500).send("Ошибка сервера");
  }
});

// ================= ТОВАРЫ =================
app.get("/products", async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM ryadushin_ai.products ORDER BY id'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Ошибка");
  }
});

app.post("/create-order", async (req, res) => {
  const { user_id, items } = req.body;

  try {
    let total = 0;

    // создаем заказ (пока без суммы)
    const orderResult = await pool.query(
      `INSERT INTO ryadushin_ai.orders (user_id, total_price) 
       VALUES ($1, 0) RETURNING id`,
      [user_id]
    );

    const orderId = orderResult.rows[0].id;

    // проходимся по товарам
    for (const item of items) {

      // 🔹 получаем актуальную цену из БД (а не с клиента!)
      const productResult = await pool.query(
        `SELECT price FROM ryadushin_ai.products WHERE id = $1`,
        [item.id]
      );

      if (productResult.rows.length === 0) {
        continue;
      }

      const price = Number(productResult.rows[0].price);
      const quantity = Number(item.quantity || 1);

      total += price * quantity;

      // сохраняем цену в момент заказа
      await pool.query(
        `INSERT INTO ryadushin_ai.order_items 
         (order_id, product_id, price, quantity)
         VALUES ($1, $2, $3, $4)`,
        [orderId, item.id, price, quantity]
      );
    }

    // обновляем итоговую сумму заказа
    await pool.query(
      `UPDATE ryadushin_ai.orders SET total_price = $1 WHERE id = $2`,
      [total, orderId]
    );

    res.json({ result: "OK", order_id: orderId });

  } catch (err) {
    if (!items || items.length === 0) {
  return res.status(400).send("EMPTY_CART");
}
    console.error("CREATE ORDER ERROR:", err);
    res.status(500).send("Ошибка");
  }
});

// ================= ЗАКАЗЫ ПОЛЬЗОВАТЕЛЯ =================
app.get("/orders/:user_id", async (req, res) => {
  const { user_id } = req.params;

  try {
    const result = await pool.query(
  `SELECT o.id as order_id, o.status, o.created_at, o.total_price,
          p.id as product_id, p.name,
          oi.price, oi.quantity
   FROM ryadushin_ai.orders o
   JOIN ryadushin_ai.order_items oi ON oi.order_id = o.id
   JOIN ryadushin_ai.products p ON p.id = oi.product_id
   WHERE o.user_id = $1
   ORDER BY o.created_at DESC`,
  [user_id]
);

    const grouped = {};

    result.rows.forEach(row => {
      if (!grouped[row.order_id]) {
        grouped[row.order_id] = {
          id: row.order_id,
          status: row.status,
          created_at: row.created_at,
	  total_price: row.total_price,
          items: []
        };
      }

      grouped[row.order_id].items.push({
  	id: row.product_id,
  	name: row.name,
  	price: row.price,
  	quantity: row.quantity
});
    });

    res.json(Object.values(grouped));

  } catch (err) {
    console.error("ORDERS ERROR:", err);
    res.status(500).send("Ошибка");
  }
});


// Получить товар по артикулу или названию (API)
app.get("/product", async (req, res) => {
  const { article, name } = req.query;

  try {
    let result;

    if (article) {
      result = await pool.query(
        `SELECT * FROM ryadushin_ai.products WHERE article = $1 LIMIT 1`,
        [article]
      );
    } else if (name) {
      result = await pool.query(
        `SELECT * FROM ryadushin_ai.products WHERE name ILIKE $1 LIMIT 1`,
        [`%${name}%`]
      );
    } else {
      return res.status(400).send("Нет параметров");
    }

    if (result.rows.length === 0) {
      return res.send(null);
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error("PRODUCT ERROR:", err);
    res.status(500).send("Ошибка");
  }
});


// ================= ЗАКАЗ ПОД 1С =================

app.get("/orders", async (req, res) => {
  try {
    const result = await pool.query(
  `SELECT 
    o.id as order_id,
    o.status,
    o.created_at,

    u.id as user_id,
    u.login,
    u.phone,
    u.max_id,

    CONCAT(u.lastname, ' ', u.firstname, ' ', COALESCE(u.middlename, '')) as full_name,

    p.article,
    p.name,

    oi.quantity,
    oi.price

FROM ryadushin_ai.orders o
JOIN ryadushin_ai.users u ON u.id = o.user_id
JOIN ryadushin_ai.order_items oi ON oi.order_id = o.id
JOIN ryadushin_ai.products p ON p.id = oi.product_id

ORDER BY o.created_at DESC`
);

    const grouped = {};

    result.rows.forEach(row => {
      if (!grouped[row.order_id]) {
        grouped[row.order_id] = {
          id: row.order_id,
          status: row.status,
          created_at: row.created_at,
	  user: {
  id: row.user_id,
  name: row.full_name,
  email: row.login,
  phone: row.phone,
  max_id: row.max_id
},
          items: []
        };
      }

      grouped[row.order_id].items.push({
        article: row.article,
        name: row.name,
        quantity: row.quantity,
        price: row.price
      });
    });

    res.json(Object.values(grouped));

  } catch (err) {
    console.error("ORDERS ERROR:", err);
    res.status(500).send("Ошибка");
  }
});

// ================= ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ =================
app.get("/profile/:user_id", async (req, res) => {
  const { user_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT login, firstname, lastname, middlename, phone, max_id
       FROM ryadushin_ai.users WHERE id = $1`,
      [user_id]
    );
    if (result.rows.length === 0) return res.status(404).send("NOT_FOUND");
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PROFILE GET ERROR:", err);
    res.status(500).send("Ошибка");
  }
});

// ================= ПРОФИЛЬ — СОХРАНЕНИЕ =================

app.put("/profile/:user_id", async (req, res) => {
  const { user_id } = req.params;
  const { lastname, firstname, middlename, phone, max_id } = req.body;

  // login (email) мы не обновляем через эту форму — он задаётся только при регистрации
  // Если хочешь дать возможность менять email — скажи, сделаем отдельно

  try {
    await pool.query(
      `UPDATE ryadushin_ai.users
       SET lastname   = $1,
           firstname  = $2,
           middlename = $3,
           phone      = $4,
           max_id     = $5
       WHERE id = $6`,
      [lastname, firstname, middlename, phone, max_id, user_id]
    );

    res.send("OK");
  } catch (err) {
    console.error("PROFILE PUT ERROR:", err);
    res.status(500).send("Ошибка сервера");
  }
});

// ================= СМЕНА ПАРОЛЯ =================
app.post("/change-password", async (req, res) => {
  const { user_id, old_password, new_password } = req.body;

  if (!user_id || !old_password || !new_password) {
    return res.status(400).send("Ошибка");
  }
  if (new_password.length < 4) {
    return res.status(400).send("Пароль слишком короткий");
  }

  try {
    const result = await pool.query(
      'SELECT password FROM ryadushin_ai.users WHERE id=$1',
      [user_id]
    );
    if (result.rows.length === 0) return res.status(404).send("NOT_FOUND");

    const isMatch = await bcrypt.compare(old_password, result.rows[0].password);
    if (!isMatch) return res.send("WRONG");

    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query(
      'UPDATE ryadushin_ai.users SET password=$1 WHERE id=$2',
      [hashed, user_id]
    );

    res.send("OK");
  } catch (err) {
    console.error("CHANGE PASSWORD ERROR:", err);
    res.status(500).send("Ошибка");
  }
});


// ================= СТАРТ СЕРВЕРА =================
app.listen(3000, () => {
  console.log("Server started on http://localhost:3000");
});