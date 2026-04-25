const ReportTemplate = require('../models/ReportTemplate');

// GET /api/report-template/:productId
exports.getByProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const template = await ReportTemplate.findOne({ productId });
    if (!template) {
      return res.status(404).json({ message: 'Template not found for this product' });
    }
    res.json(template);
  } catch (err) {
    next(err);
  }
};

// PUT /api/report-template/:productId
exports.upsert = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { rowCount, colCount, cells } = req.body;

    const template = await ReportTemplate.findOneAndUpdate(
      { productId },
      { rowCount, colCount, cells },
      { new: true, upsert: true, runValidators: true }
    );

    res.json(template);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/report-template/:productId
exports.remove = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const template = await ReportTemplate.findOneAndDelete({ productId });
    if (!template) {
      return res.status(404).json({ message: 'Template not found for this product' });
    }
    res.json({ message: 'Template deleted successfully' });
  } catch (err) {
    next(err);
  }
};
