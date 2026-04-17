const Parameter = require('../models/Parameter');
const { extractVariables, collectAllInputVariables } = require('../services/dependencyResolver');
const { validateFormula } = require('../services/formulaEngine');

// GET /api/parameter  (optionally filter by ?categoryId=xxx)
exports.getAll = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.categoryId) filter.categoryId = req.query.categoryId;
    const parameters = await Parameter.find(filter)
      .populate('unit', 'name symbol')
      .populate('categoryId', 'name')
      .sort({ createdAt: -1 });
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
      .populate('categoryId', 'name');
    if (!parameter) return res.status(404).json({ message: 'Parameter not found' });
    res.json(parameter);
  } catch (err) {
    next(err);
  }
};

// POST /api/parameter
exports.create = async (req, res, next) => {
  try {
    let { name, key, type, formula, unit, categoryId } = req.body;

    type = type || 'formula';
    if (type === 'input') {
      formula = '';
    } else {
      // Validate formula syntax (if not input)
      const { valid, error } = validateFormula(formula || '');
      if (!valid) return res.status(400).json({ message: `Invalid formula: ${error}` });
    }

    // Check key uniqueness
    const existing = await Parameter.findOne({ key: key.toLowerCase() });
    if (existing) return res.status(400).json({ message: `Key "${key}" already exists` });

    const parameter = await Parameter.create({
      name,
      key: key.toLowerCase(),
      type,
      formula,
      unit: unit || null,
      categoryId: categoryId || null,
    });

    res.status(201).json(parameter);
  } catch (err) {
    next(err);
  }
};

// PUT /api/parameter/:id
exports.update = async (req, res, next) => {
  try {
    let { name, key, type, formula, unit, categoryId } = req.body;

    type = type || 'formula';
    if (type === 'input') {
      formula = '';
    } else {
      // Validate formula syntax (if not empty)
      const { valid, error } = validateFormula(formula || '');
      if (!valid) return res.status(400).json({ message: `Invalid formula: ${error}` });
    }

    // Check key uniqueness (excluding self)
    if (key) {
      const existing = await Parameter.findOne({
        key: key.toLowerCase(),
        _id: { $ne: req.params.id },
      });
      if (existing) return res.status(400).json({ message: `Key "${key}" already exists` });
    }

    const parameter = await Parameter.findByIdAndUpdate(
      req.params.id,
      { name, key: key ? key.toLowerCase() : undefined, type, formula, unit: unit || null, categoryId: categoryId || null },
      { new: true, runValidators: true }
    )
      .populate('unit', 'name symbol')
      .populate('categoryId', 'name');

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
    // Handle empty formula as an input
    if (!formula || formula.trim() === '') {
      return res.json({ valid: true, variables: [], isInput: true });
    }

    const { valid, error } = validateFormula(formula);
    if (!valid) return res.status(400).json({ valid: false, error });

    const variables = extractVariables(formula);
    res.json({ valid: true, variables });
  } catch (err) {
    next(err);
  }
};

// GET /api/parameter/inputs?categoryId=xxx — return required input variables for a category
exports.getInputVariables = async (req, res, next) => {
  try {
    const { categoryId } = req.query;
    const filter = categoryId ? { categoryId } : {};
    const parameters = await Parameter.find(filter).select('key formula');

    const inputVars = collectAllInputVariables(parameters);
    res.json({ inputVariables: inputVars, parameters });
  } catch (err) {
    next(err);
  }
};
