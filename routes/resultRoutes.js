const express = require('express');
const router = express.Router();
const { getResult } = require('../controllers/resultController');

// Public result lookup — GET /api/result/:regNo
router.get('/:regNo', getResult);

module.exports = router;
