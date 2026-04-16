const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/parameterController');

// Special routes BEFORE /:id to avoid conflicts
router.post('/validate-formula', ctrl.validateFormulaEndpoint);
router.get('/inputs', ctrl.getInputVariables);

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
