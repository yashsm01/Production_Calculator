require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const categoryRoutes = require('./routes/category');
const unitRoutes = require('./routes/unit');
const parameterRoutes = require('./routes/parameter');
const productRoutes = require('./routes/product');
const headerInfoRoutes = require('./routes/headerInfo');
const reportTemplateRoutes = require('./routes/reportTemplate');
const reportHistoryRoutes = require('./routes/reportHistory');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/category', categoryRoutes);
app.use('/api/unit', unitRoutes);
app.use('/api/parameter', parameterRoutes);
app.use('/api/product', productRoutes);
app.use('/api/header-info', headerInfoRoutes);
app.use('/api/report-template', reportTemplateRoutes);
app.use('/api/report-history', reportHistoryRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Database & Server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/calc_engine';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅  MongoDB connected');
    app.listen(PORT, () => console.log(`🚀  Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('❌  MongoDB connection error:', err.message);
    process.exit(1);
  });
