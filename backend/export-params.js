#!/usr/bin/env node
/**
 * export-params.js
 * Exports all parameters and categories from LOCAL MongoDB to JSON files
 * Run: node export-params.js
 */
const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/calculator').then(async () => {
  const fs = require('fs');
  try {
    const collections = ['parameters', 'categories', 'units', 'headerinfos'];
    for (const col of collections) {
      const docs = await mongoose.connection.db.collection(col).find().toArray();
      fs.writeFileSync(`export_${col}.json`, JSON.stringify(docs, null, 2));
      console.log(`✓ Exported ${docs.length} documents from "${col}" → export_${col}.json`);
    }
    console.log('\nDone! Upload these files to EC2 and run: node import-params.js');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
});
