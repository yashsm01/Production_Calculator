const HeaderInfo = require('../models/HeaderInfo');

// GET /api/header-info
exports.getAll = async (req, res, next) => {
  try {
    const headerInfos = await HeaderInfo.find().sort({ createdAt: -1 });
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
    const { name, description } = req.body;
    
    const existing = await HeaderInfo.findOne({ name });
    if (existing) return res.status(400).json({ message: 'Header Info name already exists' });

    const headerInfo = await HeaderInfo.create({ name, description });
    res.status(201).json(headerInfo);
  } catch (err) {
    next(err);
  }
};

// PUT /api/header-info/:id
exports.update = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (name) {
      const existing = await HeaderInfo.findOne({ name, _id: { $ne: req.params.id } });
      if (existing) return res.status(400).json({ message: 'Header Info name already exists' });
    }

    const headerInfo = await HeaderInfo.findByIdAndUpdate(
      req.params.id,
      { name, description },
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
