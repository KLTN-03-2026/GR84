import mongoose from 'mongoose';
import config from './src/config/index.js';
import UserSession from './src/models/UserSession.js';

await mongoose.connect(config.mongodbUri);
const result = await UserSession.deleteMany({});
console.log(`✅ Đã xóa ${result.deletedCount} orphaned sessions`);
await mongoose.disconnect();
process.exit(0);
