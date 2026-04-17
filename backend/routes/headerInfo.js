const express = require('express');
const router = express.Router();
const headerInfoController = require('../controllers/headerInfoController');

router.get('/', headerInfoController.getAll);
router.get('/:id', headerInfoController.getById);
router.post('/', headerInfoController.create);
router.put('/:id', headerInfoController.update);
router.delete('/:id', headerInfoController.remove);

module.exports = router;
