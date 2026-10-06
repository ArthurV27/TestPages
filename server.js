const express = require('express');
const session = require('express-session');
const path = require('path');
const methodOverride = require('method-override');
require('dotenv').config();

const adminRoutes = require('./routes/admin');
const librarianRoutes = require('./routes/librarian');
const studentRoutes = require('./routes/student');
const authRoutes = require('./routes/auth');
const { attachLocals } = require('./routes/middleware');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'development-only-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 }
}));
app.use(attachLocals);

app.get('/', (req, res) => {
  if (req.session.user?.role === 'admin') return res.redirect('/admin/dashboard');
  if (req.session.user?.role === 'librarian') return res.redirect('/librarian/dashboard');
  if (req.session.user?.role === 'student') return res.redirect('/student/dashboard');
  res.render('login', { title: 'Library System Login' });
});
app.use('/', authRoutes);
app.use('/admin', adminRoutes);
app.use('/librarian', librarianRoutes);
app.use('/student', studentRoutes);

app.use((req, res) => res.status(404).render('error', { title: 'Page Not Found', message: 'The page you requested does not exist.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { title: 'Server Error', message: 'Something went wrong. Check the server console for details.' });
});

app.listen(PORT, () => console.log(`Library System running at http://localhost:${PORT}`));
