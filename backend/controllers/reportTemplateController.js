const ReportTemplate = require('../models/ReportTemplate');

// GET /api/report-template/product/:productId
exports.getByProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const templates = await ReportTemplate.find({ productId });
    res.json(templates);
  } catch (err) {
    next(err);
  }
};

// GET /api/report-template/:templateId
exports.getById = async (req, res, next) => {
  try {
    const { templateId } = req.params;
    const template = await ReportTemplate.findById(templateId);
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    res.json(template);
  } catch (err) {
    next(err);
  }
};

// POST /api/report-template
exports.create = async (req, res, next) => {
  try {
    const { productId, templateName, description, rowCount, colCount, cells, colWidths, rowHeights } = req.body;
    const template = new ReportTemplate({
      productId,
      templateName,
      description,
      rowCount,
      colCount,
      cells,
      colWidths,
      rowHeights
    });
    await template.save();
    res.status(201).json(template);
  } catch (err) {
    next(err);
  }
};

// PUT /api/report-template/:templateId
exports.update = async (req, res, next) => {
  try {
    const { templateId } = req.params;
    const { templateName, description, rowCount, colCount, cells, colWidths, rowHeights } = req.body;

    const template = await ReportTemplate.findByIdAndUpdate(
      templateId,
      { templateName, description, rowCount, colCount, cells, colWidths, rowHeights },
      { new: true, runValidators: true }
    );

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    res.json(template);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/report-template/:templateId
exports.remove = async (req, res, next) => {
  try {
    const { templateId } = req.params;
    const template = await ReportTemplate.findByIdAndDelete(templateId);
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    res.json({ message: 'Template deleted successfully' });
  } catch (err) {
    next(err);
  }
};
