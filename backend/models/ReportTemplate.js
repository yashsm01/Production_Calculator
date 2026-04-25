const mongoose = require('mongoose');

const cellSchema = new mongoose.Schema({
  row: {
    type: Number,
    required: true,
  },
  col: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    enum: ['text', 'parameter'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  bold: {
    type: Boolean,
    default: false,
  },
  align: {
    type: String,
    enum: ['left', 'center', 'right'],
    default: 'left',
  },
  colSpan: {
    type: Number,
    default: 1,
  },
  rowSpan: {
    type: Number,
    default: 1,
  },
  thickBorder: {
    type: Boolean,
    default: false,
  },
  bgColor: {
    type: String,
    default: '',
  },
  fontColor: {
    type: String,
    default: '',
  }
}, { _id: false });

const reportTemplateSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    unique: true, // One template per product
  },
  rowCount: {
    type: Number,
    required: true,
    default: 10,
  },
  colCount: {
    type: Number,
    required: true,
    default: 4,
  },
  colWidths: {
    type: [Number],
    default: [],
  },
  rowHeights: {
    type: [Number],
    default: [],
  },
  cells: [cellSchema],
}, { timestamps: true });

module.exports = mongoose.model('ReportTemplate', reportTemplateSchema);
