const express = require('express');
const router = express.Router();
const reportTemplateController = require('../controllers/reportTemplateController');

router.get('/product/:productId', reportTemplateController.getByProduct);
router.get('/:templateId', reportTemplateController.getById);
router.post('/', reportTemplateController.create);
router.put('/:templateId', reportTemplateController.update);
router.delete('/:templateId', reportTemplateController.remove);

module.exports = router;
