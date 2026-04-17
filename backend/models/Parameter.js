const mongoose = require('mongoose');

const parameterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Parameter name is required'],
      trim: true,
    },
    key: {
      type: String,
      required: [true, 'Parameter key is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z_][a-z0-9_]*$/, 'Key must be a valid identifier (letters, numbers, underscores)'],
    },
    type: {
      type: String,
      enum: ['input', 'formula'],
      default: 'formula',
    },
    formula: {
      type: String,
      trim: true,
      default: '',
    },
    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      default: null,
    },
    headerInfoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HeaderInfo',
      default: null,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Parameter', parameterSchema);
