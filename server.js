require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

const FileStore = require('session-file-store')(session);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));
const sessionPath = process.env.VERCEL ? '/tmp/.sessions' : './.sessions';
app.use(
  session({
    store: new FileStore({ path: sessionPath, retries: 0 }),
    secret: process.env.SESSION_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Global template locals (site settings injected per-request by middleware)
app.use(require('./middleware/siteSettingsMiddleware'));

// Routes
app.use('/', require('./routes/publicRoutes'));
app.use('/api/result', require('./routes/resultRoutes'));
app.use('/api/admission', require('./routes/admissionRoutes'));
app.use('/admin', require('./routes/adminRoutes'));

// 404 handler
app.use((req, res) => {
  res.status(404).render('public/404', { title: '404 — পেজ পাওয়া যায়নি' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('public/error', {
    title: 'সার্ভার ত্রুটি',
    message: err.message,
  });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`✅ Smart Computer Training server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
