CREATE DATABASE IF NOT EXISTS library_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE library_system;

DROP TABLE IF EXISTS book_recommendations;
DROP TABLE IF EXISTS borrow_records;
DROP TABLE IF EXISTS books;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  role ENUM('admin','librarian','student') NOT NULL,
  student_number VARCHAR(40) NULL UNIQUE,
  school_id VARCHAR(60) NULL UNIQUE,
  school_year VARCHAR(20) NULL,
  course VARCHAR(120) NULL,
  year_level TINYINT UNSIGNED NULL,
  section VARCHAR(80) NULL,
  email VARCHAR(160) NULL,
  contact_number VARCHAR(40) NULL,
  status ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role),
  INDEX idx_users_name (name),
  INDEX idx_users_course_year (course, year_level),
  CONSTRAINT chk_student_profile CHECK (
    role <> 'student' OR (student_number IS NOT NULL AND school_id IS NOT NULL AND course IS NOT NULL AND year_level IS NOT NULL AND section IS NOT NULL)
  )
) ENGINE=InnoDB;

CREATE TABLE books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  book_code VARCHAR(40) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  author VARCHAR(160) NOT NULL,
  isbn VARCHAR(40) NULL UNIQUE,
  category VARCHAR(100) NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  available_quantity INT UNSIGNED NOT NULL DEFAULT 1,
  cover_url VARCHAR(500) NULL,
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_books_title (title),
  INDEX idx_books_category (category),
  CONSTRAINT chk_book_stock CHECK (available_quantity <= quantity)
) ENGINE=InnoDB;

CREATE TABLE book_recommendations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  book_id INT NOT NULL,
  course VARCHAR(120) NOT NULL,
  year_level TINYINT UNSIGNED NOT NULL,
  priority TINYINT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_recommendation (book_id, course, year_level),
  INDEX idx_recommendation_course_year (course, year_level),
  FOREIGN KEY (book_id) REFERENCES books(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE borrow_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  book_id INT NOT NULL,
  student_id INT NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  return_date DATE NULL,
  status ENUM('borrowed','returned','overdue') NOT NULL DEFAULT 'borrowed',
  late_days INT UNSIGNED NOT NULL DEFAULT 0,
  notes VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (student_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_borrow_student (student_id),
  INDEX idx_borrow_book (book_id),
  INDEX idx_borrow_status (status),
  INDEX idx_borrow_due_date (due_date)
) ENGINE=InnoDB;
