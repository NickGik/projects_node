Сервис остатков товаров
Этот проект представляет собой REST API сервис, который управляет остатками товаров в базе данных PostgreSQL. Сервис предоставляет функционал для создания товаров, управления остатками (создание, увеличение, уменьшение) и получения информации о товарах и остатках по фильтрам.
Функционал:
Создание товаров: Позволяет создавать новые товары с уникальным кодом (PLU) и названием.
Управление остатками: Позволяет создавать новые остатки для товаров в разных магазинах, увеличивать и уменьшать количество товара на полке.
Получение информации: Предоставляет возможность получения информации о товарах и остатках по различным фильтрам (по имени, PLU, магазину, количеству).
Логирование действий: Записывает все изменения в остатках в таблицу actions, чтобы отслеживать историю изменений.
Технологии:
Express.js: Фреймворк для создания веб-приложений Node.js.
pg: Библиотека для работы с PostgreSQL.
axios: Библиотека для отправки HTTP-запросов.
Настройка:
Убедитесь, что установлена база данных PostgreSQL.
Создайте базу данных products с двумя таблицами:
products: хранит информацию о товарах.
stocks: хранит информацию об остатках товаров.
actions: хранит информацию о всех изменениях в остатках.
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    plu VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE stocks (
    id SERIAL PRIMARY KEY,
    plu VARCHAR(255) NOT NULL,
    shop_id INT NOT NULL,
    shelf_quantity INT NOT NULL,
    order_quantity INT NOT NULL,
    FOREIGN KEY (plu) REFERENCES products(plu)
);

CREATE TABLE actions (
    id SERIAL PRIMARY KEY,
    action VARCHAR(255) NOT NULL,
    plu VARCHAR(255) NOT NULL,
    shop_id INT NOT NULL,
    date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    quantity INT,
    FOREIGN KEY (plu) REFERENCES products(plu)
);

Установите зависимости: npm install
Запустите сервис: npm run start
Запустите в режиме разработчика: npm run dev


Endpoints:
Товары:
POST /products: Создание нового товара.
GET /products: Получение товаров по фильтрам.
Остатки:
POST /stocks: Создание нового остатка.
GET /stocks: Получение остатков по фильтрам.
PUT /stocks/:plu/:shopId/increase: Увеличение количества товара на полке.
PUT /stocks/:plu/:shopId/decrease: Уменьшение количества товара на полке.
Сервис истории действий:
Сервис записывает информацию о всех изменениях в остатках в таблицу actions. Вы можете получить доступ к этим данным с помощью запросов к таблице.
Пример запросов:
Создание товара:

POST /products
{
  "name": "Название товара",
  "plu": "Код товара"
}

Получение товара по PLU:
GET /products?plu=Код товара

Создание остатка:
POST /stocks
{
  "plu": "Код товара",
  "shopId": "ID магазина",
  "shelfQuantity": "Количество на полке",
  "orderQuantity": "Количество в заказе"
}

Получение остатков по магазину:
GET /stocks?shopId=ID магазина

Увеличение количества товара на полке:
PUT /stocks/Код товара/ID магазина/increase
{
  "quantity": "Количество для увеличения"
}

Получение истории действий:
SELECT * FROM actions WHERE plu = 'Код товара';