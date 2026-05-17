const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env from backend/.env
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const User = require('../models/User');

const usage = () => {
  console.log('Usage: node resetAdminPassword.js <newPassword> [adminEmail]');
  console.log('If adminEmail is omitted, ADMIN_EMAIL from .env will be used.');
};

const main = async () => {
  const newPassword = process.argv[2];
  const emailArg = process.argv[3];

  if (!newPassword) {
    usage();
    process.exit(1);
  }

  const adminEmail = emailArg || process.env.ADMIN_EMAIL;
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.error('MONGO_URI is not set in backend/.env');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    let admin = null;
    if (adminEmail) {
      admin = await User.findOne({ email: adminEmail, role: 'admin' }).select('+password');
    }

    if (!admin) {
      // Try by phone env
      const phone = process.env.ADMIN_PHONE;
      if (phone) admin = await User.findOne({ phone, role: 'admin' }).select('+password');
    }

    if (!admin) {
      console.log('No existing admin user found. Creating a new admin user.');
      const userData = {
        name: 'Administrator',
        email: adminEmail || `${process.env.ADMIN_PHONE || 'admin'}@jobmatch.local`,
        phone: process.env.ADMIN_PHONE,
        password: newPassword,
        role: 'admin',
      };
      admin = await User.create(userData);
      console.log('Admin user created with email:', admin.email);
    } else {
      admin.password = newPassword;
      await admin.save();
      console.log('Admin password updated for:', admin.email || admin.phone);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
};

main();
