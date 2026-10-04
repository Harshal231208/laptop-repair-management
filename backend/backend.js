const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const fs = require('fs');
const crypto = require('crypto');


const envPath = __dirname + '/.env';
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    });
}

const app = express();
const PORT = Number(process.env.PORT || 5000);
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const adminSessions = new Map();
const customerSessions = new Map();

const FRONTEND_ORIGINS = [
    'http://localhost:5500',
    'http://127.0.0.1:5502',
    'https://super-cheesecake-37f16d.netlify.app',
    'https://laptop-repair-management.netlify.app'
];

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'laptop_repair_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true
});

if (!process.env.DB_PASSWORD) {
    console.warn('Warning: DB_PASSWORD is not set. Add it to backend/.env before starting the server.');
}

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || FRONTEND_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());

const VALID_STATUSES = ['Received', 'Diagnosing', 'Waiting for Approval', 'Repairing', 'Ready for Pickup', 'Completed', 'Cancelled'];
const VALID_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];
const VALID_CATEGORIES = ['Hardware', 'Software', 'Display', 'Battery', 'Charging', 'Storage', 'Memory', 'Keyboard', 'Network', 'Operating System', 'Other'];

function normaliseNumber(value) {
    if (value === '' || value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
}


function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
    try {
        const [salt, hash] = String(storedHash || '').split(':');
        if (!salt || !hash) return false;
        const derived = crypto.scryptSync(password, salt, 64).toString('hex');
        return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
    } catch {
        return false;
    }
}

function customerAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const session = token ? customerSessions.get(token) : null;

    if (!session) {
        return res.status(401).json({ error: 'Customer authentication required.' });
    }

    if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
        customerSessions.delete(token);
        return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }

    req.customer = { customerId: session.customerId, email: session.email, token };
    next();
}

function adminAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const session = token ? adminSessions.get(token) : null;

    if (!session) {
        return res.status(401).json({ error: 'Admin authentication required.' });
    }

    if (Date.now() - session.createdAt > 8 * 60 * 60 * 1000) {
        adminSessions.delete(token);
        return res.status(401).json({ error: 'Admin session expired. Please sign in again.' });
    }

    req.admin = { username: session.username, token };
    next();
}

function escapeXml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function jobToXml(job) {
    const history = Array.isArray(job.history) ? job.history : [];
    return `<?xml version="1.0" encoding="UTF-8"?>
<repairJob>
  <jobId>${escapeXml(job.job_id)}</jobId>
  <status>${escapeXml(job.status)}</status>
  <priority>${escapeXml(job.priority || 'Normal')}</priority>
  <category>${escapeXml(job.category || 'Other')}</category>
  <dateReported>${escapeXml(job.date_reported)}</dateReported>
  <estimatedCompletion>${escapeXml(job.estimated_completion || '')}</estimatedCompletion>
  <estimatedCost>${escapeXml(job.estimated_cost ?? '')}</estimatedCost>
  <actualCost>${escapeXml(job.actual_cost ?? '')}</actualCost>
  <customer>
    <name>${escapeXml(job.customer_name)}</name>
    <email>${escapeXml(job.email)}</email>
    <phone>${escapeXml(job.phone)}</phone>
  </customer>
  <device>
    <model>${escapeXml(job.model)}</model>
    <serialNumber>${escapeXml(job.serial_number)}</serialNumber>
  </device>
  <repair>
    <issueDescription>${escapeXml(job.issue_description)}</issueDescription>
    <notes>${escapeXml(job.notes)}</notes>
    <technician>${escapeXml(job.technician_name || '')}</technician>
  </repair>
  <history>
${history.map(h => `    <event>
      <oldStatus>${escapeXml(h.old_status || '')}</oldStatus>
      <newStatus>${escapeXml(h.new_status)}</newStatus>
      <remarks>${escapeXml(h.remarks || '')}</remarks>
      <changedBy>${escapeXml(h.changed_by || '')}</changedBy>
      <changedAt>${escapeXml(h.changed_at)}</changedAt>
    </event>`).join('\n')}
  </history>
</repairJob>`;
}

async function ensureSchema() {
    const connection = await pool.getConnection();
    try {
        const additions = [
            ['RepairJobs', 'category', "VARCHAR(50) DEFAULT 'Other'"],
            ['RepairJobs', 'priority', "VARCHAR(20) DEFAULT 'Normal'"],
            ['RepairJobs', 'estimated_completion', 'DATE NULL'],
            ['RepairJobs', 'notes', 'TEXT NULL'],
            ['JobAssignments', 'notes', 'VARCHAR(255) NULL']
        ];

        for (const [table, column, definition] of additions) {
            const [rows] = await connection.query(
                `SELECT COUNT(*) AS count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                [table, column]
            );
            if (rows[0].count === 0) {
                await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
            }
        }

        await connection.query(`
            CREATE TABLE IF NOT EXISTS CustomerAuth (
                customer_id INT PRIMARY KEY,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP NULL,
                FOREIGN KEY (customer_id) REFERENCES Customers(customer_id) ON DELETE CASCADE
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS RepairStatusHistory (
                history_id INT AUTO_INCREMENT PRIMARY KEY,
                job_id INT NOT NULL,
                old_status VARCHAR(50),
                new_status VARCHAR(50) NOT NULL,
                remarks VARCHAR(255),
                changed_by VARCHAR(100) DEFAULT 'Admin',
                changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (job_id) REFERENCES RepairJobs(job_id) ON DELETE CASCADE
            )
        `);
    } finally {
        connection.release();
    }
}

app.get('/api/test', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ message: 'Database connected successfully!' });
    } catch (error) {
        res.status(500).json({ error: 'Database connection failed: ' + error.message });
    }
});

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body || {};

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Incorrect username or password.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    adminSessions.set(token, { username, createdAt: Date.now() });

    res.json({
        message: 'Login successful.',
        token,
        username
    });
});

app.post('/api/customer/register', async (req, res) => {
    const { name, email, phone, password } = req.body || {};
    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPhone = String(phone || '').trim();

    if (!cleanName || !cleanEmail || !password) {
        return res.status(400).json({ error: 'Name, email and password are required.' });
    }
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (String(password).length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [customers] = await connection.query('SELECT customer_id FROM Customers WHERE LOWER(email) = LOWER(?) LIMIT 1', [cleanEmail]);
        let customerId;

        if (customers.length) {
            customerId = customers[0].customer_id;
            const [accounts] = await connection.query('SELECT customer_id FROM CustomerAuth WHERE customer_id = ?', [customerId]);
            if (accounts.length) {
                await connection.rollback();
                return res.status(409).json({ error: 'An account already exists for this email.' });
            }
            await connection.query('UPDATE Customers SET name = ?, phone = ? WHERE customer_id = ?', [cleanName, cleanPhone || null, customerId]);
        } else {
            const [result] = await connection.query(
                'INSERT INTO Customers (name, email, phone) VALUES (?, ?, ?)',
                [cleanName, cleanEmail, cleanPhone || null]
            );
            customerId = result.insertId;
        }

        await connection.query('INSERT INTO CustomerAuth (customer_id, password_hash) VALUES (?, ?)', [customerId, hashPassword(String(password))]);
        await connection.commit();
        res.status(201).json({ message: 'Account created successfully. You can now sign in.' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

app.post('/api/customer/login', async (req, res) => {
    const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!cleanEmail || !password) return res.status(400).json({ error: 'Email and password are required.' });

    try {
        const [rows] = await pool.query(`
            SELECT c.customer_id, c.name, c.email, c.phone, a.password_hash
            FROM Customers c
            JOIN CustomerAuth a ON a.customer_id = c.customer_id
            WHERE LOWER(c.email) = LOWER(?) LIMIT 1
        `, [cleanEmail]);

        if (!rows.length || !verifyPassword(password, rows[0].password_hash)) {
            return res.status(401).json({ error: 'Incorrect email or password.' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        customerSessions.set(token, { customerId: rows[0].customer_id, email: rows[0].email, createdAt: Date.now() });
        await pool.query('UPDATE CustomerAuth SET last_login = CURRENT_TIMESTAMP WHERE customer_id = ?', [rows[0].customer_id]);

        res.json({ message: 'Login successful.', token, customer: { customerId: rows[0].customer_id, name: rows[0].name, email: rows[0].email, phone: rows[0].phone } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/customer/logout', customerAuth, (req, res) => {
    customerSessions.delete(req.customer.token);
    res.json({ message: 'Logged out successfully.' });
});

app.get('/api/customer/me', customerAuth, async (req, res) => {
    try {
        const [[customer]] = await pool.query('SELECT customer_id, name, email, phone, address, created_at FROM Customers WHERE customer_id = ?', [req.customer.customerId]);
        if (!customer) return res.status(404).json({ error: 'Customer account not found.' });
        res.json(customer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/customer/repairs', customerAuth, async (req, res) => {
    try {
        const [jobs] = await pool.query(`
            SELECT rj.job_id, rj.status, rj.category, rj.priority, rj.date_reported, rj.date_completed,
                   rj.estimated_completion, rj.estimated_cost, rj.actual_cost, rj.issue_description,
                   d.model, d.serial_number, t.name AS technician_name
            FROM RepairJobs rj
            JOIN Devices d ON rj.device_id = d.device_id
            LEFT JOIN JobAssignments ja ON rj.job_id = ja.job_id
            LEFT JOIN Technicians t ON ja.tech_id = t.tech_id
            WHERE d.customer_id = ?
            ORDER BY rj.date_reported DESC
        `, [req.customer.customerId]);
        res.json(jobs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/logout', adminAuth, (req, res) => {
    adminSessions.delete(req.admin.token);
    res.json({ message: 'Logged out successfully.' });
});

app.get('/api/admin/dashboard', adminAuth, async (req, res) => {
    try {
        const [[counts]] = await pool.query(`
            SELECT
                COUNT(*) AS total,
                SUM(status IN ('Received', 'Diagnosing', 'Waiting for Approval')) AS pending,
                SUM(status = 'Repairing') AS repairing,
                SUM(status = 'Ready for Pickup') AS ready,
                SUM(status = 'Completed') AS completed,
                SUM(status = 'Cancelled') AS cancelled,
                COALESCE(SUM(actual_cost), 0) AS revenue,
                ROUND(AVG(CASE WHEN date_completed IS NOT NULL THEN TIMESTAMPDIFF(HOUR, date_reported, date_completed) END), 1) AS avg_repair_hours
            FROM RepairJobs
        `);
        const [categories] = await pool.query(`SELECT COALESCE(category, 'Other') AS category, COUNT(*) AS count FROM RepairJobs GROUP BY category ORDER BY count DESC`);
        const [recent] = await pool.query(`
            SELECT rj.job_id, rj.status, rj.priority, rj.category, rj.date_reported, d.model, c.name AS customer_name
            FROM RepairJobs rj
            JOIN Devices d ON rj.device_id = d.device_id
            JOIN Customers c ON d.customer_id = c.customer_id
            ORDER BY rj.date_reported DESC LIMIT 6
        `);
        res.json({ counts, categories, recent });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/technicians', adminAuth, async (req, res) => {
    try {
        const [technicians] = await pool.query(`
            SELECT t.*, COUNT(ja.assignment_id) AS active_jobs
            FROM Technicians t
            LEFT JOIN JobAssignments ja ON t.tech_id = ja.tech_id
            LEFT JOIN RepairJobs rj ON ja.job_id = rj.job_id AND rj.status NOT IN ('Completed', 'Cancelled')
            GROUP BY t.tech_id
            ORDER BY t.name
        `);
        res.json(technicians);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/repair-jobs', adminAuth, async (req, res) => {
    try {
        const [jobs] = await pool.query(`
            SELECT rj.*, d.model, d.serial_number, c.name AS customer_name, c.email, c.phone,
                   t.tech_id, t.name AS technician_name, t.specialization,
                   ja.hours_spent, ja.notes AS assignment_notes
            FROM RepairJobs rj
            JOIN Devices d ON rj.device_id = d.device_id
            JOIN Customers c ON d.customer_id = c.customer_id
            LEFT JOIN JobAssignments ja ON rj.job_id = ja.job_id
            LEFT JOIN Technicians t ON ja.tech_id = t.tech_id
            ORDER BY rj.date_reported DESC
        `);
        res.json(jobs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/repair-jobs/:jobId/xml', adminAuth, async (req, res) => {
    try {
        const [job] = await pool.query(`
            SELECT rj.*, d.model, d.serial_number, c.name AS customer_name, c.email, c.phone,
                   t.name AS technician_name, t.specialization
            FROM RepairJobs rj
            JOIN Devices d ON rj.device_id = d.device_id
            JOIN Customers c ON d.customer_id = c.customer_id
            LEFT JOIN JobAssignments ja ON rj.job_id = ja.job_id
            LEFT JOIN Technicians t ON ja.tech_id = t.tech_id
            WHERE rj.job_id = ?
        `, [req.params.jobId]);

        if (!job.length) return res.status(404).json({ error: 'Job not found.' });

        const [history] = await pool.query(
            'SELECT * FROM RepairStatusHistory WHERE job_id = ? ORDER BY changed_at ASC',
            [req.params.jobId]
        );

        const xml = jobToXml({ ...job[0], history });
        res.type('application/xml')
            .set('Content-Disposition', `attachment; filename="repair-job-${req.params.jobId}.xml"`)
            .send(xml);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/api/admin/repair-jobs/:jobId', adminAuth, async (req, res) => {
    try {
        const [job] = await pool.query(`
            SELECT rj.*, d.model, d.serial_number, c.name AS customer_name, c.email, c.phone,
                   t.tech_id, t.name AS technician_name, t.specialization,
                   ja.hours_spent, ja.notes AS assignment_notes
            FROM RepairJobs rj
            JOIN Devices d ON rj.device_id = d.device_id
            JOIN Customers c ON d.customer_id = c.customer_id
            LEFT JOIN JobAssignments ja ON rj.job_id = ja.job_id
            LEFT JOIN Technicians t ON ja.tech_id = t.tech_id
            WHERE rj.job_id = ?
        `, [req.params.jobId]);

        if (!job.length) return res.status(404).json({ error: 'Job not found.' });

        const [history] = await pool.query(
            'SELECT * FROM RepairStatusHistory WHERE job_id = ? ORDER BY changed_at ASC',
            [req.params.jobId]
        );

        res.json({ ...job[0], history });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.get('/api/dashboard', async (req, res) => {
    try {
        const [[counts]] = await pool.query(`
            SELECT
                COUNT(*) AS total,
                SUM(status IN ('Received', 'Diagnosing', 'Waiting for Approval')) AS pending,
                SUM(status = 'Repairing') AS repairing,
                SUM(status = 'Ready for Pickup') AS ready,
                SUM(status = 'Completed') AS completed,
                SUM(status = 'Cancelled') AS cancelled,
                COALESCE(SUM(actual_cost), 0) AS revenue,
                ROUND(AVG(CASE WHEN date_completed IS NOT NULL THEN TIMESTAMPDIFF(HOUR, date_reported, date_completed) END), 1) AS avg_repair_hours
            FROM RepairJobs
        `);
        const [categories] = await pool.query(`SELECT COALESCE(category, 'Other') AS category, COUNT(*) AS count FROM RepairJobs GROUP BY category ORDER BY count DESC`);
        const [recent] = await pool.query(`
            SELECT rj.job_id, rj.status, rj.priority, rj.category, rj.date_reported, d.model, c.name AS customer_name
            FROM RepairJobs rj
            JOIN Devices d ON rj.device_id = d.device_id
            JOIN Customers c ON d.customer_id = c.customer_id
            ORDER BY rj.date_reported DESC LIMIT 6
        `);
        res.json({ counts, categories, recent });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/technicians', async (req, res) => {
    try {
        const [technicians] = await pool.query(`
            SELECT t.*, COUNT(ja.assignment_id) AS active_jobs
            FROM Technicians t
            LEFT JOIN JobAssignments ja ON t.tech_id = ja.tech_id
            LEFT JOIN RepairJobs rj ON ja.job_id = rj.job_id AND rj.status NOT IN ('Completed', 'Cancelled')
            GROUP BY t.tech_id
            ORDER BY t.name
        `);
        res.json(technicians);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/repair-jobs', async (req, res) => {
    try {
        const [jobs] = await pool.query(`
            SELECT rj.*, d.model, d.serial_number, c.name AS customer_name, c.email, c.phone,
                   t.tech_id, t.name AS technician_name, t.specialization
            FROM RepairJobs rj
            JOIN Devices d ON rj.device_id = d.device_id
            JOIN Customers c ON d.customer_id = c.customer_id
            LEFT JOIN JobAssignments ja ON rj.job_id = ja.job_id
            LEFT JOIN Technicians t ON ja.tech_id = t.tech_id
            ORDER BY rj.date_reported DESC
        `);
        res.json(jobs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/repair-jobs', async (req, res) => {
    const {
        customerName, customerEmail, customerPhone, deviceModel, serialNumber,
        issueDescription, category = 'Other', priority = 'Normal', estimatedCost, estimatedCompletion
    } = req.body;

    if (!customerName || !customerEmail || !deviceModel || !issueDescription) {
        return res.status(400).json({ error: 'Name, email, device model and issue description are required.' });
    }
    if (!VALID_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid repair category.' });
    if (!VALID_PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Invalid priority.' });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [customers] = await connection.query('SELECT customer_id FROM Customers WHERE email = ?', [customerEmail]);
        let customerId;
        if (customers.length) {
            customerId = customers[0].customer_id;
            await connection.query('UPDATE Customers SET name = ?, phone = ? WHERE customer_id = ?', [customerName, customerPhone || null, customerId]);
        } else {
            const [result] = await connection.query(
                'INSERT INTO Customers (name, email, phone) VALUES (?, ?, ?)',
                [customerName, customerEmail, customerPhone || null]
            );
            customerId = result.insertId;
        }

        const [deviceResult] = await connection.query(
            'INSERT INTO Devices (customer_id, model, serial_number) VALUES (?, ?, ?)',
            [customerId, deviceModel, serialNumber || null]
        );

        const [jobResult] = await connection.query(
            `INSERT INTO RepairJobs (device_id, issue_description, status, category, priority, estimated_cost, estimated_completion)
             VALUES (?, ?, 'Received', ?, ?, ?, ?)`,
            [deviceResult.insertId, issueDescription, category, priority, normaliseNumber(estimatedCost), estimatedCompletion || null]
        );

        await connection.query(
            'INSERT INTO RepairStatusHistory (job_id, old_status, new_status, remarks, changed_by) VALUES (?, ?, ?, ?, ?)',
            [jobResult.insertId, null, 'Received', 'Ticket created', 'Customer']
        );

        await connection.commit();
        res.status(201).json({ jobId: jobResult.insertId, message: 'Repair job created successfully.' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

app.get('/api/repair-jobs/lookup/:query', async (req, res) => {
    try {
        const query = decodeURIComponent(req.params.query).trim();
        const [jobs] = await pool.query(`
            SELECT rj.*, d.model, d.serial_number, c.name AS customer_name, c.email, c.phone,
                   t.name AS technician_name, t.specialization
            FROM RepairJobs rj
            JOIN Devices d ON rj.device_id = d.device_id
            JOIN Customers c ON d.customer_id = c.customer_id
            LEFT JOIN JobAssignments ja ON rj.job_id = ja.job_id
            LEFT JOIN Technicians t ON ja.tech_id = t.tech_id
            WHERE rj.job_id = ? OR LOWER(c.email) = LOWER(?)
            ORDER BY rj.date_reported DESC
        `, [query, query]);

        if (!jobs.length) return res.status(404).json({ error: 'No repair ticket found.' });
        const results = await Promise.all(jobs.map(async job => {
            const [history] = await pool.query('SELECT * FROM RepairStatusHistory WHERE job_id = ? ORDER BY changed_at ASC', [job.job_id]);
            return { ...job, history };
        }));
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/repair-jobs/:jobId', async (req, res) => {
    try {
        const [job] = await pool.query(`
            SELECT rj.*, d.model, d.serial_number, c.name AS customer_name, c.email, c.phone,
                   t.tech_id, t.name AS technician_name, t.specialization
            FROM RepairJobs rj
            JOIN Devices d ON rj.device_id = d.device_id
            JOIN Customers c ON d.customer_id = c.customer_id
            LEFT JOIN JobAssignments ja ON rj.job_id = ja.job_id
            LEFT JOIN Technicians t ON ja.tech_id = t.tech_id
            WHERE rj.job_id = ?
        `, [req.params.jobId]);
        if (!job.length) return res.status(404).json({ error: 'Job not found.' });

        const [history] = await pool.query(
            'SELECT * FROM RepairStatusHistory WHERE job_id = ? ORDER BY changed_at ASC',
            [req.params.jobId]
        );
        res.json({ ...job[0], history });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// Public endpoint: a customer may cancel their OWN pending/in-progress ticket.
// Deliberately NOT behind adminAuth — but it can only ever set status to
// 'Cancelled', and only from a non-final state, so it can't be used to do
// anything else an admin route can do.
app.put('/api/repair-jobs/:jobId/cancel', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.query('SELECT status FROM RepairJobs WHERE job_id = ?', [req.params.jobId]);
        if (!rows.length) { connection.release(); return res.status(404).json({ error: 'Ticket not found.' }); }

        const current = rows[0].status;
        if (['Completed', 'Cancelled'].includes(current)) {
            connection.release();
            return res.status(400).json({ error: `This ticket is already ${current.toLowerCase()} and cannot be cancelled.` });
        }

        await connection.beginTransaction();
        await connection.query('UPDATE RepairJobs SET status = ? WHERE job_id = ?', ['Cancelled', req.params.jobId]);
        await connection.query(
            'INSERT INTO RepairStatusHistory (job_id, old_status, new_status, remarks, changed_by) VALUES (?, ?, ?, ?, ?)',
            [req.params.jobId, current, 'Cancelled', 'Cancelled by customer', 'Customer']
        );
        await connection.commit();
        res.json({ message: 'Ticket cancelled.' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

app.put('/api/repair-jobs/:jobId', adminAuth, async (req, res) => {
    const { status, actual_cost, estimated_cost, priority, category, technician_id, hours_spent, remarks, estimated_completion, notes } = req.body;
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: `Invalid status. Use: ${VALID_STATUSES.join(', ')}` });
    if (priority && !VALID_PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Invalid priority.' });
    if (category && !VALID_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid category.' });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [currentRows] = await connection.query('SELECT status FROM RepairJobs WHERE job_id = ? FOR UPDATE', [req.params.jobId]);
        if (!currentRows.length) {
            await connection.rollback();
            return res.status(404).json({ error: 'Job not found.' });
        }
        const oldStatus = currentRows[0].status;
        const completedAt = status === 'Completed' ? 'NOW()' : 'NULL';

        await connection.query(
            `UPDATE RepairJobs SET status = ?, estimated_cost = COALESCE(?, estimated_cost), actual_cost = ?,
             priority = COALESCE(?, priority), category = COALESCE(?, category),
             estimated_completion = COALESCE(?, estimated_completion), notes = COALESCE(?, notes),
             date_completed = ${completedAt} WHERE job_id = ?`,
            [status, normaliseNumber(estimated_cost), normaliseNumber(actual_cost), priority || null, category || null, estimated_completion || null, notes || null, req.params.jobId]
        );

        if (oldStatus !== status || remarks) {
            await connection.query(
                'INSERT INTO RepairStatusHistory (job_id, old_status, new_status, remarks, changed_by) VALUES (?, ?, ?, ?, ?)',
                [req.params.jobId, oldStatus, status, remarks || null, 'Admin']
            );
        }

        if (Object.prototype.hasOwnProperty.call(req.body, 'technician_id')) {
            const [existing] = await connection.query(
                'SELECT assignment_id FROM JobAssignments WHERE job_id = ?',
                [req.params.jobId]
            );

            if (technician_id) {
                const [tech] = await connection.query(
                    'SELECT tech_id FROM Technicians WHERE tech_id = ?',
                    [technician_id]
                );
                if (!tech.length) throw new Error('Selected technician does not exist.');

                if (existing.length) {
                    await connection.query(
                        'UPDATE JobAssignments SET tech_id = ?, hours_spent = ? WHERE assignment_id = ?',
                        [technician_id, normaliseNumber(hours_spent), existing[0].assignment_id]
                    );
                } else {
                    await connection.query(
                        'INSERT INTO JobAssignments (job_id, tech_id, hours_spent) VALUES (?, ?, ?)',
                        [req.params.jobId, technician_id, normaliseNumber(hours_spent)]
                    );
                }
            } else if (existing.length) {
                await connection.query(
                    'DELETE FROM JobAssignments WHERE assignment_id = ?',
                    [existing[0].assignment_id]
                );
            }
        }

        await connection.commit();
        res.json({ message: 'Job updated successfully.' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

app.delete('/api/repair-jobs/:jobId', adminAuth, async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM RepairJobs WHERE job_id = ?', [req.params.jobId]);
        if (!result.affectedRows) return res.status(404).json({ error: 'Job not found.' });
        res.json({ message: 'Job deleted successfully.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

async function start() {
    try {
        await ensureSchema();
        app.listen(PORT, () => {
            console.log(`RepairBench API running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Startup failed:', error.message);
        process.exit(1);
    }
}

start();
