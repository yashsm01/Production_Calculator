const mongoose = require('mongoose');

/**
 * A MasterProduct aggregates values from multiple existing Products.
 * It defines its own "master parameters" (formulas that reference
 * values from referenced products) and stores the computed results.
 *
 * Reference keys are automatically prefixed:
 *   productRef[0] with alias "X" → values accessible as "X_abc", "X_weight", etc.
 */
const masterProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Master product name is required'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    // Products included in this master product
    productRefs: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        alias: {
          type: String,
          required: true,
          trim: true,
          // Short identifier used as key prefix, e.g. "X" → "X_abc"
        },
      },
    ],
    // Master-level parameters/formulas that combine values from referenced products
    masterParams: [
      {
        key: { type: String, required: true, trim: true },
        name: { type: String, required: true, trim: true },
        formula: { type: String, required: true, trim: true },
        unit: { type: String, default: '' },
        index: { type: Number, default: 0 },
      },
    ],
    // Computed results after running the engine
    computed: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Flat scope of all referenced values + computed, stored for reporting
    scope: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MasterProduct', masterProductSchema);
