const MasterProduct = require('../models/MasterProduct');
const Product = require('../models/Product');
const { create, all } = require('mathjs');

const math = create(all);
math.import({
  iferror: function (val, fallback) {
    if (val === Infinity || val === -Infinity || Number.isNaN(val) || val === undefined || val === null) {
      return fallback;
    }
    return val;
  }
});

/**
 * Build the flat scope from all referenced products.
 * For each product ref with alias "X":
 *   - product.inputs.abc   → scope["X_abc"]
 *   - product.calculated.abc → scope["X_abc"] (calculated overrides input if same key)
 */
async function buildScope(productRefs, overrides = {}) {
  const scope = {};
  const refDetails = []; // For returning to caller
  const inputKeys = []; // Scope keys that come from raw inputs (editable)

  for (const ref of productRefs) {
    const product = await Product.findById(ref.productId).populate('categoryId', 'name');
    if (!product) throw new Error(`Product with id ${ref.productId} not found`);

    const alias = ref.alias.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    // Add input values first (these are editable)
    for (const [key, value] of Object.entries(product.inputs || {})) {
      const scopeKey = `${alias}_${key.toLowerCase()}`;
      scope[scopeKey] = Number(value);
      inputKeys.push(scopeKey);
    }

    // Calculated overrides (not editable by user)
    for (const [key, value] of Object.entries(product.calculated || {})) {
      const scopeKey = `${alias}_${key.toLowerCase()}`;
      scope[scopeKey] = Number(value);
      // Remove from inputKeys if it was also in inputs (calculated takes precedence)
      const idx = inputKeys.indexOf(scopeKey);
      if (idx !== -1) inputKeys.splice(idx, 1);
    }

    const allValues = { ...product.inputs, ...product.calculated };
    refDetails.push({
      productId: product._id,
      alias: ref.alias,
      productName: product.name,
      categoryName: product.categoryId?.name || '',
      values: allValues,
    });
  }

  // Apply any user-supplied overrides (only for input-type keys)
  for (const [key, value] of Object.entries(overrides)) {
    if (key in scope) {
      scope[key] = Number(value);
    }
  }

  return { scope, refDetails, inputKeys };
}

/**
 * Evaluate master parameters in topological order (simple sequential for now).
 */
function evaluateMasterParams(masterParams, scope) {
  const computed = {};
  const sortedParams = [...masterParams].sort((a, b) => (a.index || 0) - (b.index || 0));

  for (const param of sortedParams) {
    try {
      const result = math.evaluate(param.formula.toLowerCase(), { ...scope, ...computed });
      const numResult = typeof result === 'object' && result?.toNumber ? result.toNumber() : Number(result);
      computed[param.key.toLowerCase()] = numResult;
    } catch (err) {
      throw new Error(`Error evaluating master param "${param.name}" (key: "${param.key}"): ${err.message}`);
    }
  }

  return computed;
}

// POST /api/master-product — create or update
exports.create = async (req, res, next) => {
  try {
    const { name, description, productRefs, masterParams } = req.body;
    if (!name || !productRefs || productRefs.length === 0) {
      return res.status(400).json({ message: 'name and at least one productRef are required' });
    }

    const { scope, refDetails } = await buildScope(productRefs);
    const computed = evaluateMasterParams(masterParams || [], scope);
    const fullScope = { ...scope, ...computed };

    const master = await MasterProduct.findOneAndUpdate(
      { name },
      { name, description, productRefs, masterParams: masterParams || [], computed, scope: fullScope },
      { new: true, upsert: true, runValidators: true }
    );

    await master.populate('productRefs.productId', 'name categoryId');

    res.status(201).json({ master, refDetails, scope: fullScope });
  } catch (err) {
    if (err.message.includes('Error evaluating') || err.message.includes('not found')) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
};

// GET /api/master-product — list all
exports.getAll = async (req, res, next) => {
  try {
    const masters = await MasterProduct.find()
      .populate('productRefs.productId', 'name categoryId')
      .sort({ createdAt: -1 });
    res.json(masters);
  } catch (err) {
    next(err);
  }
};

// GET /api/master-product/:id — get by id with full scope
exports.getById = async (req, res, next) => {
  try {
    const master = await MasterProduct.findById(req.params.id)
      .populate('productRefs.productId', 'name categoryId inputs calculated');
    if (!master) return res.status(404).json({ message: 'Master product not found' });

    // Rebuild live scope so report always shows fresh values
    const { scope, refDetails, inputKeys } = await buildScope(master.productRefs);
    const computed = evaluateMasterParams(master.masterParams, scope);
    const fullScope = { ...scope, ...computed };

    res.json({ master, refDetails, scope: fullScope, inputKeys });
  } catch (err) {
    next(err);
  }
};

// PUT /api/master-product/:id — update
exports.update = async (req, res, next) => {
  try {
    const { name, description, productRefs, masterParams } = req.body;

    const { scope, refDetails } = await buildScope(productRefs || []);
    const computed = evaluateMasterParams(masterParams || [], scope);
    const fullScope = { ...scope, ...computed };

    const master = await MasterProduct.findByIdAndUpdate(
      req.params.id,
      { name, description, productRefs, masterParams: masterParams || [], computed, scope: fullScope },
      { new: true, runValidators: true }
    ).populate('productRefs.productId', 'name categoryId');

    if (!master) return res.status(404).json({ message: 'Master product not found' });

    res.json({ master, refDetails, scope: fullScope });
  } catch (err) {
    if (err.message.includes('Error evaluating') || err.message.includes('not found')) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
};

// DELETE /api/master-product/:id
exports.remove = async (req, res, next) => {
  try {
    const master = await MasterProduct.findByIdAndDelete(req.params.id);
    if (!master) return res.status(404).json({ message: 'Master product not found' });
    res.json({ message: 'Master product deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// POST /api/master-product/preview — compute scope without saving
// Accepts optional `overrides` object to override specific input scope keys
exports.preview = async (req, res, next) => {
  try {
    const { productRefs, masterParams, overrides } = req.body;
    if (!productRefs || productRefs.length === 0) {
      return res.status(400).json({ message: 'At least one productRef is required' });
    }

    const { scope, refDetails, inputKeys } = await buildScope(productRefs, overrides || {});
    const computed = evaluateMasterParams(masterParams || [], scope);
    const fullScope = { ...scope, ...computed };

    res.json({ refDetails, scope: fullScope, computed, inputKeys });
  } catch (err) {
    if (err.message.includes('Error evaluating') || err.message.includes('not found')) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
};
