const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Unit name is required'],
      trim: true,
    },
    symbol: {
      type: String,
      required: [true, 'Unit symbol is required'],
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Unit', unitSchema);
