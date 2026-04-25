const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reportHistoryController');

router.post('/', ctrl.saveHistory);
router.get('/product/:productId', ctrl.getHistory);
router.get('/:id', ctrl.getHistoryById);
router.delete('/:id', ctrl.deleteHistory);

module.exports = router;
