const Parameter = require('../models/Parameter');
const { extractVariables, collectAllInputVariables } = require('../services/dependencyResolver');
const { validateFormula } = require('../services/formulaEngine');

// GET /api/parameter  (optionally filter by ?categoryId=xxx)
exports.getAll = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.categoryId) {
      // Match parameters that include this categoryId OR have no categories (global)
      filter.$or = [
        { categoryIds: { $in: [req.query.categoryId] } },
        { categoryIds: { $size: 0 } },
        { categoryIds: { $exists: false } }
      ];
    }
    const parameters = await Parameter.find(filter)
      .populate('unit', 'name symbol')
      .populate('headerInfoId', 'name index')
      .populate('categoryIds', 'name')
      .sort({ createdAt: 1 });

    res.json(parameters);
  } catch (err) {
    next(err);
  }
};

// GET /api/parameter/:id
exports.getById = async (req, res, next) => {
  try {
    const parameter = await Parameter.findById(req.params.id)
      .populate('unit', 'name symbol')
      .populate('headerInfoId', 'name')
      .populate('categoryIds', 'name');
    if (!parameter) return res.status(404).json({ message: 'Parameter not found' });
    res.json(parameter);
  } catch (err) {
    next(err);
  }
};

// POST /api/parameter
exports.create = async (req, res, next) => {
  try {
    let { name, key, type, formula, unit, headerInfoId, categoryIds, index } = req.body;

    type = type || 'formula';
    if (type === 'input') {
      formula = '';
    } else {
      const { valid, error } = validateFormula(formula || '');
      if (!valid) return res.status(400).json({ message: `Invalid formula: ${error}` });
    }

    const existing = await Parameter.findOne({ key: key.toLowerCase() });
    if (existing) return res.status(400).json({ message: `Key "${key}" already exists` });
    
    if (index || index === 0) {
      const existingIndex = await Parameter.findOne({ index });
      if (existingIndex) return res.status(400).json({ message: `Index "${index}" is already used by parameter "${existingIndex.name}" (${existingIndex.key})` });
    }

    const parameter = await Parameter.create({
      name,
      key: key.toLowerCase(),
      type,
      formula,
      unit: unit || null,
      headerInfoId: headerInfoId || null,
      categoryIds: Array.isArray(categoryIds) ? categoryIds : (categoryIds ? [categoryIds] : []),
      index: (index || index === 0) ? index : null,
    });

    res.status(201).json(parameter);
  } catch (err) {
    next(err);
  }
};

// PUT /api/parameter/:id
exports.update = async (req, res, next) => {
  try {
    let { name, key, type, formula, unit, headerInfoId, categoryIds, index } = req.body;

    type = type || 'formula';
    if (type === 'input') {
      formula = '';
    } else {
      const { valid, error } = validateFormula(formula || '');
      if (!valid) return res.status(400).json({ message: `Invalid formula: ${error}` });
    }

    if (key) {
      const existing = await Parameter.findOne({
        key: key.toLowerCase(),
        _id: { $ne: req.params.id },
      });
      if (existing) return res.status(400).json({ message: `Key "${key}" already exists` });
    }

    if (index || index === 0) {
      const existingIndex = await Parameter.findOne({ index, _id: { $ne: req.params.id } });
      if (existingIndex) return res.status(400).json({ message: `Index "${index}" is already used by parameter "${existingIndex.name}" (${existingIndex.key})` });
    }

    const parameter = await Parameter.findByIdAndUpdate(
      req.params.id,
      {
        name,
        key: key ? key.toLowerCase() : undefined,
        type,
        formula,
        unit: unit || null,
        headerInfoId: headerInfoId || null,
        categoryIds: Array.isArray(categoryIds) ? categoryIds : (categoryIds ? [categoryIds] : []),
        index: (index || index === 0) ? index : null
      },
      { new: true, runValidators: true }
    )
      .populate('unit', 'name symbol')
      .populate('headerInfoId', 'name index')
      .populate('categoryIds', 'name');

    if (!parameter) return res.status(404).json({ message: 'Parameter not found' });
    res.json(parameter);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/parameter/:id
exports.remove = async (req, res, next) => {
  try {
    const parameter = await Parameter.findByIdAndDelete(req.params.id);
    if (!parameter) return res.status(404).json({ message: 'Parameter not found' });
    res.json({ message: 'Parameter deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// POST /api/parameter/validate-formula — validate + extract variables without saving
exports.validateFormulaEndpoint = async (req, res, next) => {
  try {
    const { formula } = req.body;

    // Handle empty formula as an input
    if (!formula || formula.trim() === '') {
      return res.json({ valid: true, variables: [], isInput: true });
    }

    const { valid, error } = validateFormula(formula);
    if (!valid) return res.status(400).json({ valid: false, error });

    const variables = extractVariables(formula);

    // Check if variables exist in database
    const allParams = await Parameter.find().select('key');
    const validKeys = allParams.map(p => p.key.toLowerCase());

    const missingVars = variables.filter(v => !validKeys.includes(v.toLowerCase()));

    if (missingVars.length > 0) {
      return res.json({
        valid: false,
        error: `Variables not found in system: ${missingVars.join(', ')}`,
        variables
      });
    }

    res.json({ valid: true, variables });
  } catch (err) {
    next(err);
  }
};

// GET /api/parameter/inputs — return required input variables for a category
exports.getInputVariables = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.categoryId) {
      filter.$or = [
        { categoryIds: { $in: [req.query.categoryId] } },
        { categoryIds: { $size: 0 } },
        { categoryIds: { $exists: false } }
      ];
    }
    const parameters = await Parameter.find(filter)
      .select('key formula type name headerInfoId unit index categoryIds')
      .populate('headerInfoId', 'name index')
      .populate('unit', 'name symbol')
      .sort({ index: 1, name: 1 });

    const inputVars = collectAllInputVariables(parameters);
    res.json({ inputVariables: inputVars, parameters });
  } catch (err) {
    next(err);
  }
};
