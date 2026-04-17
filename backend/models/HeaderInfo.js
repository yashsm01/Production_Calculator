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
  },
  { timestamps: true }
);

module.exports = mongoose.model('HeaderInfo', headerInfoSchema);
