const mongoose = require('mongoose');

const headerInfoSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Header Info name is required'],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    index: {
      type: Number,
      default: null,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('HeaderInfo', headerInfoSchema);
