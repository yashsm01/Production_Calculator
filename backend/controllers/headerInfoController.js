const HeaderInfo = require('../models/HeaderInfo');

// GET /api/header-info
exports.getAll = async (req, res, next) => {
  try {
    const headerInfos = await HeaderInfo.find().sort({ index: 1, name: 1 });
    res.json(headerInfos);
  } catch (err) {
    next(err);
  }
};

// GET /api/header-info/:id
exports.getById = async (req, res, next) => {
  try {
    const headerInfo = await HeaderInfo.findById(req.params.id);
    if (!headerInfo) return res.status(404).json({ message: 'Header Info not found' });
    res.json(headerInfo);
  } catch (err) {
    next(err);
  }
};

// POST /api/header-info
exports.create = async (req, res, next) => {
  try {
    const { name, description, index } = req.body;
    
    const existing = await HeaderInfo.findOne({ name });
    if (existing) return res.status(400).json({ message: 'Header Info name already exists' });

    if (index || index === 0) {
      const existingIndex = await HeaderInfo.findOne({ index });
      if (existingIndex) return res.status(400).json({ message: `Index "${index}" is already used by "${existingIndex.name}"` });
    }

    const headerInfo = await HeaderInfo.create({ name, description, index: (index || index === 0) ? index : null });
    res.status(201).json(headerInfo);
  } catch (err) {
    next(err);
  }
};

// PUT /api/header-info/:id
exports.update = async (req, res, next) => {
  try {
    const { name, description, index } = req.body;

    if (name) {
      const existing = await HeaderInfo.findOne({ name, _id: { $ne: req.params.id } });
      if (existing) return res.status(400).json({ message: 'Header Info name already exists' });
    }

    if (index || index === 0) {
      const existingIndex = await HeaderInfo.findOne({ index, _id: { $ne: req.params.id } });
      if (existingIndex) return res.status(400).json({ message: `Index "${index}" is already used by "${existingIndex.name}"` });
    }

    const headerInfo = await HeaderInfo.findByIdAndUpdate(
      req.params.id,
      { name, description, index: (index || index === 0) ? index : null },
      { new: true, runValidators: true }
    );
    if (!headerInfo) return res.status(404).json({ message: 'Header Info not found' });
    res.json(headerInfo);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/header-info/:id
exports.remove = async (req, res, next) => {
  try {
    const headerInfo = await HeaderInfo.findByIdAndDelete(req.params.id);
    if (!headerInfo) return res.status(404).json({ message: 'Header Info not found' });
    res.json({ message: 'Header Info deleted successfully' });
  } catch (err) {
    next(err);
  }
};
