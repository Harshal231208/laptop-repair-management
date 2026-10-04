# RepairBench — Laptop Repair Management System

A responsive laptop repair management system using HTML/CSS/JavaScript, Node.js/Express and MySQL.

## Added in this version

- Management dashboard with repair statistics
- Multi-stage repair workflow
- Technician assignment and workload view
- Repair category and priority
- Serial number capture
- Estimated and actual repair cost
- Expected completion date
- Repair status history / timeline
- Customer ticket lookup by ticket number or email
- Transaction-safe ticket creation
- Input validation and dynamic HTML escaping
- Environment-based database configuration
- Automatic database migration for newly added columns/history table
- Responsive admin controls and mobile layout

## Setup

1. Make sure MySQL is running.
2. Create/update the database using `database/schema.sql`.
3. Copy `backend/.env.example` to `backend/.env` and set your MySQL password.
4. From the project root, install dependencies if `node_modules` is not present:

```bash
npm install
cd backend
npm install
```

5. Start the API:

```bash
node backend.js
```

6. Serve the `frontend` folder using VS Code Live Server or another static HTTP server. The default API CORS origin is `http://127.0.0.1:5502`; change `FRONTEND_ORIGIN` in `.env` if needed.

## Main pages

- `index.html` — public landing page
- `submit.html` — create a repair ticket
- `track.html` — customer tracking
- `jobs.html` — repair queue
- `admin.html` — management dashboard

## Important

The database password is intentionally not stored in source code. Do not commit `backend/.env` to Git.


## Admin setup

The admin panel now uses server-side session authentication.

1. Copy `backend/.env.example` to `backend/.env`.
2. Set your MySQL password in `DB_PASSWORD`.
3. Set `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
4. Start the API with `node backend.js`.
5. Open `frontend/admin-login.html` through Live Server.

The admin dashboard supports:
- protected admin login/logout
- dashboard statistics
- search and status/priority filtering
- technician assignment
- status, category, priority and cost updates
- ticket details and repair history
- printable repair receipt
- XML export
- job deletion with confirmation

Never commit `backend/.env` or real credentials to a public repository.
