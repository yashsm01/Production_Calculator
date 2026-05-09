const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/calc_engine';

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('Connected to DB');
    const existingAdmin = await User.findOne({ username: 'admin' });
    if (!existingAdmin) {
      await User.create({
        username: 'admin',
        password: 'password123',
        role: 'admin'
      });
      console.log('✅ Created default admin user: admin / password123');
    } else {
      console.log('Admin user already exists');
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
