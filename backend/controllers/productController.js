const Product = require('../models/Product');
const Parameter = require('../models/Parameter');
const { runEngine } = require('../services/formulaEngine');

// POST /api/product/create
exports.create = async (req, res, next) => {
  try {
    const { name, categoryId, inputs } = req.body;

    if (!name || !categoryId || !inputs) {
      return res.status(400).json({ message: 'name, categoryId, and inputs are required' });
    }

    // Load parameters for this category
    const parameters = await Parameter.find({ categoryId }).select('key formula name');

    if (parameters.length === 0) {
      return res.status(400).json({
        message: 'No parameters found for this category. Please define parameters first.',
      });
    }

    // Run formula engine — returns { scope, order }
    const { scope, order } = await runEngine(parameters, inputs);

    // Separate calculated values from inputs
    const inputKeys = Object.keys(inputs);
    const calculated = {};
    for (const key of order) {
      calculated[key] = scope[key];
    }

    const product = await Product.create({
      name,
      categoryId,
      inputs,
      calculated,
    });

    await product.populate('categoryId', 'name');

    res.status(201).json({
      product,
      scope,
      evaluationOrder: order,
    });
  } catch (err) {
    // Formula engine errors (circular dep, missing input, invalid formula)
    // are plain Errors — send as 400
    if (
      err.message.includes('Circular dependency') ||
      err.message.includes('Missing required input') ||
      err.message.includes('Invalid formula') ||
      err.message.includes('Error evaluating')
    ) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
};

// GET /api/product
exports.getAll = async (req, res, next) => {
  try {
    const products = await Product.find()
      .populate('categoryId', 'name')
      .sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    next(err);
  }
};

// GET /api/product/:id
exports.getById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate('categoryId', 'name');
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/product/:id
exports.remove = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    next(err);
  }
};
