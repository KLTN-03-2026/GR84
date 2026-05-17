/**
 * Test Script: Verify Authentication Account-Merging Fix
 * This script tests the logic in auth.service.js and User model.
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

// Import models and services
import User from '../src/models/User.js';
import authService from '../src/services/auth.service.js';

const runTests = async () => {
  try {
    const mongodbUri = process.env.MONGODB_URI;
    if (!mongodbUri) {
      throw new Error('MONGODB_URI environment variable is missing!');
    }

    console.log('[Test] Connecting to database...');
    await mongoose.connect(mongodbUri);
    console.log('[Test] Connected.');

    const TEST_EMAIL = 'test_auth_bug_fix@gmail.com';
    const TEST_USERNAME = 'test_auth_fix_user';

    // --- CLEANUP ---
    await User.deleteMany({ email: TEST_EMAIL });
    console.log('[Test] Cleaned up existing test data.');

    // =========================================================================
    // TEST 1: Register Google Account and then attempt Local Register
    // =========================================================================
    console.log('\n--- TEST 1: Block Local Register for Google Account ---');
    await User.create({
      username: TEST_USERNAME,
      email: TEST_EMAIL,
      googleId: 'google_test_123',
      authProvider: 'google',
      loginMethod: 'google',
      onboardingCompleted: false
    });
    console.log('   Created a Google account.');

    const regResult = await authService.registerUser({
      username: 'another_temp_user',
      email: TEST_EMAIL,
      password: 'Password123!',
      confirmPassword: 'Password123!'
    });

    if (regResult.error && regResult.status === 409) {
      console.log('   ✅ PASS: Local registration rejected with 409 Conflict.');
      console.log('   Message:', regResult.error);
    } else {
      console.log('   ❌ FAIL: Local registration should have been rejected with 409.');
      console.log('   Result:', regResult);
    }

    // =========================================================================
    // TEST 2: Local Login attempt for Google Account
    // =========================================================================
    console.log('\n--- TEST 2: Block Local Login for Google Account ---');
    const loginResult = await authService.loginUser({
      email: TEST_EMAIL,
      password: 'AnyPassword123'
    });

    if (loginResult.error && loginResult.status === 401) {
      console.log('   ✅ PASS: Local login rejected with 401 Unauthorized.');
      console.log('   Message:', loginResult.error);
    } else {
      console.log('   ❌ FAIL: Local login should have been rejected.');
      console.log('   Result:', loginResult);
    }

    // =========================================================================
    // TEST 3: Social Login Auto-Link to Local Account
    // =========================================================================
    console.log('\n--- TEST 3: Block Silent Social Linking to Local Account ---');
    await User.deleteMany({ email: TEST_EMAIL });
    
    // Create Local account
    await User.create({
      username: TEST_USERNAME,
      email: TEST_EMAIL,
      passwordHash: '$2a$10$dummyhashformigrationtesting', // Simulated hash
      authProvider: 'local',
      loginMethod: 'local'
    });
    console.log('   Created a Local account.');

    const socialResult = await authService.socialLogin({
      googleId: 'google_test_456',
      email: TEST_EMAIL,
      fullName: 'Test User'
    });

    if (socialResult.error && socialResult.status === 409) {
      console.log('   ✅ PASS: Social auto-linking rejected with 409 Conflict.');
      console.log('   Message:', socialResult.error);
    } else {
      console.log('   ❌ FAIL: Social login should NOT have linked silently.');
      console.log('   Result:', socialResult);
    }

    // =========================================================================
    // TEST 4: resolveAuthProvider Backward Compatibility
    // =========================================================================
    console.log('\n--- TEST 4: resolveAuthProvider Backward Compatibility ---');
    await User.deleteMany({ email: TEST_EMAIL });
    
    // Create "Old" user without authProvider but with googleId
    const oldUserRaw = {
      username: TEST_USERNAME,
      email: TEST_EMAIL,
      googleId: 'google_old_789',
      loginMethod: 'google'
    };
    
    // Insert directly bypassing middleware to simulate old data
    await mongoose.connection.collection('users').insertOne({
        ...oldUserRaw,
        createdAt: new Date(),
        updatedAt: new Date()
    });
    
    const oldUser = await User.findOne({ email: TEST_EMAIL });
    console.log('   Simulated "Old" user (no authProvider field):', !!oldUser.authProvider === false);
    
    const resolved = User.resolveAuthProvider(oldUser);
    if (resolved === 'google') {
      console.log('   ✅ PASS: Correctly resolved as "google" via fallback logic.');
    } else {
      console.log('   ❌ FAIL: Should have resolved as "google", but got:', resolved);
    }

    // --- FINAL CLEANUP ---
    await User.deleteMany({ email: TEST_EMAIL });
    await mongoose.connection.close();
    console.log('\n[Test] All tests completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('\n[Test Error] Failed during execution:', error);
    try {
      await mongoose.connection.close();
    } catch (e) {}
    process.exit(1);
  }
};

runTests();
