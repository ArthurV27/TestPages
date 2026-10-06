const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireRole, flash } = require('./middleware');

router.use(requireRole('student'));

async function syncOverdue() {
  await pool.query(
    "UPDATE borrow_records SET status='overdue', late_days=DATEDIFF(CURDATE(), due_date) WHERE return_date IS NULL AND due_date<CURDATE() AND status='borrowed'"
  );
}

router.get('/dashboard', async (req, res, next) => {
  try {
    await syncOverdue();

    const [current] = await pool.query(
      `SELECT br.*, b.title, b.author, b.book_code
       FROM borrow_records br
       JOIN books b ON b.id=br.book_id
       WHERE br.student_id=? AND br.return_date IS NULL
       ORDER BY br.due_date`,
      [req.session.user.id]
    );

    const [history] = await pool.query(
      `SELECT br.*, b.title, b.book_code
       FROM borrow_records br
       JOIN books b ON b.id=br.book_id
       WHERE br.student_id=? AND br.return_date IS NOT NULL
       ORDER BY br.return_date DESC
       LIMIT 10`,
      [req.session.user.id]
    );

    const [[student]] = await pool.query(
      "SELECT course,year_level,section FROM users WHERE id=? AND role='student'",
      [req.session.user.id]
    );

    const [recommendations] = await pool.query(
      `SELECT b.*, br.priority
       FROM book_recommendations br
       JOIN books b ON b.id=br.book_id
       WHERE br.course=? AND br.year_level=?
       ORDER BY br.priority,b.title`,
      [student.course, student.year_level]
    );

    res.render('student/dashboard', {
      title: 'Student Dashboard',
      current,
      history,
      student,
      recommendations
    });
  } catch (e) {
    next(e);
  }
});

router.get('/catalog', async (req, res, next) => {
  try {
    const [books] = await pool.query(
      'SELECT * FROM books ORDER BY title'
    );

    res.render('student/catalog', {
      title: 'Book Catalog',
      books
    });
  } catch (e) {
    next(e);
  }
});

router.post('/borrow/:bookId', async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const dueDate = String(req.body.due_date ?? '').trim();
    const today = new Date().toISOString().slice(0, 10);

    if (!dueDate || dueDate < today) {
      throw Object.assign(
        new Error('Please choose a valid future due date.'),
        { user: true }
      );
    }

    const [[book]] = await conn.query(
      `SELECT id, title, available_quantity
       FROM books
       WHERE id=?
       FOR UPDATE`,
      [req.params.bookId]
    );

    if (!book) {
      throw Object.assign(
        new Error('Book not found.'),
        { user: true }
      );
    }

    if (book.available_quantity < 1) {
      throw Object.assign(
        new Error('This book is currently unavailable.'),
        { user: true }
      );
    }

    const [active] = await conn.query(
      `SELECT id
       FROM borrow_records
       WHERE book_id=?
       AND student_id=?
       AND return_date IS NULL
       LIMIT 1`,
      [book.id, req.session.user.id]
    );

    if (active.length) {
      throw Object.assign(
        new Error('You already have this book borrowed.'),
        { user: true }
      );
    }

    await conn.query(
      `INSERT INTO borrow_records
       (book_id, student_id, issue_date, due_date, status)
       VALUES (?, ?, CURDATE(), ?, 'borrowed')`,
      [book.id, req.session.user.id, dueDate]
    );

    const [stockUpdate] = await conn.query(
      `UPDATE books
       SET available_quantity = available_quantity - 1
       WHERE id=?
       AND available_quantity > 0`,
      [book.id]
    );

    if (stockUpdate.affectedRows !== 1) {
      throw Object.assign(
        new Error('The book is no longer available.'),
        { user: true }
      );
    }

    await conn.commit();

    const remaining = book.available_quantity - 1;

    flash(
      req,
      'success',
      `"${book.title}" was borrowed successfully. ${remaining} copy/copies now available.`
    );

    res.redirect('/student/catalog');
  } catch (e) {
    await conn.rollback();

    flash(
      req,
      'error',
      e.user ? e.message : 'Unable to borrow book.'
    );

    res.redirect('/student/catalog');
  } finally {
    conn.release();
  }
});

router.get('/borrowed', async (req, res, next) => {
  try {
    await syncOverdue();

    const [loans] = await pool.query(
      `SELECT br.*, b.title, b.author, b.book_code
       FROM borrow_records br
       JOIN books b ON b.id=br.book_id
       WHERE br.student_id=?
       AND br.return_date IS NULL
       ORDER BY br.due_date`,
      [req.session.user.id]
    );

    res.render('student/borrowed', {
      title: 'My Borrowed Books',
      loans
    });
  } catch (e) {
    next(e);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const [history] = await pool.query(
      `SELECT br.*, b.title, b.author, b.book_code
       FROM borrow_records br
       JOIN books b ON b.id=br.book_id
       WHERE br.student_id=?
       ORDER BY br.issue_date DESC`,
      [req.session.user.id]
    );

    res.render('student/history', {
      title: 'Borrowing History',
      history
    });
  } catch (e) {
    next(e);
  }
});

router.get('/profile', async (req, res, next) => {
  try {
    const [[student]] = await pool.query(
      "SELECT * FROM users WHERE id=? AND role='student'",
      [req.session.user.id]
    );

    res.render('student/profile', {
      title: 'My Profile',
      student
    });
  } catch (e) {
    next(e);
  }
});

router.post('/profile', async (req, res, next) => {
  try {
    const name = String(req.body.name ?? '').trim();
    const email = String(req.body.email ?? '').trim();
    const contactNumber = String(req.body.contact_number ?? '').trim();

    if (!name || !email) {
      flash(req, 'error', 'Name and email are required.');
      return res.redirect('/student/profile');
    }

    await pool.query(
      `UPDATE users
       SET name=?, email=?, contact_number=?
       WHERE id=? AND role='student'`,
      [
        name,
        email,
        contactNumber || null,
        req.session.user.id
      ]
    );

    req.session.user.name = name;
    req.session.user.email = email;

    flash(req, 'success', 'Profile updated successfully.');
    res.redirect('/student/profile');
  } catch (e) {
    next(e);
  }
});

module.exports = router;