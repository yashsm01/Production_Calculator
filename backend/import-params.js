#!/usr/bin/env node
/**
 * import-params.js
 * Imports collections from JSON exports to the TARGET MongoDB.
 * Run on EC2: node import-params.js
 * 
 * This will REPLACE the existing collections with the local data.
 */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/calculator';

mongoose.connect(MONGO_URI).then(async () => {
  const collections = ['parameters', 'categories', 'units', 'headerinfos'];
  try {
    for (const col of collections) {
      const file = path.join(__dirname, `export_${col}.json`);
      if (!fs.existsSync(file)) {
        console.warn(`⚠ Skipping "${col}" — export_${col}.json not found`);
        continue;
      }

      const docs = JSON.parse(fs.readFileSync(file, 'utf-8'));

      // Convert _id strings back to ObjectId where applicable
      const converted = docs.map(doc => {
        const d = { ...doc };
        if (d._id && d._id.$oid) d._id = new mongoose.Types.ObjectId(d._id.$oid);
        if (d.categoryIds && Array.isArray(d.categoryIds)) {
          d.categoryIds = d.categoryIds.map(id => {
            if (id && id.$oid) return new mongoose.Types.ObjectId(id.$oid);
            if (typeof id === 'string' && id.length === 24) return new mongoose.Types.ObjectId(id);
            return id;
          });
        }
        return d;
      });

      // Drop existing and re-insert
      await mongoose.connection.db.collection(col).deleteMany({});
      if (converted.length > 0) {
        await mongoose.connection.db.collection(col).insertMany(converted);
      }
      console.log(`✓ Imported ${converted.length} documents into "${col}"`);
    }
    console.log('\n✓ Import complete! EC2 database is now synced with local data.');
  } catch (err) {
    console.error('Import failed:', err);
  } finally {
    process.exit(0);
  }
});
