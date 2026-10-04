-- RepairBench - Laptop Repair Management System
CREATE DATABASE IF NOT EXISTS laptop_repair_db;
USE laptop_repair_db;

CREATE TABLE IF NOT EXISTS Customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    address VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Devices (
    device_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    model VARCHAR(100) NOT NULL,
    serial_number VARCHAR(100),
    purchase_date DATE,
    FOREIGN KEY (customer_id) REFERENCES Customers(customer_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS RepairJobs (
    job_id INT AUTO_INCREMENT PRIMARY KEY,
    device_id INT NOT NULL,
    issue_description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'Received',
    category VARCHAR(50) DEFAULT 'Other',
    priority VARCHAR(20) DEFAULT 'Normal',
    date_reported DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_completed DATETIME,
    estimated_completion DATE,
    estimated_cost DECIMAL(10,2),
    actual_cost DECIMAL(10,2),
    notes TEXT,
    FOREIGN KEY (device_id) REFERENCES Devices(device_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Technicians (
    tech_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    specialization VARCHAR(100),
    phone VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS JobAssignments (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    tech_id INT NOT NULL,
    hours_spent DECIMAL(5,2),
    notes VARCHAR(255),
    assigned_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES RepairJobs(job_id) ON DELETE CASCADE,
    FOREIGN KEY (tech_id) REFERENCES Technicians(tech_id)
);

CREATE TABLE IF NOT EXISTS RepairStatusHistory (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    remarks VARCHAR(255),
    changed_by VARCHAR(100) DEFAULT 'Admin',
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES RepairJobs(job_id) ON DELETE CASCADE
);

INSERT INTO Technicians (name, specialization, phone)
SELECT 'Vikram Sharma', 'Hardware Repair', '9111111111'
WHERE NOT EXISTS (SELECT 1 FROM Technicians WHERE name = 'Vikram Sharma');
INSERT INTO Technicians (name, specialization, phone)
SELECT 'Neha Gupta', 'Software Issues', '9222222222'
WHERE NOT EXISTS (SELECT 1 FROM Technicians WHERE name = 'Neha Gupta');
INSERT INTO Technicians (name, specialization, phone)
SELECT 'Rohit Verma', 'Network Setup', '9333333333'
WHERE NOT EXISTS (SELECT 1 FROM Technicians WHERE name = 'Rohit Verma');

CREATE TABLE IF NOT EXISTS CustomerAuth (
    customer_id INT PRIMARY KEY,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    FOREIGN KEY (customer_id) REFERENCES Customers(customer_id) ON DELETE CASCADE
);
