const express = require('express');
const router = express.Router();
const reportTemplateController = require('../controllers/reportTemplateController');

router.get('/:productId', reportTemplateController.getByProduct);
router.put('/:productId', reportTemplateController.upsert);
router.delete('/:productId', reportTemplateController.remove);

module.exports = router;
