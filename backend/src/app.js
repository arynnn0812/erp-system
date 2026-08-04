// app.js builds and configures the Express app.
// Kept separate from server.js so the app can be imported in tests
// without actually opening a port.
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const config = require('./config/env');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const categoryRoutes = require('./routes/category.routes');
const productRoutes = require('./routes/product.routes');
const customerRoutes = require('./routes/customer.routes');
const orderRoutes = require('./routes/order.routes');
const departmentRoutes = require('./routes/department.routes');
const employeeRoutes = require('./routes/employee.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const documentRoutes = require('./routes/document.routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Must be set BEFORE the rate limiter: it decides what req.ip means.
app.set('trust proxy', config.trustProxy);
if (config.nodeEnv === 'production' && config.trustProxy === 0) {
  console.warn(
    '[config] TRUST_PROXY is 0 in production. If this app runs behind nginx/ALB, ' +
    'req.ip is the proxy address - login rate limiting and audit IPs will be wrong. ' +
    'Set TRUST_PROXY=1 (or the number of proxies in front of you).'
  );
}

// --- Security & parsing middleware (order matters) ---
app.use(helmet());                          // sets security headers (X-Content-Type-Options, etc.)
app.use(cors({ origin: config.clientUrl, credentials: true })); // only OUR frontend, not '*'
app.use(express.json({ limit: '10kb' }));   // parse JSON bodies; small limit blocks junk payloads
app.use(express.urlencoded({ extended: true }));

// --- Routes ---
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/documents', documentRoutes);

// --- 404 + centralized error handler (must be LAST) ---
app.use(notFound);
app.use(errorHandler);

module.exports = app;
