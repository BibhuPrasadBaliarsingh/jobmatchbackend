const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
const User = require('../models/User');

const main = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI not set in backend/.env');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    const email = process.env.ADMIN_EMAIL;
    const phone = process.env.ADMIN_PHONE;

    let admin = null;
    if (email) admin = await User.findOne({ email, role: 'admin' }).select('+password');
    if (!admin && phone) admin = await User.findOne({ phone, role: 'admin' }).select('+password');
    if (!admin) {
      console.log('No admin user found with ADMIN_EMAIL or ADMIN_PHONE');
      process.exit(0);
    }

    const out = {
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      role: admin.role,
      passwordStored: !!admin.password,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };

    console.log(JSON.stringify(out, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
};

main();
