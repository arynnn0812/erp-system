// Routes only map URL -> controller. No logic lives here.
const express = require('express');
const { getHealth } = require('../controllers/health.controller');

const router = express.Router();

router.get('/', getHealth); // GET /api/health

module.exports = router;
