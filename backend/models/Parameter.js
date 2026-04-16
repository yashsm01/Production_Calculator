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
      match: [/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Key should start with a letter or underscore and can contain letters, numbers, and underscores'],
    },
    /**
     * isInput = true  → User provides this value manually at product creation.
     *                   Formula is not used; value goes straight into scope.
     * isInput = false → Calculated from formula (default behaviour).
     */
    isInput: {
      type: Boolean,
      default: false,
    },
    formula: {
      type: String,
      trim: true,
      default: '',
      // Formula is only required when the parameter is NOT an input parameter
      validate: {
        validator: function (v) {
          if (this.isInput) return true;          // no formula needed for input params
          return v && v.trim().length > 0;        // formula required for calculated params
        },
        message: 'Formula is required for calculated parameters',
      },
    },
    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      default: null,
    },
    /**
     * variableUnits: maps raw variable names used in THIS formula to Unit ObjectIds.
     *
     * Example:
     *   formula: "(inputX * weight)"
     *   variableUnits: { "inputX": <Unit._id for "%"> }
     *
     * This lets the Product form show "inputX [%]" as a labeled input field.
     * Only meaningful for formula (isInput=false) parameters.
     */
    variableUnits: {
      type: Map,
      of: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Unit',
      },
      default: {},
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


