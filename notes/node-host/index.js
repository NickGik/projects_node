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
const PDFDocument = require('pdfkit');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

//dsds
// Создание экземпляра Express приложения
const app = express();

// ======================= НАСТРОЙКА СЕРВЕРА =======================

// Хранилище сессий MongoDB
const store = MongoStore.create({
  mongoUrl: process.env.MONGO_URI, 
  collectionName: 'sessions',
  autoRemove: 'interval',
  autoRemoveInterval: 10 // Удаление старых сессий каждые 10 минут
});

// Подключение моделей
const User = require('./models/User');
const Note = require('./models/Note');

// Подключение к MongoDB
mongoose.connect(process.env.MONGO_URI);

// ======================= НАСТРОЙКА ШАБЛОНИЗАТОРА =======================
nunjucks.configure("views", {
  autoescape: true,
  express: app,
  tags: {
    blockStart: '{%',
    blockEnd: '%}',
    variableStart: '{{',
    variableEnd: '}}',
    commentStart: '{#',
    commentEnd: '#}'
  }
});

app.set("view engine", "njk");
app.set('views', path.join(__dirname, 'views'));

// Сервер статических файлов
app.use(express.static(path.join(__dirname, 'public')));

// Middleware для обработки CORS запросов
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Middleware для обработки JSON и URL-кодированных данных
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware для парсинга cookies
app.use(cookieParser());

// Настройка middleware для обработки сессий
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: store,
  cookie: {
    secure: process.env.NODE_ENV === 'production', 
    maxAge: 24 * 60 * 60 * 1000 // 1 день
  }
}));

// Настройка Passport.js для аутентификации
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
}, (accessToken, refreshToken, profile, done) => {
  // Логика поиска или создания пользователя
  User.findOne({ googleId: profile.id })
    .then(existingUser => {
      if (existingUser) {
        done(null, existingUser);
      } else {
        new User({ googleId: profile.id }).save()
          .then(user => done(null, user));
      }
    });
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id)
    .then(user => done(null, user));
});

// =======================  MIDDLEWARE АУТЕНТИФИКАЦИИ =======================

function authenticateJWT(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).redirect('/'); 
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).redirect('/'); 
  }
}

// ======================= РОУТЫ =======================

// Главная страница
app.get('/', (req, res) => {
  res.render('index', { user: req.user });
});

// Страница /dashboard
app.get('/dashboard', authenticateJWT, (req, res) => {
  res.render('dashboard', { user: req.user });
});

// Авторизация
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });

  if (user && await user.comparePassword(password)) {
    const token = jwt.sign({ _id: user._id, username: user.username }, process.env.ACCESS_TOKEN_SECRET);
    req.session.user = user;
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    res.redirect(302, '/dashboard');
  } else {
    res.redirect("/");
  }
});

// Регистрация
app.post('/signup', async (req, res) => {
  const { username, password } = req.body;

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    const token = jwt.sign({ _id: newUser._id, username: newUser.username }, process.env.ACCESS_TOKEN_SECRET);
    req.session.user = newUser;
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    res.render('index', { user: newUser, token: token });
  } catch (error) {
    console.error('Error creating user:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    } else if (error.code === 11000) {
      return res.status(400).json({ message: 'Username already exists' });
    } else {
      return res.status(500).json({ message: 'Server error' });
    }
  }
});

// Выход
app.get('/logout', (req, res) => {
  req.session.destroy(error => {
    if (error) {
      console.error('Error destroying session:', error);
      res.status(500).send("Server error");
    } else {
      res.clearCookie('token');
      res.redirect('/');
    }
  });
});

// ======================= МАРШРУТЫ ДЛЯ GOOGLE AUTH =======================

// Инициализация аутентификации через Google
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] }));

// Обратный вызов после аутентификации через Google
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Успешная аутентификация, перенаправление на главную страницу
    res.redirect('/dashboard');
  });

// ======================= API ДЛЯ ЗАМЕТОК =======================

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

    res.status(201).json(newNote);
  } catch (error) {
    console.error('Error creating note:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    } else {
      return res.status(500).json({ message: 'Server error' });
    }
  }
});

// Получение всех заметок
app.get('/api/notes', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user._id; 
    let filter = { author: userId };

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
      return res.status(404).json({ message: 'Note not found' });
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
      return res.status(404).json({ message: 'Note not found' });
    }

    res.json(updatedNote);
  } catch (error) {
    console.error('Error updating note:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    } else {
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

    res.status(204).send();
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
      { archived: true, updatedAt: Date.now() },
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
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userId = req.user._id;
    console.log("User ID:", userId);

    console.log("Deleting all archived notes for user:", userId);

    const result = await Note.deleteMany({ author: userId, archived: true });

    console.log("Delete result:", result);

    res.status(204).send();
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

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/pdf');

    doc.pipe(res);

    // Используем встроенный шрифт Helvetica для поддержки кириллицы
    doc.font('Helvetica').fontSize(24).text(note.title, { align: 'center' });
    doc.font('Helvetica').fontSize(12).text(note.content);

    doc.end();

  } catch (error) {
    console.error('Error generating PDF:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ======================= WEBSOCKETS =======================

const wss = new WebSocket.Server({ server: app }); // Используем 'app'

wss.on('connection', (ws, req) => {
  session({
    secret: process.env.SESSION_SECRET, 
    resave: false,
    saveUninitialized: false,
    store: store,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 1 день
    }
  })(req, {}, () => {
    if (req.session.user) {
      console.log('WebSocket connected with user: ', req.session.user.username);

      ws.on('message', (message) => {
        console.log(`Received message: ${message}`);
      });

      ws.on('close', () => {
        console.log('WebSocket disconnected');
      });
    } else {
      console.log('WebSocket connection rejected (not authenticated)');
      ws.close(1000, 'Unauthorized');
    }
  });
});

// ======================= ЗАПУСК СЕРВЕРА =======================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => { 
  console.log(`Server listening on port: ${PORT}`);
});
