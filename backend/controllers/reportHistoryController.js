const ReportHistory = require('../models/ReportHistory');

// POST /api/report-history — Save a new report snapshot
exports.saveHistory = async (req, res) => {
  try {
    const { productId, productName, categoryName, inputs, calculated, notes } = req.body;
    if (!productId || !productName) {
      return res.status(400).json({ message: 'productId and productName are required.' });
    }
    const history = new ReportHistory({
      productId,
      productName,
      categoryName: categoryName || '',
      inputs: inputs || {},
      calculated: calculated || {},
      notes: notes || '',
    });
    await history.save();
    res.status(201).json({ message: 'History saved.', history });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save history.', error: err.message });
  }
};

// GET /api/report-history/product/:productId — Get all snapshots for a product
exports.getHistory = async (req, res) => {
  try {
    const { productId } = req.params;
    const history = await ReportHistory.find({ productId })
      .sort({ savedAt: -1 })
      .lean();
    res.json(history);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch history.', error: err.message });
  }
};

// GET /api/report-history/:id — Get a single snapshot
exports.getHistoryById = async (req, res) => {
  try {
    const history = await ReportHistory.findById(req.params.id).lean();
    if (!history) return res.status(404).json({ message: 'History not found.' });
    res.json(history);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch history.', error: err.message });
  }
};

// DELETE /api/report-history/:id — Delete a snapshot
exports.deleteHistory = async (req, res) => {
  try {
    await ReportHistory.findByIdAndDelete(req.params.id);
    res.json({ message: 'History deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete history.', error: err.message });
  }
};
