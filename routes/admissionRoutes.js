const express = require('express');
const router = express.Router();
const multer = require('multer');
const { admissionController } = require('../controllers/adminControllers');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Public admission form submit — POST /api/admission
router.post('/', upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'signature', maxCount: 1 }]), admissionController.submit);

// Public payment status update — PUT /api/admission/:id/payment (admin only handled via adminRoutes)
module.exports = router;
