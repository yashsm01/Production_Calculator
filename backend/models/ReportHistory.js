const mongoose = require('mongoose');

const ReportHistorySchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },
  categoryName: {
    type: String,
    default: '',
  },
  inputs: {
    type: Map,
    of: Number,
    default: {},
  },
  calculated: {
    type: Map,
    of: Number,
    default: {},
  },
  notes: {
    type: String,
    default: '',
  },
  savedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('ReportHistory', ReportHistorySchema);
