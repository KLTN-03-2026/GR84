/**
 * Migration Script: Backfill authProvider field for all users
 * Usage: node scripts/backfill-auth-provider.js [--dry-run]
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

// Import User model
// Note: We need to use the full path and ensure mongoose is connected before some operations
import User from '../src/models/User.js';

const backfill = async () => {
  const isDryRun = process.argv.includes('--dry-run');
  
  try {
    const mongodbUri = process.env.MONGODB_URI;
    if (!mongodbUri) {
      throw new Error('MONGODB_URI environment variable is missing inside .env!');
    }

    console.log(`[Backfill] Starting ${isDryRun ? '(DRY RUN)' : '(ACTUAL RUN)'}`);
    console.log('[Backfill] Connecting to database...');
    await mongoose.connect(mongodbUri);
    console.log('[Backfill] Connected to MongoDB.');

    const users = await User.find({});
    console.log(`[Backfill] Found ${users.length} users to process.`);

    let updatedCount = 0;
    let localCount = 0;
    let googleCount = 0;
    let facebookCount = 0;
    let unchangedCount = 0;

    for (const user of users) {
      const resolved = User.resolveAuthProvider(user);
      
      // Count resolved types
      if (resolved === 'local') localCount++;
      else if (resolved === 'google') googleCount++;
      else if (resolved === 'facebook') facebookCount++;

      // Check if update is actually needed
      // Normalizing loginMethod: 'email' -> 'local' for local users
      const targetLoginMethod = resolved === 'local' ? 'local' : resolved;
      
      const needsUpdate = user.authProvider !== resolved || user.loginMethod !== targetLoginMethod;

      if (needsUpdate) {
        if (!isDryRun) {
          await User.updateOne(
            { _id: user._id },
            { 
              $set: { 
                authProvider: resolved,
                loginMethod: targetLoginMethod
              } 
            }
          );
        }
        updatedCount++;
        console.log(`[Backfill] [${resolved.toUpperCase()}] ${isDryRun ? 'WOULD UPDATE' : 'UPDATED'}: ${user.username || user.email}`);
      } else {
        unchangedCount++;
      }
    }

    console.log('\n===========================================');
    console.log('          BACKFILL MIGRATION SUMMARY       ');
    console.log('===========================================');
    console.log(`Total users processed:   ${users.length}`);
    console.log(`Already correct:         ${unchangedCount}`);
    console.log(`${isDryRun ? 'Pending updates:' : 'Successfully updated:'} ${updatedCount}`);
    console.log('-------------------------------------------');
    console.log(`Resolved as Local:      ${localCount}`);
    console.log(`Resolved as Google:     ${googleCount}`);
    console.log(`Resolved as Facebook:   ${facebookCount}`);
    console.log('===========================================\n');

    if (isDryRun && updatedCount > 0) {
      console.log('💡 Tip: Run without --dry-run to apply these changes to the database.\n');
    }

    await mongoose.connection.close();
    console.log('[Backfill] Database connection closed. Done.');
    process.exit(0);
  } catch (error) {
    console.error('[Backfill Error] Migration failed:', error);
    try {
      await mongoose.connection.close();
    } catch (e) {}
    process.exit(1);
  }
};

backfill();
