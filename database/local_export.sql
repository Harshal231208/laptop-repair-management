-- MySQL dump 10.13  Distrib 8.4.11, for Linux (x86_64)
--
-- Host: localhost    Database: laptop_repair_db
-- ------------------------------------------------------
-- Server version	8.4.11

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `Customers`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Customers` (
  `customer_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`customer_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Customers`
--

LOCK TABLES `Customers` WRITE;
/*!40000 ALTER TABLE `Customers` DISABLE KEYS */;
INSERT INTO `Customers` VALUES (1,'Rajesh Kumar','rajesh@email.com','9876543210','Pune','2026-09-18 15:53:27'),(2,'Priya Singh','priya@email.com','9876543211','Mumbai','2026-09-18 15:53:27'),(3,'Amit Patel','amit@email.com','9876543212','Bangalore','2026-09-18 15:53:27'),(4,'Harshal Borate','harshalborate42@gmail.com','8530506023',NULL,'2026-09-20 06:43:29');
/*!40000 ALTER TABLE `Customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Devices`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Devices` (
  `device_id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `model` varchar(100) NOT NULL,
  `serial_number` varchar(100) DEFAULT NULL,
  `purchase_date` date DEFAULT NULL,
  PRIMARY KEY (`device_id`),
  KEY `customer_id` (`customer_id`),
  CONSTRAINT `Devices_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `Customers` (`customer_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Devices`
--

LOCK TABLES `Devices` WRITE;
/*!40000 ALTER TABLE `Devices` DISABLE KEYS */;
INSERT INTO `Devices` VALUES (1,4,'Dell Inspiron 15',NULL,NULL),(2,4,'Dell Inspiron 15',NULL,NULL),(3,4,'bgubujghnbujnbu',NULL,NULL),(4,4,'Dell Inspiron 15',NULL,NULL);
/*!40000 ALTER TABLE `Devices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `JobAssignments`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `JobAssignments` (
  `assignment_id` int NOT NULL AUTO_INCREMENT,
  `job_id` int NOT NULL,
  `tech_id` int NOT NULL,
  `hours_spent` decimal(5,2) DEFAULT NULL,
  `assigned_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `notes` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`assignment_id`),
  KEY `job_id` (`job_id`),
  KEY `tech_id` (`tech_id`),
  CONSTRAINT `JobAssignments_ibfk_1` FOREIGN KEY (`job_id`) REFERENCES `RepairJobs` (`job_id`) ON DELETE CASCADE,
  CONSTRAINT `JobAssignments_ibfk_2` FOREIGN KEY (`tech_id`) REFERENCES `Technicians` (`tech_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `JobAssignments`
--

LOCK TABLES `JobAssignments` WRITE;
/*!40000 ALTER TABLE `JobAssignments` DISABLE KEYS */;
INSERT INTO `JobAssignments` VALUES (2,4,1,NULL,'2026-09-27 17:44:09',NULL);
/*!40000 ALTER TABLE `JobAssignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `RepairJobs`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `RepairJobs` (
  `job_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `issue_description` text NOT NULL,
  `status` varchar(50) DEFAULT 'Pending',
  `date_reported` datetime DEFAULT CURRENT_TIMESTAMP,
  `date_completed` datetime DEFAULT NULL,
  `estimated_cost` decimal(10,2) DEFAULT NULL,
  `actual_cost` decimal(10,2) DEFAULT NULL,
  `category` varchar(50) DEFAULT 'Other',
  `priority` varchar(20) DEFAULT 'Normal',
  `estimated_completion` date DEFAULT NULL,
  `notes` text,
  PRIMARY KEY (`job_id`),
  KEY `device_id` (`device_id`),
  CONSTRAINT `RepairJobs_ibfk_1` FOREIGN KEY (`device_id`) REFERENCES `Devices` (`device_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `RepairJobs`
--

LOCK TABLES `RepairJobs` WRITE;
/*!40000 ALTER TABLE `RepairJobs` DISABLE KEYS */;
INSERT INTO `RepairJobs` VALUES (1,1,'SCREEN FLICKERING','Received','2026-09-20 12:13:29',NULL,NULL,NULL,'Display','Urgent',NULL,NULL),(4,4,'na','Repairing','2026-09-27 17:43:47',NULL,10000.00,15000.00,'Display','Normal',NULL,NULL);
/*!40000 ALTER TABLE `RepairJobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `RepairStatusHistory`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `RepairStatusHistory` (
  `history_id` int NOT NULL AUTO_INCREMENT,
  `job_id` int NOT NULL,
  `old_status` varchar(50) DEFAULT NULL,
  `new_status` varchar(50) NOT NULL,
  `remarks` varchar(255) DEFAULT NULL,
  `changed_by` varchar(100) DEFAULT 'Admin',
  `changed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`history_id`),
  KEY `job_id` (`job_id`),
  CONSTRAINT `RepairStatusHistory_ibfk_1` FOREIGN KEY (`job_id`) REFERENCES `RepairJobs` (`job_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `RepairStatusHistory`
--

LOCK TABLES `RepairStatusHistory` WRITE;
/*!40000 ALTER TABLE `RepairStatusHistory` DISABLE KEYS */;
INSERT INTO `RepairStatusHistory` VALUES (2,1,'Pending','Received','Updated from admin dashboard','Admin','2026-09-27 11:18:00'),(5,4,NULL,'Received','Ticket created','Customer','2026-09-27 12:13:47'),(6,4,'Received','Received','Updated from admin dashboard','Admin','2026-09-27 12:14:09'),(7,4,'Received','Repairing','Updated from admin dashboard','Admin','2026-09-27 12:14:20'),(8,4,'Repairing','Repairing','Updated from admin dashboard','Admin','2026-09-27 12:14:34'),(9,4,'Repairing','Repairing','Updated from admin dashboard','Admin','2026-09-27 12:15:05');
/*!40000 ALTER TABLE `RepairStatusHistory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Technicians`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Technicians` (
  `tech_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `specialization` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`tech_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Technicians`
--

LOCK TABLES `Technicians` WRITE;
/*!40000 ALTER TABLE `Technicians` DISABLE KEYS */;
INSERT INTO `Technicians` VALUES (1,'Vikram Sharma','Hardware Repair','9111111111'),(2,'Neha Gupta','Software Issues','9222222222'),(3,'Rohit Verma','Network Setup','9333333333');
/*!40000 ALTER TABLE `Technicians` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-03 21:00:35
