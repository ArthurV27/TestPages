const express = require('express');
const router = express.Router();

const pool = require('../config/db');
const { requireRole, flash } = require('./middleware');

router.use(requireRole('librarian'));


// ==============================
// OVERDUE STATUS
// ==============================

async function syncOverdue() {
  await pool.query(
    `
    UPDATE borrow_records
    SET
      status = 'overdue',
      late_days = DATEDIFF(CURDATE(), due_date)
    WHERE return_date IS NULL
      AND due_date < CURDATE()
      AND status = 'borrowed'
    `
  );
}


// ==============================
// DASHBOARD
// ==============================

router.get('/dashboard', async (req, res, next) => {
  try {
    await syncOverdue();

    const [[metrics]] = await pool.query(`
      SELECT
        (
          SELECT COALESCE(SUM(quantity), 0)
          FROM books
        ) AS totalBooks,

        (
          SELECT COALESCE(SUM(available_quantity), 0)
          FROM books
        ) AS availableBooks,

        (
          SELECT COUNT(*)
          FROM borrow_records
          WHERE return_date IS NULL
        ) AS borrowedBooks,

        (
          SELECT COUNT(*)
          FROM borrow_records
          WHERE return_date IS NULL
            AND due_date < CURDATE()
        ) AS overdueBooks
    `);

    const [recent] = await pool.query(`
      SELECT
        br.*,
        b.title,
        u.name AS student_name
      FROM borrow_records br
      JOIN books b ON b.id = br.book_id
      JOIN users u ON u.id = br.student_id
      ORDER BY br.created_at DESC
      LIMIT 8
    `);

    res.render('librarian/dashboard', {
      title: 'Librarian Dashboard',
      metrics,
      recent
    });
  } catch (error) {
    next(error);
  }
});


// ==============================
// BOOK MANAGEMENT
// ==============================

router.get('/books', async (req, res, next) => {
  try {
    const [books] = await pool.query(
      'SELECT * FROM books ORDER BY title'
    );

    res.render('librarian/books', {
      title: 'Book Management',
      books
    });
  } catch (error) {
    next(error);
  }
});


router.post('/books', async (req, res, next) => {
  try {
    const {
      book_code,
      title,
      author,
      isbn,
      category,
      quantity,
      cover_url,
      description
    } = req.body;

    const qty = Number(quantity);

    if (
      !book_code ||
      !title ||
      !author ||
      !category ||
      !Number.isInteger(qty) ||
      qty < 1
    ) {
      flash(
        req,
        'error',
        'Book code, title, author, category and a valid quantity are required.'
      );

      return res.redirect('/librarian/books');
    }

    await pool.query(
      `
      INSERT INTO books
      (
        book_code,
        title,
        author,
        isbn,
        category,
        quantity,
        available_quantity,
        cover_url,
        description
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        book_code.trim(),
        title.trim(),
        author.trim(),
        isbn?.trim() || null,
        category.trim(),
        qty,
        qty,
        cover_url?.trim() || null,
        description?.trim() || null
      ]
    );

    flash(req, 'success', 'Book added successfully.');

    res.redirect('/librarian/books');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      flash(
        req,
        'error',
        'Book code or ISBN already exists.'
      );

      return res.redirect('/librarian/books');
    }

    next(error);
  }
});


router.post('/books/:id/update', async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const {
      book_code,
      title,
      author,
      isbn,
      category,
      quantity,
      cover_url,
      description
    } = req.body;

    const newQty = Number(quantity);

    const [[book]] = await pool.query(
      `
      SELECT
        quantity,
        available_quantity
      FROM books
      WHERE id = ?
      `,
      [id]
    );

    if (!book) {
      flash(req, 'error', 'Book not found.');
      return res.redirect('/librarian/books');
    }

    const borrowed = book.quantity - book.available_quantity;

    if (
      !Number.isInteger(newQty) ||
      newQty < borrowed
    ) {
      flash(
        req,
        'error',
        `Quantity cannot be less than the ${borrowed} copies currently borrowed.`
      );

      return res.redirect('/librarian/books');
    }

    const newAvailable = newQty - borrowed;

    await pool.query(
      `
      UPDATE books
      SET
        book_code = ?,
        title = ?,
        author = ?,
        isbn = ?,
        category = ?,
        quantity = ?,
        available_quantity = ?,
        cover_url = ?,
        description = ?
      WHERE id = ?
      `,
      [
        book_code.trim(),
        title.trim(),
        author.trim(),
        isbn?.trim() || null,
        category.trim(),
        newQty,
        newAvailable,
        cover_url?.trim() || null,
        description?.trim() || null,
        id
      ]
    );

    flash(req, 'success', 'Book details updated.');

    res.redirect('/librarian/books');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      flash(
        req,
        'error',
        'Book code or ISBN already exists.'
      );

      return res.redirect('/librarian/books');
    }

    next(error);
  }
});


router.post('/books/:id/delete', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM books WHERE id = ?',
      [req.params.id]
    );

    flash(req, 'success', 'Book deleted.');
  } catch (error) {
    flash(
      req,
      'error',
      error.code === 'ER_ROW_IS_REFERENCED_2'
        ? 'This book has transaction history and cannot be deleted.'
        : 'Unable to delete book.'
    );
  }

  res.redirect('/librarian/books');
});


// ==============================
// STUDENT MANAGEMENT
// ==============================

router.get('/students', async (req, res, next) => {
  try {
    const [students] = await pool.query(`
      SELECT
        u.*,
        COUNT(br.id) AS total_borrows,
        SUM(br.return_date IS NULL) AS active_borrows
      FROM users u
      LEFT JOIN borrow_records br
        ON br.student_id = u.id
      WHERE u.role = 'student'
      GROUP BY u.id
      ORDER BY u.name
    `);

    res.render('librarian/students', {
      title: 'Student Management',
      students
    });
  } catch (error) {
    next(error);
  }
});


router.post('/students/:id/status', async (req, res, next) => {
  try {
    await pool.query(
      `
      UPDATE users
      SET status = ?
      WHERE id = ?
        AND role = 'student'
      `,
      [
        req.body.status,
        req.params.id
      ]
    );

    flash(req, 'success', 'Student status updated.');

    res.redirect('/librarian/students');
  } catch (error) {
    next(error);
  }
});


router.get('/students/:id', async (req, res, next) => {
  try {
    const [[student]] = await pool.query(
      `
      SELECT *
      FROM users
      WHERE id = ?
        AND role = 'student'
      `,
      [req.params.id]
    );

    if (!student) {
      return res.status(404).render('error', {
        title: 'Not Found',
        message: 'Student not found.'
      });
    }

    const [history] = await pool.query(
      `
      SELECT
        br.*,
        b.title,
        b.book_code
      FROM borrow_records br
      JOIN books b
        ON b.id = br.book_id
      WHERE br.student_id = ?
      ORDER BY br.issue_date DESC
      `,
      [req.params.id]
    );

    res.render('librarian/student-detail', {
      title: student.name,
      student,
      history
    });
  } catch (error) {
    next(error);
  }
});


// ==============================
// ISSUE A BOOK
// ==============================

router.get('/borrow', async (req, res, next) => {
  try {
    const [books] = await pool.query(`
      SELECT
        id,
        book_code,
        title,
        author,
        available_quantity
      FROM books
      WHERE available_quantity > 0
      ORDER BY title
    `);

    const [students] = await pool.query(`
      SELECT
        id,
        name,
        student_number
      FROM users
      WHERE role = 'student'
        AND status = 'active'
      ORDER BY name
    `);

    res.render('librarian/borrow', {
      title: 'Issue a Book',
      books,
      students
    });
  } catch (error) {
    next(error);
  }
});


router.post('/borrow', async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const bookId = Number(req.body.book_id);
    const studentId = Number(req.body.student_id);
    const dueDate = String(req.body.due_date ?? '').trim();
    const notes = String(req.body.notes ?? '').trim();

    if (
      !bookId ||
      !studentId ||
      !dueDate
    ) {
      throw Object.assign(
        new Error('Book, student and due date are required.'),
        { user: true }
      );
    }

    const today = new Date()
      .toISOString()
      .slice(0, 10);

    if (dueDate < today) {
      throw Object.assign(
        new Error('Due date cannot be in the past.'),
        { user: true }
      );
    }

    const [[book]] = await conn.query(
      `
      SELECT
        id,
        title,
        available_quantity
      FROM books
      WHERE id = ?
      FOR UPDATE
      `,
      [bookId]
    );

    if (!book) {
      throw Object.assign(
        new Error('Book not found.'),
        { user: true }
      );
    }

    if (book.available_quantity < 1) {
      throw Object.assign(
        new Error('That book is currently out of stock.'),
        { user: true }
      );
    }

    const [[student]] = await conn.query(
      `
      SELECT id
      FROM users
      WHERE id = ?
        AND role = 'student'
        AND status = 'active'
      `,
      [studentId]
    );

    if (!student) {
      throw Object.assign(
        new Error('Student account is not active.'),
        { user: true }
      );
    }

    const [active] = await conn.query(
      `
      SELECT id
      FROM borrow_records
      WHERE book_id = ?
        AND student_id = ?
        AND return_date IS NULL
      LIMIT 1
      `,
      [
        bookId,
        studentId
      ]
    );

    if (active.length > 0) {
      throw Object.assign(
        new Error(
          'This student already has an active loan for that book.'
        ),
        { user: true }
      );
    }

    await conn.query(
      `
      INSERT INTO borrow_records
      (
        book_id,
        student_id,
        issue_date,
        due_date,
        status,
        notes
      )
      VALUES (?, ?, CURDATE(), ?, 'borrowed', ?)
      `,
      [
        bookId,
        studentId,
        dueDate,
        notes || null
      ]
    );

    const [stockUpdate] = await conn.query(
      `
      UPDATE books
      SET available_quantity = available_quantity - 1
      WHERE id = ?
        AND available_quantity > 0
      `,
      [bookId]
    );

    if (stockUpdate.affectedRows !== 1) {
      throw Object.assign(
        new Error('The book is no longer available.'),
        { user: true }
      );
    }

    await conn.commit();

    flash(
      req,
      'success',
      `"${book.title}" was issued successfully.`
    );

    res.redirect('/librarian/borrow');
  } catch (error) {
    await conn.rollback();

    flash(
      req,
      'error',
      error.user
        ? error.message
        : 'Could not issue book.'
    );

    res.redirect('/librarian/borrow');
  } finally {
    conn.release();
  }
});


// ==============================
// RETURNS
// ==============================

router.get('/returns', async (req, res, next) => {
  try {
    await syncOverdue();

    const [loans] = await pool.query(`
      SELECT
        br.*,
        b.title,
        b.book_code,
        u.name AS student_name,
        u.student_number
      FROM borrow_records br
      JOIN books b
        ON b.id = br.book_id
      JOIN users u
        ON u.id = br.student_id
      WHERE br.return_date IS NULL
      ORDER BY br.due_date
    `);

    res.render('librarian/returns', {
      title: 'Return Management',
      loans
    });
  } catch (error) {
    next(error);
  }
});


router.post('/returns/:id', async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [[loan]] = await conn.query(
      `
      SELECT *
      FROM borrow_records
      WHERE id = ?
        AND return_date IS NULL
      FOR UPDATE
      `,
      [req.params.id]
    );

    if (!loan) {
      throw Object.assign(
        new Error('Active loan not found.'),
        { user: true }
      );
    }

    const late = Math.max(
      0,
      Math.floor(
        (
          Date.now() -
          new Date(
            loan.due_date + 'T00:00:00'
          ).getTime()
        ) /
        86400000
      )
    );

    await conn.query(
      `
      UPDATE borrow_records
      SET
        return_date = CURDATE(),
        status = 'returned',
        late_days = ?
      WHERE id = ?
      `,
      [
        late,
        loan.id
      ]
    );

    await conn.query(
      `
      UPDATE books
      SET available_quantity =
        LEAST(quantity, available_quantity + 1)
      WHERE id = ?
      `,
      [loan.book_id]
    );

    await conn.commit();

    flash(
      req,
      'success',
      late
        ? `Return recorded. ${late} day(s) late.`
        : 'Return recorded successfully.'
    );

    res.redirect('/librarian/returns');
  } catch (error) {
    await conn.rollback();

    flash(
      req,
      'error',
      error.user
        ? error.message
        : 'Could not process return.'
    );

    res.redirect('/librarian/returns');
  } finally {
    conn.release();
  }
});


// ==============================
// OVERDUE
// ==============================

router.get('/overdue', async (req, res, next) => {
  try {
    await syncOverdue();

    const [overdue] = await pool.query(`
      SELECT
        br.*,
        b.title,
        b.book_code,
        u.name AS student_name,
        u.student_number,
        u.email,
        u.contact_number,
        DATEDIFF(CURDATE(), br.due_date) AS days_late
      FROM borrow_records br
      JOIN books b
        ON b.id = br.book_id
      JOIN users u
        ON u.id = br.student_id
      WHERE br.return_date IS NULL
        AND br.due_date < CURDATE()
      ORDER BY days_late DESC
    `);

    res.render('librarian/overdue', {
      title: 'Overdue Monitoring',
      overdue
    });
  } catch (error) {
    next(error);
  }
});


// ==============================
// REPORTS
// ==============================

router.get('/reports', async (req, res, next) => {
  try {
    await syncOverdue();

    const [[summary]] = await pool.query(`
      SELECT
        (
          SELECT COUNT(*)
          FROM borrow_records
        ) AS total_transactions,

        (
          SELECT COUNT(*)
          FROM borrow_records
          WHERE return_date IS NOT NULL
        ) AS returned,

        (
          SELECT COUNT(*)
          FROM borrow_records
          WHERE return_date IS NULL
        ) AS active,

        (
          SELECT COUNT(*)
          FROM borrow_records
          WHERE return_date IS NULL
            AND due_date < CURDATE()
        ) AS overdue
    `);

    const [inventory] = await pool.query(`
      SELECT
        book_code,
        title,
        category,
        quantity,
        available_quantity,
        (quantity - available_quantity) AS borrowed_copies
      FROM books
      ORDER BY title
    `);

    const [logs] = await pool.query(`
      SELECT
        br.id,
        b.book_code,
        b.title,
        u.name AS student_name,
        br.issue_date,
        br.due_date,
        br.return_date,
        br.status,
        br.late_days
      FROM borrow_records br
      JOIN books b
        ON b.id = br.book_id
      JOIN users u
        ON u.id = br.student_id
      ORDER BY br.issue_date DESC
    `);

    res.render('librarian/reports', {
      title: 'Reports',
      summary,
      inventory,
      logs
    });
  } catch (error) {
    next(error);
  }
});


router.get('/reports/borrowings.csv', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        br.id,
        b.book_code,
        b.title,
        u.name AS student_name,
        u.student_number,
        br.issue_date,
        br.due_date,
        br.return_date,
        br.status,
        br.late_days
      FROM borrow_records br
      JOIN books b
        ON b.id = br.book_id
      JOIN users u
        ON u.id = br.student_id
      ORDER BY br.issue_date DESC
    `);

    const headers = Object.keys(
      rows[0] || {
        id: '',
        book_code: '',
        title: '',
        student_name: '',
        student_number: '',
        issue_date: '',
        due_date: '',
        return_date: '',
        status: '',
        late_days: ''
      }
    );

    const csv = [
      headers.join(','),
      ...rows.map(row =>
        headers
          .map(header =>
            `"${String(row[header] ?? '').replace(/"/g, '""')}"`
          )
          .join(',')
      )
    ].join('\n');

    res.setHeader(
      'Content-Type',
      'text/csv'
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="borrowing-report.csv"'
    );

    res.send(csv);
  } catch (error) {
    next(error);
  }
});


module.exports = router;