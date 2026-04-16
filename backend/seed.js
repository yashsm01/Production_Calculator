/**
 * seed.js  —  Run with: npm run seed
 * Populates the database with example categories, units, and parameters
 * to demonstrate the formula engine's dependency resolution.
 *
 * Example dependency chain:
 *   volume  = length * width * height
 *   weight  = volume * density          ← depends on volume
 *   cost    = weight * rate             ← depends on weight
 *   tax     = cost * (tax_pct / 100)   ← depends on cost
 *   total   = cost + tax               ← depends on cost & tax
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category');
const Unit = require('./models/Unit');
const Parameter = require('./models/Parameter');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/calc_engine');
  console.log('✅  Connected to MongoDB');

  // Clear existing data
  await Category.deleteMany({});
  await Unit.deleteMany({});
  await Parameter.deleteMany({});
  console.log('🗑️   Cleared existing data');

  // ── Categories ─────────────────────────────────────────────────────────────
  const [construction, manufacturing] = await Category.insertMany([
    { name: 'Construction' },
    { name: 'Manufacturing' },
  ]);
  console.log('📂  Categories created');

  // ── Units ──────────────────────────────────────────────────────────────────
  const [meterUnit, kgUnit, rupeesUnit, m3Unit, pctUnit] = await Unit.insertMany([
    { name: 'Metre', symbol: 'm' },
    { name: 'Kilogram', symbol: 'kg' },
    { name: 'Indian Rupee', symbol: '₹' },
    { name: 'Cubic Metre', symbol: 'm³' },
    { name: 'Percent', symbol: '%' },
  ]);
  console.log('📐  Units created');

  // ── Parameters (Construction category) ────────────────────────────────────
  // Dependency chain: volume → weight → cost → tax → total
  await Parameter.insertMany([
    {
      name: 'Volume',
      key: 'volume',
      formula: 'length * width * height',
      unit: m3Unit._id,
      categoryId: construction._id,
    },
    {
      name: 'Weight',
      key: 'weight',
      formula: 'volume * density',          // depends on volume
      unit: kgUnit._id,
      categoryId: construction._id,
    },
    {
      name: 'Material Cost',
      key: 'cost',
      formula: 'weight * rate',             // depends on weight
      unit: rupeesUnit._id,
      categoryId: construction._id,
    },
    {
      name: 'Tax Amount',
      key: 'tax',
      formula: 'cost * (tax_pct / 100)',    // depends on cost
      unit: rupeesUnit._id,
      categoryId: construction._id,
    },
    {
      name: 'Total Cost',
      key: 'total',
      formula: 'cost + tax',               // depends on cost & tax
      unit: rupeesUnit._id,
      categoryId: construction._id,
    },
  ]);
  console.log('🔢  Construction parameters created');

  // ── Parameters (Manufacturing category) ───────────────────────────────────
  await Parameter.insertMany([
    {
      name: 'Area',
      key: 'area',
      formula: 'length * width',
      unit: m3Unit._id,
      categoryId: manufacturing._id,
    },
    {
      name: 'Production Cost',
      key: 'prod_cost',
      formula: 'area * unit_cost',
      unit: rupeesUnit._id,
      categoryId: manufacturing._id,
    },
    {
      name: 'Profit',
      key: 'profit',
      formula: 'prod_cost * (margin / 100)',
      unit: rupeesUnit._id,
      categoryId: manufacturing._id,
    },
    {
      name: 'Selling Price',
      key: 'selling_price',
      formula: 'prod_cost + profit',
      unit: rupeesUnit._id,
      categoryId: manufacturing._id,
    },
  ]);
  console.log('🏭  Manufacturing parameters created');

  console.log('\n✨  Seed complete! Example inputs for Construction:');
  console.log('   length=10, width=5, height=3, density=2.5, rate=150, tax_pct=18');
  console.log('   Expected: volume=150, weight=375, cost=56250, tax=10125, total=66375\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌  Seed failed:', err.message);
  process.exit(1);
});
