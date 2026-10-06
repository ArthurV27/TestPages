const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

const pool = require('../config/db');
const { requireRole, flash } = require('./middleware');
const { courses, currentSchoolYear } = require('../config/catalog');

router.use(requireRole('admin'));

function isValidPhilippineMobile(number) {
  return /^09\d{9}$/.test(number);
}

router.get('/dashboard', async (req, res, next) => {
  try {
    const [[metrics]] = await pool.query(`SELECT
      (SELECT COUNT(*) FROM users WHERE role='librarian') librarians,
      (SELECT COUNT(*) FROM users WHERE role='student') students,
      (SELECT COUNT(*) FROM users WHERE role='student' AND status='active') activeStudents,
      (SELECT COUNT(*) FROM books) books`);

    const [recent] = await pool.query(`
      SELECT id, name, role, status, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 8
    `);

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      metrics,
      recent
    });
  } catch (e) {
    next(e);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const [users] = await pool.query(`
      SELECT u.*, COUNT(br.id) total_borrows
      FROM users u
      LEFT JOIN borrow_records br ON br.student_id = u.id
      GROUP BY u.id
      ORDER BY u.role, u.name
    `);

    res.render('admin/users', {
      title: 'User Management',
      users,
      currentUser: req.session.user,
      courses,
      currentSchoolYear
    });
  } catch (e) {
    next(e);
  }
});

router.post('/users/:id/status', async (req, res, next) => {
  try {
    const status = ['active', 'inactive', 'suspended'].includes(req.body.status)
      ? req.body.status
      : null;

    if (!status) {
      flash(req, 'error', 'Invalid user status.');
      return res.redirect('/admin/users');
    }

    await pool.query(
      'UPDATE users SET status=? WHERE id=? AND id<>?',
      [status, req.params.id, req.session.user.id]
    );

    flash(req, 'success', 'User status updated.');
    res.redirect('/admin/users');
  } catch (e) {
    next(e);
  }
});

router.post('/librarians', async (req, res, next) => {
  try {
    const firstName = String(req.body.first_name ?? '').trim();
    const lastName = String(req.body.last_name ?? '').trim();
    const email = String(req.body.email ?? '').trim();
    const contactNumber = String(req.body.contact_number ?? '').trim();
    const password = String(req.body.password ?? '');
    const confirmPassword = String(req.body.confirm_password ?? '');

    if (!firstName || !lastName) {
      flash(req, 'error', 'First and last name are required.');
      return res.redirect('/admin/users');
    }

    if (contactNumber && !isValidPhilippineMobile(contactNumber)) {
      flash(
        req,
        'error',
        'Please enter a valid Philippine cellphone number in 09XXXXXXXXX format.'
      );
      return res.redirect('/admin/users');
    }

    if (password.length < 10) {
      flash(
        req,
        'error',
        'Librarian password must be at least 10 characters.'
      );
      return res.redirect('/admin/users');
    }

    if (password !== confirmPassword) {
      flash(
        req,
        'error',
        'Password and confirm password do not match.'
      );
      return res.redirect('/admin/users');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await pool.query(
      `INSERT INTO users
       (name, role, password_hash, email, contact_number, status)
       VALUES (?, 'librarian', ?, ?, ?, 'active')`,
      [
        `${firstName} ${lastName}`,
        passwordHash,
        email || null,
        contactNumber || null
      ]
    );

    flash(req, 'success', 'Librarian account created.');
    res.redirect('/admin/users');
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      flash(
        req,
        'error',
        'A librarian account with the same unique information already exists.'
      );
      return res.redirect('/admin/users');
    }

    next(e);
  }
});

router.post('/users/:id/update', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const name = String(req.body.name ?? '').trim();
    const email = String(req.body.email ?? '').trim();
    const contactNumber = String(req.body.contact_number ?? '').trim();
    const course = String(req.body.course ?? '').trim();
    const section = String(req.body.section ?? '').trim();
    const schoolId = String(req.body.school_id ?? '').trim();
    const schoolYear = String(req.body.school_year ?? '').trim();
    const yearLevel = Number(req.body.year_level);

    const [[user]] = await pool.query(
      'SELECT role FROM users WHERE id=?',
      [id]
    );

    if (!user) {
      flash(req, 'error', 'User not found.');
      return res.redirect('/admin/users');
    }

    if (!name) {
      flash(req, 'error', 'Name is required.');
      return res.redirect('/admin/users');
    }

    if (contactNumber && !isValidPhilippineMobile(contactNumber)) {
      flash(
        req,
        'error',
        'Please enter a valid Philippine cellphone number in 09XXXXXXXXX format.'
      );
      return res.redirect('/admin/users');
    }

    if (user.role === 'student') {
      if (
        !schoolId ||
        !course ||
        !Number.isInteger(yearLevel) ||
        yearLevel < 1 ||
        yearLevel > 6 ||
        !section
      ) {
        flash(req, 'error', 'Complete the student profile fields.');
        return res.redirect('/admin/users');
      }

      await pool.query(
        `UPDATE users
         SET name=?, email=?, contact_number=?, school_id=?, school_year=?,
             course=?, year_level=?, section=?
         WHERE id=?`,
        [
          name,
          email || null,
          contactNumber || null,
          schoolId,
          schoolYear || currentSchoolYear,
          course,
          yearLevel,
          section,
          id
        ]
      );
    } else {
      await pool.query(
        'UPDATE users SET name=?, email=?, contact_number=? WHERE id=?',
        [
          name,
          email || null,
          contactNumber || null,
          id
        ]
      );
    }

    flash(req, 'success', 'User details updated.');
    res.redirect('/admin/users');
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      flash(
        req,
        'error',
        'School ID or another unique field is already in use.'
      );
      return res.redirect('/admin/users');
    }

    next(e);
  }
});

router.get('/recommendations', async (req, res, next) => {
  try {
    const [recommendations] = await pool.query(`
      SELECT br.*, b.title, b.book_code
      FROM book_recommendations br
      JOIN books b ON b.id = br.book_id
      ORDER BY br.course, br.year_level, br.priority, b.title
    `);

    const [books] = await pool.query(
      'SELECT id, book_code, title FROM books ORDER BY title'
    );

    res.render('admin/recommendations', {
      title: 'Book Recommendations',
      recommendations,
      books,
      courses
    });
  } catch (e) {
    next(e);
  }
});

router.post('/recommendations', async (req, res, next) => {
  try {
    const bookId = req.body.book_id;
    const course = String(req.body.course ?? '').trim();
    const year = Number(req.body.year_level);
    const priority = Number(req.body.priority || 1);

    if (
      !bookId ||
      !courses.includes(course) ||
      !Number.isInteger(year) ||
      year < 1 ||
      year > 6
    ) {
      flash(
        req,
        'error',
        'Book, course and valid year level are required.'
      );
      return res.redirect('/admin/recommendations');
    }

    await pool.query(
      `INSERT INTO book_recommendations
       (book_id, course, year_level, priority)
       VALUES (?, ?, ?, ?)`,
      [
        bookId,
        course,
        year,
        Number.isInteger(priority) && priority > 0
          ? priority
          : 1
      ]
    );

    flash(req, 'success', 'Recommendation added.');
    res.redirect('/admin/recommendations');
  } catch (e) {
    flash(
      req,
      'error',
      e.code === 'ER_DUP_ENTRY'
        ? 'That recommendation already exists.'
        : 'Unable to add recommendation.'
    );

    res.redirect('/admin/recommendations');
  }
});

router.post('/recommendations/:id/delete', async (req, res, next) => {
  try {
    await pool.query(
      'DELETE FROM book_recommendations WHERE id=?',
      [req.params.id]
    );

    flash(req, 'success', 'Recommendation removed.');
    res.redirect('/admin/recommendations');
  } catch (e) {
    next(e);
  }
});

module.exports = router;