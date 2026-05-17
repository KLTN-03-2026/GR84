/**
 * Command-line Database Migration Wrapper
 * Thích hợp để chạy bằng tay qua npm run migrate:chat
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load dotenv
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import migration utility
import { runDatabaseMigration } from '../src/utils/migration.js';

const executeManualMigration = async () => {
  try {
    const mongodbUri = process.env.MONGODB_URI;
    if (!mongodbUri) {
      throw new Error('MONGODB_URI environment variable is missing inside .env!');
    }

    console.log('[Migration Script] Connecting to:', mongodbUri.replace(/:([^@]+)@/, ':****@'));
    await mongoose.connect(mongodbUri);
    console.log('[Migration Script] Connected to MongoDB.');

    // Run core migration tasks
    await runDatabaseMigration();

    await mongoose.connection.close();
    console.log('[Migration Script] Connection closed. Exit 0.');
    process.exit(0);
  } catch (error) {
    console.error('[Migration Script Error] Failed:', error);
    try {
      await mongoose.connection.close();
    } catch (e) {}
    process.exit(1);
  }
};

executeManualMigration();
