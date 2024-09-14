const express = require('express');
const { Pool } = require('pg');
const axios = require('axios');

// Настройки подключения к базе данных PostgreSQL
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'products',
  password: '9999',
  port: 5432,
});

// Создание Express приложения
const app = express();

// Парсим JSON-данные из тела запроса
app.use(express.json()); 

// Адрес сервиса истории действий
const actionServiceUrl = 'http://localhost:4000';

// Обработчик ошибок
const handleError = (res, error) => {
  console.error('Error:', error); // Более подробное сообщение об ошибке
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
};

// Endpoint для создания товара
app.post('/products', async (req, res) => {
  try {
    const { name, plu } = req.body;
    const result = await pool.query('INSERT INTO products (name, plu) VALUES ($1, $2) RETURNING *', [name, plu]);
    const product = result.rows[0];

    // Создаем остаток для нового товара
    await pool.query('INSERT INTO stocks (plu, shop_id, shelf_quantity, order_quantity) VALUES ($1, $2, $3, $4)', [product.plu, 1, 0, 0]);

    // Отправляем событие о создании товара в сервис истории действий
    await axios.post(`${actionServiceUrl}/actions`, {
      action: 'CREATE_PRODUCT',
      plu: product.plu,
      shop_id: 1,
      date: new Date(),
    });

    res.status(201).json(product);
  } catch (error) {
    handleError(res, error);
  }
});

// Endpoint для создания остатка
app.post('/stocks', async (req, res) => {
  try {
    const { plu, shopId, shelfQuantity, orderQuantity } = req.body;
    const result = await pool.query('INSERT INTO stocks (plu, shop_id, shelf_quantity, order_quantity) VALUES ($1, $2, $3, $4) RETURNING *', [plu, shopId, shelfQuantity, orderQuantity]);
    const stock = result.rows[0];

    // Отправляем событие о создании остатка в сервис истории действий
    await axios.post(`${actionServiceUrl}/actions`, {
      action: 'CREATE_STOCK',
      plu: stock.plu,
      shop_id: stock.shop_id,
      date: new Date(),
    });

    res.status(201).json(stock);
  } catch (error) {
    handleError(res, error);
  }
});

// Endpoint для увеличения остатка
app.put('/stocks/:plu/:shopId/increase', async (req, res) => {
  try {
    const { plu, shopId } = req.params;
    const { quantity } = req.body;
    const result = await pool.query('UPDATE stocks SET shelf_quantity = shelf_quantity + $1 WHERE plu = $2 AND shop_id = $3 RETURNING *', [quantity, plu, shopId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Остаток не найден' });
    }
    const stock = result.rows[0];

    // Отправляем событие об увеличении остатка в сервис истории действий
    await axios.post(`${actionServiceUrl}/actions`, {
      action: 'INCREASE_STOCK',
      plu: stock.plu,
      shop_id: stock.shop_id,
      date: new Date(),
      quantity: quantity,
    });

    res.json(stock);
  } catch (error) {
    handleError(res, error);
  }
});

// Endpoint для уменьшения остатка
app.put('/stocks/:plu/:shopId/decrease', async (req, res) => {
  try {
    const { plu, shopId } = req.params;
    const { quantity } = req.body;
    const result = await pool.query('UPDATE stocks SET shelf_quantity = shelf_quantity - $1 WHERE plu = $2 AND shop_id = $3 RETURNING *', [quantity, plu, shopId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Остаток не найден' });
    }
    const stock = result.rows[0];

    // Отправляем событие об уменьшении остатка в сервис истории действий
    await axios.post(`${actionServiceUrl}/actions`, {
      action: 'DECREASE_STOCK',
      plu: stock.plu,
      shop_id: stock.shop_id,
      date: new Date(),
      quantity: quantity,
    });

    res.json(stock);
  } catch (error) {
    handleError(res, error);
  }
});

// Endpoint для получения остатков по фильтрам
app.get('/stocks', async (req, res) => {
  try {
    const { plu, shopId, shelfQuantity, orderQuantity, limit, offset } = req.query;
    let query = 'SELECT * FROM stocks';
    const params = [];

    if (plu) {
      query += ' WHERE plu = $1';
      params.push(plu);
    }

    if (shopId) {
      if (params.length > 0) {
        query += ' AND shop_id = $2';
      } else {
        query += ' WHERE shop_id = $1';
      }
      params.push(shopId);
    }

    if (shelfQuantity) {
      if (params.length > 0) {
        query += ' AND shelf_quantity = $3';
      } else {
        query += ' WHERE shelf_quantity = $1';
      }
      params.push(shelfQuantity);
    }

    if (orderQuantity) {
      if (params.length > 0) {
        query += ' AND order_quantity = $4';
      } else {
        query += ' WHERE order_quantity = $1';
      }
      params.push(orderQuantity);
    }

    if (limit) {
      query += ` LIMIT ${limit}`;
    }

    if (offset) {
      query += ` OFFSET ${offset}`;
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    handleError(res, error);
  }
});

// Endpoint для получения товаров по фильтрам
app.get('/products', async (req, res) => {
  try {
    const { name, plu, limit, offset } = req.query;
    let query = 'SELECT * FROM products';
    const params = [];

    if (name) {
      query += ' WHERE name = $1';
      params.push(name);
    }

    if (plu) {
      if (params.length > 0) {
        query += ' AND plu = $2';
      } else {
        query += ' WHERE plu = $1';
      }
      params.push(plu);
    }

    if (limit) {
      query += ` LIMIT ${limit}`;
    }

    if (offset) {
      query += ` OFFSET ${offset}`;
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    handleError(res, error);
  }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
