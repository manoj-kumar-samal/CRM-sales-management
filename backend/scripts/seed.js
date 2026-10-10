// Creates demo users: 1 admin, 1 sales manager, 2 sales executives (in the manager's team).
// Safe to run more than once - existing emails are skipped.   Usage: npm run seed
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const { ROLES } = require('../src/config/constants');

const DEMO_PASSWORD = 'Password@123';

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const findOrCreate = async (data) => {
    const existing = await User.findOne({ email: data.email });
    if (existing) {
      console.log(`- exists:  ${data.email}`);
      return existing;
    }
    const user = await User.create(data);
    console.log(`+ created: ${data.email} (${data.role})`);
    return user;
  };

  await findOrCreate({
    name: 'Admin User',
    email: process.env.SEED_ADMIN_EMAIL || 'admin@crm.com',
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin@12345',
    role: ROLES.ADMIN,
  });
  const manager = await findOrCreate({ name: 'Maya Manager', email: 'manager@crm.com', password: DEMO_PASSWORD, role: ROLES.MANAGER });
  await findOrCreate({ name: 'Ethan Executive', email: 'ethan@crm.com', password: DEMO_PASSWORD, role: ROLES.EXECUTIVE, manager: manager._id });
  await findOrCreate({ name: 'Priya Executive', email: 'priya@crm.com', password: DEMO_PASSWORD, role: ROLES.EXECUTIVE, manager: manager._id });

  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));

  console.log('\nDemo password for manager/executives:', DEMO_PASSWORD);
  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
