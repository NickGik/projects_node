var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
define("action", ["require", "exports", "express", "pg"], function (require, exports, express_1, pg_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    express_1 = __importDefault(express_1);
    // Настройки подключения к базе данных PostgreSQL
    const pool = new pg_1.Pool({
        user: 'postgres',
        host: 'localhost',
        database: 'products',
        password: '9999',
        port: 5432,
    });
    // Создание Express приложения
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    // Endpoint для получения истории действий по фильтрам
    app.get('/actions', async (req, res) => {
        try {
            const { shopId, plu, date, action, limit, offset } = req.query;
            // Приведение типов
            const shopIdNum = typeof shopId === 'string' ? parseInt(shopId, 10) : undefined;
            const pluStr = typeof plu === 'string' ? plu : undefined;
            const dateStr = typeof date === 'string' ? date : undefined;
            const actionStr = typeof action === 'string' ? action : undefined;
            const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : undefined;
            const offsetNum = typeof offset === 'string' ? parseInt(offset, 10) : undefined;
            let query = 'SELECT * FROM actions';
            const params = [];
            if (shopIdNum) {
                query += ' WHERE shop_id = $1';
                params.push(shopIdNum.toString());
            }
            if (pluStr) {
                if (params.length > 0) {
                    query += ' AND plu = $2';
                }
                else {
                    query += ' WHERE plu = $1';
                }
                params.push(pluStr);
            }
            if (dateStr) {
                if (params.length > 0) {
                    query += ' AND date = $3';
                }
                else {
                    query += ' WHERE date = $1';
                }
                params.push(dateStr);
            }
            if (actionStr) {
                if (params.length > 0) {
                    query += ' AND action = $4';
                }
                else {
                    query += ' WHERE action = $1';
                }
                params.push(actionStr);
            }
            if (limitNum) {
                query += ` LIMIT ${limitNum}`;
            }
            if (offsetNum) {
                query += ` OFFSET ${offsetNum}`;
            }
            const result = await pool.query(query, params);
            res.json(result.rows);
        }
        catch (error) {
            if (error instanceof Error) {
                res.status(500).json({ error: error.message });
            }
            else {
                res.status(500).json({ error: 'Неизвестная ошибка' });
            }
        }
    });
    // Endpoint для сохранения истории действий
    app.post('/actions', async (req, res) => {
        try {
            const { action, plu, shop_id, date, quantity } = req.body;
            const result = await pool.query('INSERT INTO actions (action, plu, shop_id, date, quantity) VALUES ($1, $2, $3, $4, $5) RETURNING *', [action, plu, shop_id, date, quantity]);
            res.status(201).json(result.rows[0]);
        }
        catch (error) {
            if (error instanceof Error) {
                res.status(500).json({ error: error.message });
            }
            else {
                res.status(500).json({ error: 'Неизвестная ошибка' });
            }
        }
    });
    // Запуск сервера
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
        console.log(`Сервер истории действий запущен на порту ${PORT}`);
    });
});
//# sourceMappingURL=action.js.map