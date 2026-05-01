const mongoose = require('mongoose');

async function dropIndex() {
  try {
    await mongoose.connect('mongodb://localhost:27017/calculator');
    const db = mongoose.connection.db;
    const collection = db.collection('reporttemplates');
    
    console.log('Indexes before:', await collection.indexes());
    
    try {
      await collection.dropIndex('productId_1');
      console.log('Dropped productId_1 index');
    } catch (e) {
      console.log('Error dropping productId_1:', e.message);
    }

    try {
      await collection.dropIndex('categoryId_1');
      console.log('Dropped categoryId_1 index');
    } catch (e) {
      console.log('Error dropping categoryId_1:', e.message);
    }
    
    console.log('Indexes after:', await collection.indexes());
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

dropIndex();
