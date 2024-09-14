Сервис истории действий
Этот репозиторий содержит код для сервиса, который позволяет сохранять и получать информацию об истории действий с товарами.
Описание сервиса
Сервис предоставляет два основных API:
GET /actions: Возвращает список действий по заданным фильтрам (shopId, plu, date, action, limit, offset).
POST /actions: Добавляет новое действие в историю.
Зависимости
express: фреймворк для создания веб-приложений.
pg: драйвер для PostgreSQL.
typescript: язык программирования, используемый для разработки.
Настройка
Установите зависимости:
npm install

Создайте базу данных PostgreSQL (если она не была создана в сервесе product-service):
В конфигурации pool в файле action.js измените данные подключения к базе данных (имя пользователя, пароль, имя базы данных).
Создайте базу данных с указанным именем.
Создайте таблицу actions:
CREATE TABLE actions (
    id SERIAL PRIMARY KEY,
    action VARCHAR(255) NOT NULL,
    plu VARCHAR(255) NOT NULL,
    shop_id INT NOT NULL,
    date DATE NOT NULL,
    quantity INT NOT NULL
);

Запустите сервер: npm run start
Запустите сервер для разработки: npm run dev

Использование
Получение истории действий
Запрос:
GET /actions?shopId=1&plu=12345678&date=2023-10-26&action=sale&limit=10&offset=0

Добавление нового действия
Запрос:
POST /actions
Тело запроса:
{
  "action": "sale",
  "plu": "12345678",
  "shop_id": 1,
  "date": "2023-10-27",
  "quantity": 1
}

