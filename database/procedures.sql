-- =====================================================
-- RepairBench — Database Programming Objects
-- MySQL Stored Procedures / Functions / Triggers / Views
-- (MySQL has no PL/SQL — this is MySQL's own procedural
--  syntax, covering the same syllabus topics: procedures,
--  functions, triggers, cursors, exception handling,
--  views, and indexes.)
-- =====================================================

USE laptop_repair_db;

-- =====================================================
-- 1. VIEWS  (Unit IV — Advanced SQL: Performance Tuning)
-- =====================================================

-- Active jobs with customer, device and technician details joined in.
CREATE OR REPLACE VIEW vw_active_jobs AS
SELECT
    rj.job_id,
    rj.status,
    rj.priority,
    rj.category,
    rj.date_reported,
    c.name  AS customer_name,
    c.email AS customer_email,
    d.model AS device_model,
    t.name  AS technician_name
FROM RepairJobs rj
JOIN Devices d    ON rj.device_id = d.device_id
JOIN Customers c  ON d.customer_id = c.customer_id
LEFT JOIN JobAssignments ja ON rj.job_id = ja.job_id
LEFT JOIN Technicians t     ON ja.tech_id = t.tech_id
WHERE rj.status NOT IN ('Completed', 'Cancelled');

-- Technician workload summary.
CREATE OR REPLACE VIEW vw_technician_workload AS
SELECT
    t.tech_id,
    t.name,
    t.specialization,
    COUNT(ja.assignment_id) AS active_jobs,
    COALESCE(SUM(ja.hours_spent), 0) AS total_hours_logged
FROM Technicians t
LEFT JOIN JobAssignments ja ON t.tech_id = ja.tech_id
LEFT JOIN RepairJobs rj     ON ja.job_id = rj.job_id AND rj.status NOT IN ('Completed', 'Cancelled')
GROUP BY t.tech_id, t.name, t.specialization;


-- =====================================================
-- 2. INDEXES  (Unit IV)
-- =====================================================
-- Guarded with a procedure-free check so re-running the script doesn't error
-- if the index already exists (MySQL has no "CREATE INDEX IF NOT EXISTS").

SET @idx_exists := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'RepairJobs' AND INDEX_NAME = 'idx_repairjobs_status'
);
SET @sql := IF(@idx_exists = 0, 'CREATE INDEX idx_repairjobs_status ON RepairJobs(status)', 'SELECT "idx_repairjobs_status already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Customers' AND INDEX_NAME = 'idx_customers_email'
);
SET @sql := IF(@idx_exists = 0, 'CREATE UNIQUE INDEX idx_customers_email ON Customers(email)', 'SELECT "idx_customers_email already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'RepairJobs' AND INDEX_NAME = 'idx_repairjobs_device_status'
);
SET @sql := IF(@idx_exists = 0, 'CREATE INDEX idx_repairjobs_device_status ON RepairJobs(device_id, status)', 'SELECT "idx_repairjobs_device_status already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- NOTE on Sequences: MySQL has no CREATE SEQUENCE object (that exists in
-- Oracle/PostgreSQL/MariaDB, not standard MySQL). Every primary key here
-- already uses AUTO_INCREMENT, which is MySQL's built-in equivalent —
-- it generates the next unique ID automatically, the same role a sequence
-- would play.


-- =====================================================
-- 3. STORED PROCEDURE — create a repair job in one call
--    (Unit V — procedures, transactions)
-- =====================================================

DELIMITER $$

CREATE PROCEDURE sp_create_repair_job(
    IN  p_customer_name  VARCHAR(100),
    IN  p_customer_email VARCHAR(100),
    IN  p_customer_phone VARCHAR(20),
    IN  p_device_model   VARCHAR(100),
    IN  p_issue          TEXT,
    IN  p_category       VARCHAR(50),
    IN  p_priority       VARCHAR(20),
    OUT p_new_job_id      INT
)
BEGIN
    DECLARE v_customer_id INT;
    DECLARE v_device_id   INT;

    -- Exception handler: roll back cleanly instead of leaving a half-written job
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT customer_id INTO v_customer_id
    FROM Customers WHERE email = p_customer_email
    LIMIT 1;

    IF v_customer_id IS NULL THEN
        INSERT INTO Customers (name, email, phone)
        VALUES (p_customer_name, p_customer_email, p_customer_phone);
        SET v_customer_id = LAST_INSERT_ID();
    END IF;

    INSERT INTO Devices (customer_id, model)
    VALUES (v_customer_id, p_device_model);
    SET v_device_id = LAST_INSERT_ID();

    INSERT INTO RepairJobs (device_id, issue_description, status, category, priority)
    VALUES (v_device_id, p_issue, 'Received', p_category, p_priority);
    SET p_new_job_id = LAST_INSERT_ID();

    INSERT INTO RepairStatusHistory (job_id, old_status, new_status, remarks, changed_by)
    VALUES (p_new_job_id, NULL, 'Received', 'Ticket created', 'Customer');

    COMMIT;
END$$

DELIMITER ;

-- Example call:
-- CALL sp_create_repair_job('Test User','test@example.com','9999999999','HP Pavilion','Battery drains fast','Battery','Normal', @jid);
-- SELECT @jid;


-- =====================================================
-- 4. FUNCTION — average repair turnaround, in hours
--    (Unit V — functions)
-- =====================================================

DELIMITER $$

CREATE FUNCTION fn_average_repair_hours()
RETURNS DECIMAL(10,1)
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_avg DECIMAL(10,1);

    SELECT ROUND(AVG(TIMESTAMPDIFF(HOUR, date_reported, date_completed)), 1)
    INTO v_avg
    FROM RepairJobs
    WHERE date_completed IS NOT NULL;

    RETURN COALESCE(v_avg, 0);
END$$

DELIMITER ;

-- Example call:
-- SELECT fn_average_repair_hours();


-- =====================================================
-- 5. FUNCTION with CURSOR + exception handling
--    Counts how many technicians currently have zero active jobs.
--    (Demonstrates a cursor + a NOT FOUND handler, as the syllabus asks.)
-- =====================================================

DELIMITER $$

CREATE FUNCTION fn_idle_technician_count()
RETURNS INT
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_tech_id INT;
    DECLARE v_active_count INT;
    DECLARE v_idle_total INT DEFAULT 0;
    DECLARE v_done INT DEFAULT FALSE;

    DECLARE tech_cursor CURSOR FOR
        SELECT tech_id FROM Technicians;

    -- Cursor exhaustion handler
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;

    OPEN tech_cursor;

    read_loop: LOOP
        FETCH tech_cursor INTO v_tech_id;
        IF v_done THEN
            LEAVE read_loop;
        END IF;

        SELECT COUNT(*) INTO v_active_count
        FROM JobAssignments ja
        JOIN RepairJobs rj ON ja.job_id = rj.job_id
        WHERE ja.tech_id = v_tech_id
          AND rj.status NOT IN ('Completed', 'Cancelled');

        IF v_active_count = 0 THEN
            SET v_idle_total = v_idle_total + 1;
        END IF;
    END LOOP;

    CLOSE tech_cursor;

    RETURN v_idle_total;
END$$

DELIMITER ;

-- Example call:
-- SELECT fn_idle_technician_count();


-- =====================================================
-- 6. TRIGGER — auto-log every status change
--    (Unit V — triggers)
--    Your backend.js currently writes to RepairStatusHistory
--    manually in JS; this trigger makes the database itself
--    guarantee the log, even if a row is ever updated directly
--    in SQL (e.g. during grading/demo) without going through the API.
-- =====================================================

DELIMITER $$

CREATE TRIGGER trg_repairjobs_status_log
AFTER UPDATE ON RepairJobs
FOR EACH ROW
BEGIN
    IF OLD.status <> NEW.status THEN
        INSERT INTO RepairStatusHistory (job_id, old_status, new_status, remarks, changed_by)
        VALUES (NEW.job_id, OLD.status, NEW.status, 'Status changed via direct SQL update', 'System Trigger');
    END IF;
END$$

DELIMITER ;


-- =====================================================
-- 7. TRIGGER — prevent deleting a job that isn't Completed/Cancelled
--    (Unit V — triggers + data integrity; demonstrates SIGNAL for
--     a custom exception, another commonly-graded topic)
-- =====================================================

DELIMITER $$

CREATE TRIGGER trg_repairjobs_prevent_active_delete
BEFORE DELETE ON RepairJobs
FOR EACH ROW
BEGIN
    IF OLD.status NOT IN ('Completed', 'Cancelled') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot delete a repair job that is still active. Cancel it first.';
    END IF;
END$$

DELIMITER ;

-- =====================================================
-- Quick test block (optional — run manually to verify)
-- =====================================================
-- SELECT * FROM vw_active_jobs;
-- SELECT * FROM vw_technician_workload;
-- SELECT fn_average_repair_hours() AS avg_hours;
-- SELECT fn_idle_technician_count() AS idle_techs;
-- CALL sp_create_repair_job('Demo','demo@test.com','9000000000','Acer Aspire','Keyboard sticky','Keyboard','Low', @jid); SELECT @jid;
