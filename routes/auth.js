const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const pool = require('../config/db');
const { flash } = require('./middleware');
const { courses, currentSchoolYear } = require('../config/catalog');


// ==============================
// SCHOOL ID UPLOAD
// ==============================

const uploadDir = path.join(
  __dirname,
  '..',
  'private_uploads',
  'school-ids'
);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const schoolIdStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const filename = `${Date.now()}-${Math.round(Math.random() * 1000000)}${extension}`;

    cb(null, filename);
  }
});

const schoolIdUpload = multer({
  storage: schoolIdStorage,

  limits: {
    fileSize: 5 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only JPG and PNG images are allowed.'));
    }

    cb(null, true);
  }
});


// ==============================
// VALIDATION
// ==============================

function isValidPhilippineMobile(number) {
  return /^(09\d{9}|\+639\d{9})$/.test(number);
}


// ==============================
// STUDENT REGISTRATION PAGE
// ==============================

router.get('/register', (req, res) => {
  res.render('register', {
    title: 'Student Registration',
    courses,
    currentSchoolYear
  });
});


// ==============================
// STUDENT REGISTRATION
// ==============================

router.post(
  '/register',
  schoolIdUpload.single('school_id_image'),
  async (req, res) => {
    try {
      const {
        student_number,
        first_name,
        last_name,
        course,
        year_level,
        section,
        school_year,
        email,
        contact_number,
        password,
        confirm_password
      } = req.body;

      const first = String(first_name ?? '').trim();
      const last = String(last_name ?? '').trim();
      const studentNo = String(student_number ?? '').trim();
      const selectedCourse = String(course ?? '').trim();
      const yearValue = String(year_level ?? '').trim();
      const sectionValue = String(section ?? '').trim();
      const sy =
        String(school_year ?? '').trim() || currentSchoolYear;
      const emailValue = String(email ?? '').trim();
      const contactValue = String(contact_number ?? '').trim();

      const studentPassword = String(password ?? '');
      const confirmPassword = String(confirm_password ?? '');

      const year = Number(yearValue);

      if (
        !first ||
        !last ||
        !studentNo ||
        !selectedCourse ||
        !yearValue ||
        !sectionValue ||
        !emailValue ||
        !studentPassword ||
        !confirmPassword
      ) {
        flash(req, 'error', 'Please complete all required fields.');
        return res.redirect('/register');
      }

      if (!req.file) {
        flash(req, 'error', 'Please upload your School ID image.');
        return res.redirect('/register');
      }

      if (!Number.isInteger(year) || year < 1 || year > 5) {
        flash(req, 'error', 'Please select a valid year level.');
        return res.redirect('/register');
      }

      if (studentPassword.length < 8) {
        flash(
          req,
          'error',
          'Password must be at least 8 characters long.'
        );
        return res.redirect('/register');
      }

      if (studentPassword !== confirmPassword) {
        flash(req, 'error', 'Passwords do not match.');
        return res.redirect('/register');
      }

      if (
        contactValue &&
        !isValidPhilippineMobile(contactValue)
      ) {
        flash(
          req,
          'error',
          'Please enter a valid Philippine mobile number, such as 09123456789 or +639123456789.'
        );
        return res.redirect('/register');
      }

      const [existingStudents] = await pool.query(
        `
        SELECT id
        FROM users
        WHERE student_number = ?
        LIMIT 1
        `,
        [studentNo]
      );

      if (existingStudents.length > 0) {
        flash(
          req,
          'error',
          'Student number is already registered.'
        );
        return res.redirect('/register');
      }

      const passwordHash = await bcrypt.hash(
        studentPassword,
        12
      );

      const name = `${first} ${last}`;

      await pool.query(
        `
        INSERT INTO users (
          name,
          role,
          password_hash,
          student_number,
          school_id,
          school_year,
          course,
          year_level,
          section,
          email,
          contact_number,
          school_id_image,
          status
        )
        VALUES (
          ?,
          'student',
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          'pending'
        )
        `,
        [
          name,
          passwordHash,
          studentNo,
          studentNo,
          sy,
          selectedCourse,
          year,
          sectionValue,
          emailValue,
          contactValue || null,
          req.file.filename
        ]
      );

      flash(
        req,
        'success',
        'Registration submitted successfully. Please wait for admin approval.'
      );

      return res.redirect('/');
    } catch (error) {
      console.error('Student registration error:', error);

      if (req.file) {
        try {
          fs.unlinkSync(
            path.join(uploadDir, req.file.filename)
          );
        } catch (deleteError) {
          console.error(
            'Unable to remove uploaded file:',
            deleteError
          );
        }
      }

      flash(
        req,
        'error',
        'Unable to complete registration.'
      );

      return res.redirect('/register');
    }
  }
);


// ==============================
// LOGIN
// ==============================

router.post('/login', async (req, res) => {
  try {
    const role = String(req.body.role ?? '').trim();
    const name = String(req.body.name ?? '').trim();
    const studentNumber = String(
      req.body.student_number ?? ''
    ).trim();
    const password = String(req.body.password ?? '');

    if (!role || !password) {
      flash(
        req,
        'error',
        'Please enter your login information.'
      );
      return res.redirect('/');
    }

    let users;

    if (role === 'admin') {
      [users] = await pool.query(
        `
        SELECT
          id,
          name,
          email,
          password_hash
        FROM users
        WHERE role = 'admin'
          AND LOWER(name) = LOWER(?)
          AND status = 'active'
        LIMIT 1
        `,
        [name]
      );
    } else if (role === 'librarian') {
      [users] = await pool.query(
        `
        SELECT
          id,
          name,
          email,
          password_hash
        FROM users
        WHERE role = 'librarian'
          AND LOWER(name) = LOWER(?)
          AND status = 'active'
        LIMIT 1
        `,
        [name]
      );
    } else if (role === 'student') {
      [users] = await pool.query(
        `
        SELECT
          id,
          name,
          email,
          password_hash,
          status
        FROM users
        WHERE role = 'student'
          AND student_number = ?
        LIMIT 1
        `,
        [studentNumber]
      );
    } else {
      flash(req, 'error', 'Invalid account type.');
      return res.redirect('/');
    }

    if (!users || users.length === 0) {
      flash(
        req,
        'error',
        'Invalid login credentials.'
      );
      return res.redirect('/');
    }

    const user = users[0];

    if (
      role === 'student' &&
      user.status !== 'active'
    ) {
      if (user.status === 'pending') {
        flash(
          req,
          'error',
          'Your registration is still waiting for admin approval.'
        );
      } else {
        flash(
          req,
          'error',
          'Your student account is not active.'
        );
      }

      return res.redirect('/');
    }

    const passwordValid = await bcrypt.compare(
      password,
      user.password_hash || ''
    );

    if (!passwordValid) {
      flash(
        req,
        'error',
        'Invalid login credentials.'
      );
      return res.redirect('/');
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role
    };

    if (role === 'admin') {
  return res.redirect('/admin/dashboard');
}

if (role === 'librarian') {
  return res.redirect('/librarian/dashboard');
}

return res.redirect('/student/dashboard');

    return res.redirect('/student');
  } catch (error) {
    console.error('Login error:', error);

    flash(
      req,
      'error',
      'Unable to process login.'
    );

    return res.redirect('/');
  }
});


// ==============================
// LOGOUT
// ==============================

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});


module.exports = router;