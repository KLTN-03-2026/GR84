import mongoose from 'mongoose';
import { syncAllTagsUsage } from './src/services/tagSync.service.js';

async function run() {
    await mongoose.connect('mongodb://127.0.0.1:27017/dating-app');
    console.log('Connected to MongoDB');
    const result = await syncAllTagsUsage();
    console.log(result);
    await mongoose.disconnect();
}
run();
