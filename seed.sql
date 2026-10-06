USE library_system;

INSERT INTO users (name, role, student_number, school_id, school_year, course, year_level, section, email, contact_number, status) VALUES
('System Administrator', 'admin', NULL, NULL, NULL, NULL, NULL, NULL, 'admin@library.local', '09170000000', 'active'),
('Maria Santos', 'librarian', NULL, NULL, NULL, NULL, NULL, NULL, 'maria@library.local', '09171111111', 'active'),
('Juan Dela Cruz', 'student', '2024-0001', 'SID-2026-0001', '2026-2027', 'BS Information Technology', 1, 'A', 'juan@example.com', '09172222222', 'active'),
('Ana Reyes', 'student', '2024-0002', 'SID-2026-0002', '2026-2027', 'BS Computer Science', 2, 'B', 'ana@example.com', '09173333333', 'active'),
('Miguel Garcia', 'student', '2024-0003', 'SID-2026-0003', '2026-2027', 'BS Information Technology', 1, 'A', 'miguel@example.com', '09174444444', 'active');

INSERT INTO books (book_code, title, author, isbn, category, quantity, available_quantity, description) VALUES
('IT-001', 'Introduction to Programming', 'John Doe', '9780000000011', 'Programming', 4, 3, 'A beginner-friendly introduction to programming concepts and problem solving.'),
('IT-002', 'Understanding the C Language', 'Jane Smith', '9780000000028', 'Programming', 3, 2, 'Core C language concepts, syntax, functions, arrays, pointers, and practice problems.'),
('CS-001', 'Data Structures and Algorithms', 'Robert Martin', '9780000000035', 'Computer Science', 3, 3, 'Foundations of data structures and algorithmic thinking.'),
('GEN-001', 'College Study Skills', 'Alex Brown', '9780000000042', 'General', 5, 5, 'Practical study strategies for college students.');

INSERT INTO borrow_records (book_id, student_id, issue_date, due_date, status, late_days, notes)
SELECT b.id, u.id, DATE_SUB(CURDATE(), INTERVAL 4 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'overdue', 1, 'Seeded overdue example'
FROM books b JOIN users u ON b.book_code='IT-001' AND u.student_number='2024-0001';

INSERT INTO book_recommendations (book_id, course, year_level, priority)
SELECT id, 'BS Information Technology', 1, 1 FROM books WHERE book_code='IT-001';
INSERT INTO book_recommendations (book_id, course, year_level, priority)
SELECT id, 'BS Information Technology', 1, 2 FROM books WHERE book_code='IT-002';
INSERT INTO book_recommendations (book_id, course, year_level, priority)
SELECT id, 'BS Computer Science', 2, 1 FROM books WHERE book_code='CS-001';
INSERT INTO book_recommendations (book_id, course, year_level, priority)
SELECT id, 'BS Computer Science', 2, 2 FROM books WHERE book_code='GEN-001';
