const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/productController');

router.post('/create', ctrl.create);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.delete('/:id', ctrl.remove);

module.exports = router;
