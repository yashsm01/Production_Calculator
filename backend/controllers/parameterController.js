const mongoose = require('mongoose');
const Parameter = require('../models/Parameter');
const Unit = require('../models/Unit');
const { extractVariables } = require('../services/dependencyResolver');
const { validateFormula } = require('../services/formulaEngine');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Populate units inside a parameter's variableUnits Map.
 * Mongoose does not automatically populate Map-of-ObjectId without help.
 */
async function populateVariableUnits(parameter) {
  if (!parameter.variableUnits || parameter.variableUnits.size === 0) return parameter;

  const unitIds = Array.from(parameter.variableUnits.values()).filter(Boolean);
  if (!unitIds.length) return parameter;

  const units = await Unit.find({ _id: { $in: unitIds } }).select('name symbol');
  const unitMap = new Map(units.map((u) => [u._id.toString(), u]));

  const populated = {};
  for (const [varName, unitId] of parameter.variableUnits.entries()) {
    populated[varName] = unitId ? (unitMap.get(unitId.toString()) || null) : null;
  }
  parameter._populatedVariableUnits = populated; // attach as a plain object
  return parameter;
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/parameter  (optionally filter by ?categoryId=xxx)
exports.getAll = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.categoryId) filter.categoryId = req.query.categoryId;
    const parameters = await Parameter.find(filter)
      .populate('unit', 'name symbol')
      .populate('categoryId', 'name')
      .sort({ createdAt: -1 });

    // Populate variableUnits for each
    const enriched = await Promise.all(parameters.map(populateVariableUnits));
    res.json(enriched);
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
    await populateVariableUnits(parameter);
    res.json(parameter);
  } catch (err) {
    next(err);
  }
};

// POST /api/parameter
exports.create = async (req, res, next) => {
  try {
    const { name, key, formula, unit, categoryId, isInput, variableUnits } = req.body;

    if (!isInput) {
      if (!formula || !formula.trim()) {
        return res.status(400).json({ message: 'Formula is required for calculated parameters' });
      }
      const { valid, error } = validateFormula(formula);
      if (!valid) return res.status(400).json({ message: `Invalid formula: ${error}` });
    }

    const existing = await Parameter.findOne({ key: key.toLowerCase() });
    if (existing) return res.status(400).json({ message: `Key "${key}" already exists` });

    const parameter = await Parameter.create({
      name,
      key: key.toLowerCase(),
      isInput: !!isInput,
      formula: isInput ? '' : formula,
      unit: unit || null,
      categoryId: categoryId || null,
      variableUnits: isInput ? {} : (variableUnits || {}),
    });

    await parameter.populate('unit', 'name symbol');
    await parameter.populate('categoryId', 'name');
    await populateVariableUnits(parameter);
    res.status(201).json(parameter);
  } catch (err) {
    next(err);
  }
};

// PUT /api/parameter/:id
exports.update = async (req, res, next) => {
  try {
    const { name, key, formula, unit, categoryId, isInput, variableUnits } = req.body;

    if (!isInput) {
      if (!formula || !formula.trim()) {
        return res.status(400).json({ message: 'Formula is required for calculated parameters' });
      }
      const { valid, error } = validateFormula(formula);
      if (!valid) return res.status(400).json({ message: `Invalid formula: ${error}` });
    }

    if (key) {
      const existing = await Parameter.findOne({ key: key.toLowerCase(), _id: { $ne: req.params.id } });
      if (existing) return res.status(400).json({ message: `Key "${key}" already exists` });
    }

    const parameter = await Parameter.findByIdAndUpdate(
      req.params.id,
      {
        name,
        key: key ? key.toLowerCase() : undefined,
        isInput: !!isInput,
        formula: isInput ? '' : formula,
        unit: unit || null,
        categoryId: categoryId || null,
        variableUnits: isInput ? {} : (variableUnits || {}),
      },
      { new: true, runValidators: false }
    )
      .populate('unit', 'name symbol')
      .populate('categoryId', 'name');

    if (!parameter) return res.status(404).json({ message: 'Parameter not found' });
    await populateVariableUnits(parameter);
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

// ─────────────────────────────────────────────────────────────────────────────
// Formula validation (context-aware)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/parameter/validate-formula
exports.validateFormulaEndpoint = async (req, res, next) => {
  try {
    const { formula, categoryId, currentKey } = req.body;
    if (!formula) return res.status(400).json({ message: 'Formula is required' });

    const { valid, error } = validateFormula(formula);
    if (!valid) return res.status(400).json({ valid: false, error });

    const variables = extractVariables(formula);

    let inputParamVars = [];
    let formulaParamVars = [];
    let unknownVars = [...variables];

    if (categoryId) {
      const filter = { categoryId };
      if (currentKey) filter.key = { $ne: currentKey };
      const existingParams = await Parameter.find(filter).select('key isInput');

      const inputKeys   = new Set(existingParams.filter(p =>  p.isInput).map(p => p.key));
      const formulaKeys = new Set(existingParams.filter(p => !p.isInput).map(p => p.key));
      const allKnownKeys = new Set([...inputKeys, ...formulaKeys]);

      inputParamVars   = variables.filter(v =>  inputKeys.has(v));
      formulaParamVars = variables.filter(v => formulaKeys.has(v));
      unknownVars      = variables.filter(v => !allKnownKeys.has(v));
    }

    res.json({ valid: true, variables, inputParamVars, formulaParamVars, unknownVars });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Product form payload — structured inputs + unit metadata
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/parameter/inputs?categoryId=xxx
 *
 * Returns everything the Product form needs:
 *
 *  inputParameters  — isInput=true params (name, key, unit)
 *                     → labeled input field on Product form
 *
 *  formulaVariables — raw variables from formula params, NOT covered by any
 *                     param key, WITH their unit (from variableUnits map)
 *                     → labeled input field on Product form
 *                     Shape: [{ key, unit: {_id,name,symbol} | null }]
 *
 *  formulaParameters — non-input params (for engine + dependency visualization)
 */
exports.getInputVariables = async (req, res, next) => {
  try {
    const { categoryId } = req.query;
    const filter = categoryId ? { categoryId } : {};

    const allParams = await Parameter.find(filter)
      .populate('unit', 'name symbol')
      .select('key formula name isInput unit variableUnits');

    const inputParameters  = allParams.filter(p =>  p.isInput);
    const formulaParameters = allParams.filter(p => !p.isInput);
    const allParamKeys = new Set(allParams.map(p => p.key));

    // Build a merged variableUnit map: varName → Unit object
    // If two formula params both use the same variable, later one wins
    // (user should keep them consistent)
    const varUnitMap = new Map(); // varName → { _id, name, symbol } | null

    // Pre-load all unit IDs referenced in variableUnits maps
    const allUnitIds = new Set();
    for (const param of formulaParameters) {
      if (param.variableUnits) {
        for (const unitId of param.variableUnits.values()) {
          if (unitId) allUnitIds.add(unitId.toString());
        }
      }
    }
    const unitDocs = await Unit.find({ _id: { $in: Array.from(allUnitIds) } }).select('name symbol');
    const unitById = new Map(unitDocs.map(u => [u._id.toString(), u]));

    // Collect raw formula variables with their unit metadata
    for (const param of formulaParameters) {
      if (!param.formula) continue;
      const vars = extractVariables(param.formula);
      for (const v of vars) {
        if (!allParamKeys.has(v) && !varUnitMap.has(v)) {
          // Look up unit for this variable from this param's variableUnits map
          const unitId = param.variableUnits?.get(v);
          const unit = unitId ? (unitById.get(unitId.toString()) || null) : null;
          varUnitMap.set(v, unit);
        }
      }
    }

    // Build formulaVariables array: [{ key, unit }]
    const formulaVariables = Array.from(varUnitMap.entries()).map(([key, unit]) => ({
      key,
      unit: unit ? { _id: unit._id, name: unit.name, symbol: unit.symbol } : null,
    }));

    res.json({ inputParameters, formulaVariables, formulaParameters });
  } catch (err) {
    next(err);
  }
};
