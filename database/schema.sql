-- =============================================================
-- Cloud-Based ERP System - MySQL Schema (Phase 1)
-- Engine: InnoDB (required for FK constraints + transactions)
-- Charset: utf8mb4 (full Unicode, incl. names in any language)
-- =============================================================

CREATE DATABASE IF NOT EXISTS erp_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE erp_db;

-- -------------------------------------------------------------
-- 1. roles: lookup table. Separate table (not an ENUM on users)
--    so roles can be extended without ALTER TABLE.
-- -------------------------------------------------------------
CREATE TABLE roles (
  id          TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(30) NOT NULL UNIQUE,   -- ADMIN, HR, MANAGER, EMPLOYEE
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 2. users: login accounts. Auth data only; job data lives in
--    employees (separation of concerns: a user is "who can log
--    in", an employee is "who works here").
-- -------------------------------------------------------------
CREATE TABLE users (
  id             INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name           VARCHAR(100) NOT NULL,
  email          VARCHAR(255) NOT NULL UNIQUE,      -- UNIQUE => index, used at login
  password_hash  VARCHAR(255) NOT NULL,             -- bcrypt output (~60 chars)
  role_id        TINYINT UNSIGNED NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,     -- soft-disable accounts
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 3. departments
-- -------------------------------------------------------------
CREATE TABLE departments (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL UNIQUE,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 4. employees: HR records. user_id is nullable because an
--    employee may exist before getting a login account.
-- -------------------------------------------------------------
CREATE TABLE employees (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id       INT UNSIGNED NULL UNIQUE,           -- 1:1 link to login account
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  department_id INT UNSIGNED NOT NULL,
  designation   VARCHAR(100) NOT NULL,
  joining_date  DATE NOT NULL,
  salary        DECIMAL(12,2) NOT NULL CHECK (salary >= 0),
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_emp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_emp_dept FOREIGN KEY (department_id) REFERENCES departments(id),
  INDEX idx_emp_department (department_id)          -- "employees per department" queries
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 5. categories
-- -------------------------------------------------------------
CREATE TABLE categories (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL UNIQUE,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 6. products: quantity CHECK >= 0 is the DB-level guarantee
--    against negative stock (app logic checks it too).
-- -------------------------------------------------------------
CREATE TABLE products (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name          VARCHAR(150) NOT NULL,
  sku           VARCHAR(50) NOT NULL UNIQUE,        -- business identifier, indexed via UNIQUE
  category_id   INT UNSIGNED NOT NULL,
  price         DECIMAL(10,2) NOT NULL CHECK (price >= 0),   -- DECIMAL, never FLOAT, for money
  quantity      INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reorder_level INT UNSIGNED NOT NULL DEFAULT 10,
  supplier      VARCHAR(150) NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,      -- soft delete: keep rows referenced by old orders
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_prod_category FOREIGN KEY (category_id) REFERENCES categories(id),
  INDEX idx_prod_category (category_id),            -- filter by category
  INDEX idx_prod_name (name)                        -- search by name
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 7. inventory_transactions: append-only history of every stock
--    movement. Answers "why is quantity X?" — audit trail.
-- -------------------------------------------------------------
CREATE TABLE inventory_transactions (
  id            BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  product_id    INT UNSIGNED NOT NULL,
  type          ENUM('IN','OUT') NOT NULL,
  quantity      INT UNSIGNED NOT NULL CHECK (quantity > 0),
  reference     VARCHAR(100) NULL,                  -- e.g. 'ORDER-15', 'PURCHASE', 'ADJUSTMENT'
  performed_by  INT UNSIGNED NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_invtx_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_invtx_user FOREIGN KEY (performed_by) REFERENCES users(id),
  INDEX idx_invtx_product_date (product_id, created_at)  -- per-product history, newest first
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 8. customers
-- -------------------------------------------------------------
CREATE TABLE customers (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(255) NULL,
  phone       VARCHAR(20) NULL,
  address     VARCHAR(255) NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cust_name (name)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 9. orders: money totals stored (not recomputed) so history is
--    stable even if product prices change later.
-- -------------------------------------------------------------
CREATE TABLE orders (
  id           INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  customer_id  INT UNSIGNED NOT NULL,
  created_by   INT UNSIGNED NOT NULL,               -- which user made the sale
  status       ENUM('PENDING','CONFIRMED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  subtotal     DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
  tax          DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount     DECIMAL(12,2) NOT NULL DEFAULT 0,
  grand_total  DECIMAL(12,2) NOT NULL CHECK (grand_total >= 0),
  order_date   DATE NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_order_user FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_order_date (order_date),                -- date-range sales reports
  INDEX idx_order_customer (customer_id)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 10. order_items: unit_price copied from products at sale time
--     (price snapshot) — historical invoices must not change.
-- -------------------------------------------------------------
CREATE TABLE order_items (
  id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  order_id    INT UNSIGNED NOT NULL,
  product_id  INT UNSIGNED NOT NULL,
  quantity    INT UNSIGNED NOT NULL CHECK (quantity > 0),
  unit_price  DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
  line_total  DECIMAL(12,2) NOT NULL CHECK (line_total >= 0),
  CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_oi_product FOREIGN KEY (product_id) REFERENCES products(id),
  INDEX idx_oi_order (order_id),
  INDEX idx_oi_product (product_id)                 -- "top-selling products" aggregation
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 11. documents: S3 file metadata. Polymorphic owner (employee
--     or product) kept simple with type + id columns.
-- -------------------------------------------------------------
CREATE TABLE documents (
  id           BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  owner_type   ENUM('EMPLOYEE','PRODUCT') NOT NULL,
  owner_id     INT UNSIGNED NOT NULL,
  file_name    VARCHAR(255) NOT NULL,
  s3_key       VARCHAR(512) NOT NULL,               -- key in bucket; URL is derived from it
  mime_type    VARCHAR(100) NOT NULL,
  size_bytes   INT UNSIGNED NOT NULL,
  uploaded_by  INT UNSIGNED NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_doc_user FOREIGN KEY (uploaded_by) REFERENCES users(id),
  INDEX idx_doc_owner (owner_type, owner_id)        -- "all docs for employee 7"
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 12. audit_logs: append-only record of sensitive operations
--     (login, role change, stock adjustment, order confirm...).
-- -------------------------------------------------------------
CREATE TABLE audit_logs (
  id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id     INT UNSIGNED NULL,                    -- NULL = failed/anonymous action
  action      VARCHAR(50) NOT NULL,                 -- e.g. 'LOGIN', 'STOCK_OUT', 'ORDER_CONFIRM'
  entity      VARCHAR(50) NULL,                     -- e.g. 'products'
  entity_id   INT UNSIGNED NULL,
  details     JSON NULL,                            -- old/new values, extra context
  ip_address  VARCHAR(45) NULL,                     -- 45 chars fits IPv6
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_action_date (action, created_at)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- Seed the 4 fixed roles
-- -------------------------------------------------------------
INSERT INTO roles (name) VALUES ('ADMIN'), ('HR'), ('MANAGER'), ('EMPLOYEE');
