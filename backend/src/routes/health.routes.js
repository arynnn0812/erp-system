// Routes only map URL -> controller. No logic lives here.
const express = require('express');
const { getLive, getReady } = require('../controllers/health.controller');

const router = express.Router();

router.get('/live', getLive);   // GET /api/health/live  - liveness
router.get('/ready', getReady); // GET /api/health/ready - readiness
router.get('/', getReady);      // GET /api/health       - alias of ready

module.exports = router;
