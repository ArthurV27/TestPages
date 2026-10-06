# Library System — Express + MySQL

A lightweight, responsive web-based library system for a school/library demo. It uses **Node.js + Express + EJS + MySQL + vanilla JavaScript/CSS** and follows the requested usability principles: visible status, familiar terminology, user control, consistency, error prevention, recognition over recall, and efficient workflows.

## Features

### Librarian
- Demo login by name + any non-empty password
- Dashboard: total, available, borrowed, and overdue copies
- Book CRUD: add, edit, delete, stock management, duplicate prevention
- Student management: status changes and full borrowing history
- Issue/borrow transaction with future due-date validation and stock locking
- Return processing with automatic stock restoration and late-day calculation
- Dedicated overdue monitoring with student contact details
- Reports: inventory, borrowing/returning summary, browser print support, CSV export

### Admin
- Admin dashboard with system metrics
- Manage librarians and registered students
- Activate/deactivate user accounts
- Edit student academic profile and staff contact details
- Assign book recommendations by course + year level

### Student
- Public registration with School ID, Student Number, First/Last Name, Course, Year Level, Section, School Year, and optional contact details
- Login with name + student number
- Searchable/filterable catalog with availability badges and book details
- Borrow available books with future due date
- My Borrowed Books with due-date/overdue highlighting
- Dashboard alert for books due within 3 days or already overdue
- Borrowing history
- Profile update for name, email, and contact number
- Personalized dashboard recommendations based on course + year level

## Tech stack

- Node.js / Express
- EJS templates
- MySQL / mysql2 connection pool
- Vanilla JavaScript
- HTML5 / CSS3
- express-session for demo sessions
- dotenv for configuration

## 1. Requirements

Install these before starting:

1. **Node.js LTS** — verify with `node -v` and `npm -v`.
2. **MySQL Server** — verify the MySQL service is running.
3. **VS Code**.
4. Optional: Git and GitHub account for source control.

## 2. Open the project in VS Code

Open the `library-system` folder in VS Code.

Open the integrated terminal:

```bash
npm install
```

## 3. Configure MySQL

Create the database/tables using the included schema file.

### Option A — MySQL Workbench

1. Open MySQL Workbench.
2. Open `schema.sql`.
3. Run the entire script.
4. Open `seed.sql`.
5. Run the entire script.

### Option B — MySQL CLI

From the project folder:

```bash
mysql -u root -p < schema.sql
mysql -u root -p library_system < seed.sql
```

If your MySQL user has no password, omit `-p`.

### If you already installed the original version
Do **not** rerun `schema.sql` if you need to preserve your current data because the schema file intentionally recreates the tables for a clean setup. Instead run:

```bash
mysql -u root -p library_system < upgrade_registration_admin.sql
```

This migration adds the Admin role, student academic/School ID fields, and recommendation table while preserving existing books and borrowing records.

## 4. Configure environment variables

Copy `.env.example` to `.env`.

Example:

```env
DB_HOST=localhost
DB_USER=root
DB_PASS=your_mysql_password
DB_NAME=library_system
PORT=3000
SESSION_SECRET=replace_with_a_long_random_secret
```

Never commit `.env` to GitHub. It is already ignored by `.gitignore`.

## 5. Start the app

Development mode:

```bash
npm run dev
```

Or standard mode:

```bash
npm start
```

Open:

`http://localhost:3000`

## 6. Demo accounts

### Admin
- Name: `System Administrator`
- Password: any non-empty value

### Librarian
- Name: `Maria Santos`
- Password: any non-empty value

This intentionally matches the requested classroom/demo requirement. **Do not use this authentication approach in production.** Replace it with bcrypt password verification and stronger session/security configuration before deployment.

### Students
- `Juan Dela Cruz` / `2024-0001`
- `Ana Reyes` / `2024-0002`
- `Miguel Garcia` / `2024-0003`

### Registration
Open `/register` from the login page. A newly registered student is immediately active and can log in using their full name + student number. The current school year is configured in `config/catalog.js` as `2026-2027`.

### Recommendation example
A student registered as **BS Information Technology, 1st Year** can see **Introduction to Programming** and **Understanding the C Language** on the dashboard. Admins can change these mappings under **Recommendations**.

## 7. Suggested test flow

1. Log in as Maria Santos.
2. Open **Books** and search for `Clean Code`.
3. Edit or add a book.
4. Open **Students** and inspect Juan's activity.
5. Issue a book to a student with a future due date.
6. Open **Returns** and confirm the return.
7. Open **Overdue** to inspect the seeded overdue transaction.
8. Open **Reports** and export the CSV.
9. Sign out.
10. Log in as Juan Dela Cruz + `2024-0001`.
11. Search the catalog, borrow an available book, and inspect **My Borrowed** and **History**.
12. Update profile contact information.

## Project structure

```text
library-system/
├── config/
│   └── db.js
├── routes/
│   ├── admin.js
│   ├── auth.js
│   ├── librarian.js
│   ├── middleware.js
│   └── student.js
├── views/
│   ├── admin/
│   ├── partials/
│   │   ├── head.ejs
│   │   ├── layout-start.ejs
│   │   ├── layout-end.ejs
│   │   ├── nav.ejs
│   │   └── toast.ejs
│   ├── librarian/
│   ├── student/
│   ├── error.ejs
│   └── register.ejs
│   └── login.ejs
├── public/
│   ├── css/app.css
│   └── js/
├── schema.sql
├── seed.sql
├── upgrade_registration_admin.sql
├── config/catalog.js
├── server.js
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## Database notes

The `books.available_quantity` field is maintained whenever a transaction is issued or returned. Borrowing/returning uses MySQL transactions and row locks so concurrent requests cannot easily over-issue a copy.

`borrow_records.status` is one of `borrowed`, `overdue`, or `returned`. Overdue records are synchronized before dashboard/monitoring queries.

The schema intentionally uses foreign keys and unique constraints for book codes, ISBNs, and student numbers.

## Security notes before production

This project is designed as a lightweight academic/demo system. Before deploying publicly:

- Replace demo librarian authentication with bcrypt-hashed passwords.
- Add CSRF protection.
- Use a persistent session store instead of the default in-memory session store.
- Enable secure cookies behind HTTPS.
- Add rate limiting and login attempt protection.
- Add server-side validation libraries if the application grows.
- Add audit logging for destructive/admin operations.
- Store secrets only in environment variables or a secrets manager.
- Restrict CORS if an API/frontend is separated later.

## GitHub: first push

From the project root:

```bash
git init
git add .
git commit -m "Initial library system"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/library-system.git
git push -u origin main
```

Before `git add .`, verify that `.env` is not staged:

```bash
git status
```

The included `.gitignore` excludes `node_modules/` and `.env`.

### If you already accidentally committed `.env`

Remove it from Git tracking, rotate any exposed credentials, then commit the removal:

```bash
git rm --cached .env
git commit -m "Remove environment file from repository"
git push
```

For credentials that were already pushed publicly, assume they are compromised and change them immediately.

## Troubleshooting

### `ECONNREFUSED` / cannot connect to MySQL

- Ensure MySQL Server is running.
- Check `DB_HOST`, `DB_USER`, `DB_PASS`, and `DB_NAME` in `.env`.
- Confirm that `library_system` exists.

### `ER_NO_SUCH_TABLE`

Run `schema.sql`, then `seed.sql`.

### Port already in use

Change `PORT` in `.env`, for example:

```env
PORT=3001
```

Then visit `http://localhost:3001`.
