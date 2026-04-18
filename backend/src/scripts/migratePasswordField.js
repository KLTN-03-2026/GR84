/**
 * Migration Script: Standardize password field
 * 
 * Migrates all users from `password` field to `passwordHash` field
 * Ensures backward compatibility for production deployment
 * 
 * Usage: node migratePasswordField.js
 */

import mongoose from 'mongoose';
import config from './config/index.js';

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  passwordHash: String
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function migratePasswords() {
  try {
    console.log('[Migration] Starting password field migration...');
    console.log('[Migration] Connecting to MongoDB:', config.mongodb.uri);

    await mongoose.connect(config.mongodb.uri);
    console.log('[Migration] Connected to MongoDB');

    // Find all users with password field but no passwordHash
    const usersToMigrate = await User.find({
      password: { $exists: true, $ne: null, $ne: '' },
      passwordHash: { $exists: false }
    });

    console.log(`[Migration] Found ${usersToMigrate.length} users to migrate`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const user of usersToMigrate) {
      try {
        // Check if password is already hashed (starts with $2a, $2b, $2x)
        const isAlreadyHashed = user.password && user.password.startsWith('$2');
        
        if (isAlreadyHashed) {
          // Password is already hashed, just copy to passwordHash
          user.passwordHash = user.password;
          user.password = undefined;
          console.log(`  [Migrate] User ${user.username} (${user.email}): Copying hashed password to passwordHash`);
        } else {
          // Password is plain text (shouldn't happen, but handle it)
          console.log(`  [WARNING] User ${user.username} (${user.email}): Plain text password detected! Skipping for safety.`);
          skippedCount++;
          continue;
        }

        await user.save({ validateBeforeSave: false });
        migratedCount++;
      } catch (error) {
        console.error(`  [ERROR] Failed to migrate user ${user.username}:`, error.message);
        errorCount++;
      }
    }

    // Report stats
    console.log('\n[Migration] === Migration Summary ===');
    console.log(`  Migrated: ${migratedCount}`);
    console.log(`  Skipped:  ${skippedCount}`);
    console.log(`  Errors:   ${errorCount}`);

    // Verify migration
    const remainingLegacy = await User.countDocuments({
      password: { $exists: true, $ne: null, $ne: '' },
      passwordHash: { $exists: false }
    });

    console.log(`\n[Migration] Remaining users with legacy password field: ${remainingLegacy}`);

    if (remainingLegacy > 0) {
      console.log('[Migration] WARNING: Some users were not migrated. Manual intervention required.');
    } else {
      console.log('[Migration] SUCCESS: All users have been migrated to passwordHash field.');
    }

  } catch (error) {
    console.error('[Migration] FATAL ERROR:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('[Migration] Disconnected from MongoDB');
    process.exit(0);
  }
}

migratePasswords();
