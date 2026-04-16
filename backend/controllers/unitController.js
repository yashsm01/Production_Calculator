const Unit = require('../models/Unit');

// GET /api/unit
exports.getAll = async (req, res, next) => {
  try {
    const units = await Unit.find().sort({ createdAt: -1 });
    res.json(units);
  } catch (err) {
    next(err);
  }
};

// GET /api/unit/:id
exports.getById = async (req, res, next) => {
  try {
    const unit = await Unit.findById(req.params.id);
    if (!unit) return res.status(404).json({ message: 'Unit not found' });
    res.json(unit);
  } catch (err) {
    next(err);
  }
};

// POST /api/unit
exports.create = async (req, res, next) => {
  try {
    const unit = await Unit.create({ name: req.body.name, symbol: req.body.symbol });
    res.status(201).json(unit);
  } catch (err) {
    next(err);
  }
};

// PUT /api/unit/:id
exports.update = async (req, res, next) => {
  try {
    const unit = await Unit.findByIdAndUpdate(
      req.params.id,
      { name: req.body.name, symbol: req.body.symbol },
      { new: true, runValidators: true }
    );
    if (!unit) return res.status(404).json({ message: 'Unit not found' });
    res.json(unit);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/unit/:id
exports.remove = async (req, res, next) => {
  try {
    const unit = await Unit.findByIdAndDelete(req.params.id);
    if (!unit) return res.status(404).json({ message: 'Unit not found' });
    res.json({ message: 'Unit deleted successfully' });
  } catch (err) {
    next(err);
  }
};
