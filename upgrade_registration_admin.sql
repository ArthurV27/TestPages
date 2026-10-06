-- Run this file ONLY if you already have the original Library System database.
-- It preserves existing books, students, and borrowing records while adding
-- Admin + registration + course/year recommendation support.
USE library_system;

ALTER TABLE users MODIFY role ENUM('admin','librarian','student') NOT NULL;
ALTER TABLE users ADD COLUMN school_id VARCHAR(60) NULL AFTER student_number;
ALTER TABLE users ADD COLUMN school_year VARCHAR(20) NULL AFTER school_id;
ALTER TABLE users ADD COLUMN course VARCHAR(120) NULL AFTER school_year;
ALTER TABLE users ADD COLUMN year_level TINYINT UNSIGNED NULL AFTER course;
ALTER TABLE users ADD COLUMN section VARCHAR(80) NULL AFTER year_level;
ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;
ALTER TABLE users ADD UNIQUE KEY uq_users_school_id (school_id);
ALTER TABLE users ADD INDEX idx_users_course_year (course, year_level);

CREATE TABLE IF NOT EXISTS book_recommendations (
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

INSERT INTO users (name, role, email, contact_number, status)
SELECT 'System Administrator', 'admin', 'admin@library.local', '09170000000', 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE role='admin');

-- Fill the new academic fields for the original seeded students if they exist.
UPDATE users SET school_id='SID-2026-0001', school_year='2026-2027', course='BS Information Technology', year_level=1, section='A'
WHERE student_number='2024-0001' AND role='student' AND school_id IS NULL;
UPDATE users SET school_id='SID-2026-0002', school_year='2026-2027', course='BS Computer Science', year_level=2, section='B'
WHERE student_number='2024-0002' AND role='student' AND school_id IS NULL;
UPDATE users SET school_id='SID-2026-0003', school_year='2026-2027', course='BS Information Technology', year_level=1, section='A'
WHERE student_number='2024-0003' AND role='student' AND school_id IS NULL;

-- Seed the requested example recommendations when the matching books exist.
INSERT IGNORE INTO book_recommendations (book_id, course, year_level, priority)
SELECT id, 'BS Information Technology', 1, 1 FROM books WHERE title='Introduction to Programming' LIMIT 1;
INSERT IGNORE INTO book_recommendations (book_id, course, year_level, priority)
SELECT id, 'BS Information Technology', 1, 2 FROM books WHERE title='Understanding the C Language' LIMIT 1;
