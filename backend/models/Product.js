const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      unique: true,
      trim: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    inputs: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    calculated: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    hiddenParameters: {
      type: [String],
      default: [],
    },
    // Custom display labels for each parameter key (used in reports)
    parameterLabels: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Custom parameter display order indices (key -> index)
    parameterIndices: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
