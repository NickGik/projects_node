
// Загрузка переменных окружения из файла .env
require('dotenv').config({ path: './.env' });

// Подключение необходимых модулей
const express = require("express");
const nunjucks = require("nunjucks");
const mongoose = require("mongoose");
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');
const http = require('http');
const PDFDocument = require('pdfkit');

const store = MongoStore.create({
  mongoUrl: process.env.MONGODB_URL,
  collectionName: 'sessions', // Имя коллекции для хранения сессий
});

// Подключение моделей
const User = require('./models/User');
const Note = require('./models/Note');

// Создание экземпляра Express приложения
const app = express();

// Создание HTTP сервера
const server = http.createServer(app);

// ======================= НАСТРОЙКА =======================

// Подключение к MongoDB
mongoose.connect(process.env.MONGODB_URL)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Failed to connect to MongoDB", err));

// Настройка Nunjucks шаблонизатора
nunjucks.configure("views", {
  autoescape: true, // Автоматическое экранирование HTML
  express: app, // Интеграция с Express
  tags: { // Настройка пользовательских тегов
    blockStart: '{%',
    blockEnd: '%}',
    variableStart: '{{',
    variableEnd: '}}',
    commentStart: '{#',
    commentEnd: '#}'
  }
});
app.set("view engine", "njk"); // Установка Nunjucks в качестве шаблонизатора
app.set('views', path.join(__dirname, 'views')); // Путь к папке с шаблонами

// Сервер статических файлов
app.use(express.static(path.join(__dirname, 'public')));

// Middleware для обработки CORS запросов
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*', // Разрешенные источники
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Разрешенные методы
  allowedHeaders: ['Content-Type', 'Authorization'], // Разрешенные заголовки
  credentials: true // Разрешить отправку куки
}));

// Middleware для парсинга куки
app.use(cookieParser(process.env.SESSION_SECRET));

// Middleware для парсинга JSON данных
app.use(express.json());

// Middleware для парсинга данных формы
app.use(express.urlencoded({ extended: true }));

// Настройка сессий
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET, // Секретный ключ для подписи сессий
  resave: false, // Не сохранять сессию, если она не была изменена
  saveUninitialized: false, // Не сохранять неинициализированные сессии
  store: store, // Хранение сессий в MongoDB
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // Время жизни куки (1 неделя)
    secure: process.env.NODE_ENV === 'production', // Использовать secure cookies в production
    httpOnly: true // Запретить доступ к куки через JavaScript
  }
});

app.use(sessionMiddleware);

// ======================= АУТЕНТИФИКАЦИЯ =======================

// Middleware для аутентификации JWT
const authenticateJWT = (req, res, next) => {
  const token = req.cookies.token; // Получение токена из куки

  if (token) {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
      if (err) {
        console.error("JWT Verification Error:", err); // Логирование ошибки
        return res.status(403).json({ message: 'Invalid token' });
      }
      req.user = user;
      console.log("Authenticated User:", req.user); // Логирование пользователя
      next();
    });
  } else {
    console.log("No token provided"); // Логирование отсутствия токена
    res.sendStatus(401); // Unauthorized
  }
};

// ======================= РОУТЫ =======================

// Главная страница
app.get('/', (req, res) => {
  res.render('index', { user: req.user }); // Рендеринг шаблона index.njk
});

// Страница /dashboard представляет из себя single page — клиентское приложение
app.get('/dashboard', authenticateJWT, (req, res) => {
  res.render('dashboard', { user: req.user });
});

// Авторизация
app.post('/login', async (req, res) => {
  const { username, password } = req.body; // Получение данных из тела запроса
  const user = await User.findOne({ username }); // Поиск пользователя в базе данных

  if (user && await user.comparePassword(password)) { // Проверка пароля
    const token = jwt.sign({ _id: user._id, username: user.username }, process.env.ACCESS_TOKEN_SECRET); // Генерация JWT токена
    req.session.user = user; // Сохранение информации о пользователе в сессии
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' }); // Установка куки с токеном
    res.redirect(302, '/dashboard'); // Рендеринг шаблона index.njk
  } else {
    res.redirect("/"); // Перенаправление на страницу dashboard, если авторизация не удалась
  }
});

// Регистрация
app.post('/signup', async (req, res) => {
  const { username, password } = req.body; // Получение данных из тела запроса

  try {
    const existingUser = await User.findOne({ username }); // Проверка, существует ли пользователь с таким именем
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' }); // Ответ с ошибкой, если пользователь уже существует
    }

    const hashedPassword = await bcrypt.hash(password, 10); // Хэширование пароля
    const newUser = new User({ username, password: hashedPassword }); // Создание нового пользователя
    await newUser.save(); // Сохранение пользователя в базе данных

    const token = jwt.sign({ _id: newUser._id, username: newUser.username }, process.env.ACCESS_TOKEN_SECRET); // Генерация JWT токена
    req.session.user = newUser; // Сохранение информации о пользователе в сессии
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' }); // Установка куки с токеном
    res.render('index', { user: newUser, token: token }); // Рендеринг шаблона index.njk
  } catch (error) {
    console.error('Error creating user:', error);
    if (error.name === 'ValidationError') {
      // Handle Mongoose validation errors (e.g., required fields missing)
      return res.status(400).json({ message: error.message });
    } else if (error.code === 11000) {
      // Handle duplicate key errors (e.g., username already exists)
      return res.status(400).json({ message: 'Username already exists' });
    } else {
      // Handle other errors
      return res.status(500).json({ message: 'Server error' });
    }
  }
});

// Выход
app.get('/logout', (req, res) => {
  req.session.destroy(error => { // Уничтожение сессии
    if (error) {
      console.error('Error destroying session:', error); // Вывод ошибки в консоль
      res.status(500).send("Server error"); // Ответ с ошибкой сервера
    } else {
      res.clearCookie('token'); // Удаление куки с токеном
      res.redirect('/'); // Перенаправление на главную страницу
    }
  });
});

// ... Endpoints для заметок

// Создание заметок
app.post('/api/notes', authenticateJWT, async (req, res) => {
  try {
    const { title, content, tags } = req.body;
    const author = req.user._id;

    const newNote = new Note({
      title,
      content,
      author,
      tags
    });

    await newNote.save();

    res.status(201).json(newNote); // Ответ с созданной заметкой
  } catch (error) {
    console.error('Error creating note:', error);
    if (error.name === 'ValidationError') {
      // Handle Mongoose validation errors (e.g., required fields missing)
      return res.status(400).json({ message: error.message });
    } else {
      // Handle other errors
      return res.status(500).json({ message: 'Server error' });
    }
  }
});

// Получение всех заметок
app.get('/api/notes', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user._id;
    let filter = { author: userId };

    // Добавляем фильтр по archived, если параметр присутствует
    if (req.query.archived !== undefined) {
      filter.archived = req.query.archived === 'true';
    }

    const notes = await Note.find(filter);
    res.json(notes);
  } catch (error) {
    console.error('Error retrieving notes:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Получение конкретной заметки
app.get('/api/notes/:id', authenticateJWT, async (req, res) => {
  try {
    const noteId = req.params.id;
    const userId = req.user._id;

    const note = await Note.findOne({ _id: noteId, author: userId });

    if (!note) {
      return res.status(404).json({ message: 'Note not found' }); // Ответ с ошибкой, если заметка не найдена
    }

    res.json(note);
  } catch (error) {
    console.error('Error retrieving note:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Обновление заметки
app.put('/api/notes/:id', authenticateJWT, async (req, res) => {
  try {
    const noteId = req.params.id;
    const userId = req.user._id;
    const { title, content, tags } = req.body;

    const updatedNote = await Note.findOneAndUpdate(
      { _id: noteId, author: userId },
      { title, content, tags, updatedAt: Date.now() },
      { new: true }
    );

    if (!updatedNote) {
      return res.status(404).json({ message: 'Note not found' }); // Ответ с ошибкой, если заметка не найдена
    }

    res.json(updatedNote);
  } catch (error) {
    console.error('Error updating note:', error);
    if (error.name === 'ValidationError') {
      // Handle Mongoose validation errors (e.g., required fields missing)
      return res.status(400).json({ message: error.message });
    } else {
      // Handle other errors
      return res.status(500).json({ message: 'Server error' });
    }
  }
});

// Удаление заметки
app.delete('/api/notes/:id', authenticateJWT, async (req, res) => {
  try {
    const noteId = req.params.id;
    const userId = req.user._id;

    const deletedNote = await Note.findOneAndDelete({ _id: noteId, author: userId });

    if (!deletedNote) {
      return res.status(404).json({ message: 'Note not found' });
    }

    res.status(204).send(); // Ответ без тела, код 204 - No Content
  } catch (error) {
    console.error('Error deleting note:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Архивирование заметки
app.patch('/api/notes/:id/archive', authenticateJWT, async (req, res) => {
  try {
    const noteId = req.params.id;
    const userId = req.user._id;

    const archivedNote = await Note.findOneAndUpdate(
      { _id: noteId, author: userId },
      { archived: true, updatedAt: Date.now() }, // Обновляем archived и updatedAt
      { new: true }
    );

    if (!archivedNote) {
      return res.status(404).json({ message: 'Заметка не найдена' });
    }

    res.json(archivedNote);
  } catch (error) {
    console.error('Error archiving note:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Разархивирование заметки
app.patch('/api/notes/:id/unarchive', authenticateJWT, async (req, res) => {
  try {
    const noteId = req.params.id;
    const userId = req.user._id;

    const unarchivedNote = await Note.findOneAndUpdate(
      { _id: noteId, author: userId },
      { archived: false, updatedAt: Date.now() },
      { new: true }
    );

    if (!unarchivedNote) {
      return res.status(404).json({ message: 'Заметка не найдена' });
    }

    res.json(unarchivedNote);
  } catch (error) {
    console.error('Error unarchiving note:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Удаление всех заархивированных заметок
app.delete('/api/notes/archived/deleteAll', authenticateJWT, async (req, res) => {
  try {
    // Проверка на существование req.user и req.user._id
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userId = req.user._id;
    console.log("User ID:", userId);

    // Логирование перед запросом
    console.log("Deleting all archived notes for user:", userId);

    // Удаляем все заархивированные заметки для пользователя
    const result = await Note.deleteMany({ author: userId, archived: true });

    // Логирование после запроса
    console.log("Delete result:", result);

    res.status(204).send(); // 204 No Content - успешное удаление без тела ответа
  } catch (error) {
    console.error('Error deleting archived notes:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// URL для PDF заметки
app.get('/api/notes/:id/pdf', authenticateJWT, async (req, res) => {
  try {
    const noteId = req.params.id;
    const userId = req.user._id;

    const note = await Note.findOne({ _id: noteId, author: userId });

    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    const doc = new PDFDocument();
    const filename = `${note.title.replace(/[^a-z0-9]/gi, '_')}.pdf`;

    // Настройка заголовков для скачивания файла
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/pdf');

    doc.pipe(res); // pipe the document to the response object

    doc.fontSize(24).text(note.title, { align: 'center' });
    doc.fontSize(12).text(note.content);

    doc.end();

  } catch (error) {
    console.error('Error generating PDF:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ======================= WEBSOCKETS =======================

// Создание WebSocket сервера
const wss = new WebSocket.Server({ server });

// Обработчик подключения
wss.on('connection', (ws, req) => {
  sessionMiddleware(req, {}, () => { // Использование sessionMiddleware для доступа к сессии
    if (req.session.user) { // Проверка, авторизован ли пользователь
      console.log('WebSocket connected with user: ', req.session.user.username); // Вывод информации о подключении

      ws.on('message', (message) => { // Обработчик сообщений
        console.log(`Received message: ${message}`); // Вывод полученного сообщения
      });

      ws.on('close', () => { // Обработчик закрытия соединения
        console.log('WebSocket disconnected'); // Вывод информации о закрытии соединения
      });
    } else {
      console.log('WebSocket connection rejected (not authenticated)'); // Вывод информации об отклонении подключения
      ws.close(1000, 'Unauthorized'); // Закрытие соединения с кодом ошибки
    }
  });
});

// ======================= ЗАПУСК СЕРВЕРА =======================

const PORT = process.env.PORT || 3000; // Порт сервера

server.listen(PORT, () => {
  console.log(`Server listening on port: ${PORT}`); // Вывод информации о запуске сервера
});
