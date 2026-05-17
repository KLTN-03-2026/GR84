/**
 * User Model - Schema mới
 * Hỗ trợ: passwordHash, loginMethod, facebookId, googleId
 * Backward compatible với field "password"
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  // Thông tin đăng nhập
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },

  // Schema mới: passwordHash
  passwordHash: {
    type: String,
    select: false // Mặc định không select password
  },
  password: {
    type: String,
    select: false
  },

  // Social login - KHÔNG có default: null để tránh sparse index issues
  // Khi không có giá trị, field sẽ không tồn tại trong document
  facebookId: {
    type: String,
    sparse: true
  },
  googleId: {
    type: String,
    sparse: true
  },
  loginMethod: {
    type: String,
    enum: ['email', 'facebook', 'google', 'local'],
    default: 'email'
  },
  authProvider: {
    type: String,
    enum: ['local', 'google', 'facebook'],
    default: 'local'
  },

  // Thông tin cá nhân
  fullName: {
    type: String,
    trim: true,
    maxlength: [50, 'Full name cannot exceed 50 characters']
  },
  age: {
    type: Number,
    min: [18, 'You must be at least 18 years old'],
    max: [100, 'Age cannot exceed 100']
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', ''],
    default: ''
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    default: ''
  },
  avatar: {
    type: String,
    default: ''
  },
  aiStatus: { type: String, default: 'pending' },
  photos: [{
    type: String
  }],
  interests: [{
    type: String
  }],

  // GeoJSON Location (for geospatial queries)
  // IMPORTANT: Must be null array [0, 0] for 2dsphere index to work properly
  // Set to null array initially so user can update location later
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
   coordinates: {
          type: [Number],
          default: [108.206230, 16.047079] // [Kinh độ lng, Vĩ độ lat] - Mặc định Đà Nẵng
      }
  },
  // Text location for display (e.g., "Can Tho")
  locationText: {
    type: String,
    default: ''
  },
  occupation: {
    type: String,
    default: ''
  },
  education: {
    type: String,
    default: ''
  },
  height: {
    type: Number,
    min: [100, 'Height must be at least 100cm'],
    max: [250, 'Height cannot exceed 250cm']
  },
  drinking: {
    type: String,
    enum: ['never', 'sometimes', 'often', ''],
    default: ''
  },
  smoking: {
    type: String,
    enum: ['never', 'sometimes', 'often', ''],
    default: ''
  },
  lookingFor: {
    type: String,
    enum: ['relationship', 'friendship', 'casual', ''],
    default: ''
  },

  // Preferences
  preferences: {
    minAge: {
      type: Number,
      default: 18
    },
    maxAge: {
      type: Number,
      default: 50
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'both', ''],
      default: 'both'
    }
  },

  // Trạng thái online
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },

  // Role & Security
  role: {
    type: String,
    enum: ['user', 'premium', 'admin', 'super_admin'],
    default: 'user'
  },
  lastLogin: {
    type: Date
  },
  failedAttempts: {
    type: Number,
    default: 0
  },
  isLocked: {
    type: Boolean,
    default: false
  },

  // OTP & Verification
  otpCode: String,
  otpExpiresAt: Date,
  isEmailVerified: {
    type: Boolean,
    default: false
  },

  // Password Reset OTP (separate from email verification)
  resetOTP: {
    type: String,
    default: null
  },
  resetOtpExpire: {
    type: Date,
    default: null
  },

  // Track OTP requests for rate limiting (max 3 per 5 mins)
  otpRequests: [{
    type: Date
  }],

  // KYC
  kycStatus: {
    type: String,
    enum: ['unverified', 'pending', 'verified'],
    default: 'unverified'
  },
  isVerifiedProfile: {
    type: Boolean,
    default: false // Deprecated: use verificationLevel
  },
  verificationLevel: {
    type: Number,
    enum: [1, 2, 3],
    default: 1
  },
  onboardingCompleted: {
    type: Boolean,
    default: false
  },

  // OCR Verification Data (LV3)
  verifiedFullName: { type: String, default: null },
  verifiedDob: { type: String, default: null },
  verifiedGender: { type: String, default: null },
  verifiedAddress: { type: String, default: null },
  verifiedIdNumber: { type: String, default: null },
  verifiedFaceUrl: { type: String, default: null },
  cccdVerifiedAt: { type: Date, default: null },

  // Fake account detection (từ schema cũ)
  isFake: {
    type: Boolean,
    default: false
  },
  fakeScore: {
    type: Number,
    default: 0
  },

  // Status
  status: {
    type: String,
    enum: ['active', 'banned', 'inactive', 'pending_onboarding'],
    default: 'pending_onboarding'
  },

  // Profile completion (computed)
  profileCompletion: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  membership: {
    plan: {
      type: String,
      enum: ["free", "premium_monthly", "premium_yearly"],
      default: "free"
    },
    status: {
      type: String,
      enum: ["inactive", "active", "expired", "cancelled"],
      default: "inactive"
    },
    premiumUntil: {
      type: Date,
      default: null
    },
    provider: {
      type: String,
      enum: ["manual", "momo", "vnpay", null],
      default: null
    },
    lastPaymentId: {
      type: String,
      default: null
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Helper isUserPremium(user)
export function isUserPremium(user) {
  if (!user) return false;
  const hasActiveMembership = Boolean(
    user.membership &&
    user.membership.status === "active" &&
    user.membership.premiumUntil &&
    new Date(user.membership.premiumUntil) > new Date()
  );

  const hasPremiumRole = user.role === "premium";

  return hasActiveMembership || hasPremiumRole;
}

// Virtual field for checking premium status
userSchema.virtual('isPremium').get(function () {
  return isUserPremium(this);
});

// Indexes
// Note: email, facebookId, googleId indexes are auto-created by `unique: true`
userSchema.index({ username: 'text' });
// Geospatial index for location-based queries
userSchema.index({ location: '2dsphere' });

// Virtual field để backward compatibility
userSchema.virtual('password_field').get(function () {
  return this.passwordHash || this.password;
});

// Method so sánh password
userSchema.methods.matchPassword = async function (enteredPassword) {
  const hashToCompare = this.passwordHash || this.password;
  if (!hashToCompare) return false;
  return await bcrypt.compare(enteredPassword, hashToCompare);
};

// Transform output - loại bỏ password
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.passwordHash;
  if (obj._id) {
    obj.id = obj._id.toString();
  }
  return obj;
};

// Tính profile completion
userSchema.methods.calculateProfileCompletion = function () {
  const user = this;
  let score = 0;

  if (user.avatar && user.avatar.trim() !== '') score += 20;
  if (user.bio && user.bio.trim() !== '') score += 10;
  if (user.age) score += 10;
  // Safe check for GeoJSON location - must be array with 2 valid coordinates
  // and not be the default [0, 0] which indicates unset location
  if (user.location?.coordinates &&
    Array.isArray(user.location.coordinates) &&
    user.location.coordinates.length === 2 &&
    !(user.location.coordinates[0] === 0 && user.location.coordinates[1] === 0)) {
    score += 10;
  }
  if (user.interests && user.interests.length > 0) score += 10;
  if (user.photos && user.photos.length >= 2) score += 20;
  if (user.occupation && user.occupation.trim() !== '') score += 10;
  if (user.education && user.education.trim() !== '') score += 10;
  if (user.gender && user.lookingFor) score += 10;

  return Math.min(score, 100);
};

// Pre-save: hash password và tính profile completion
userSchema.pre('save', async function (next) {
  // MIGRATION: Copy password to passwordHash if passwordHash is missing but password exists
  // This ensures backward compatibility for users created before migration
  if (!this.passwordHash && this.password && !this.password.startsWith('$2')) {
    // Legacy unhashed password - will be hashed below
  } else if (!this.passwordHash && this.password && this.password.startsWith('$2')) {
    // Already hashed password in legacy field - copy to new field
    this.passwordHash = this.password;
    this.password = undefined;
    console.log(`[User Migration] Copied hashed password to passwordHash for user: ${this.username || this._id}`);
  }

  // Hash password mới
  if (this.isModified('password') || (this.isModified('passwordHash') && this.passwordHash && !this.passwordHash.startsWith('$2'))) {
    const salt = await bcrypt.genSalt(10);
    // Hỗ trợ cả password và passwordHash
    const pass = this.passwordHash || this.password;
    if (pass && !pass.startsWith('$2')) {
      this.passwordHash = await bcrypt.hash(pass, salt);
      // Clear legacy password field after migration
      if (this.password) {
        this.password = undefined;
      }
    }
  }

  // MIGRATION: verificationLevel
  if (this.isVerifiedProfile === true && this.verificationLevel === 1) {
    this.verificationLevel = 2;
  }

  // Tính profile completion
  if (!this.profileCompletion || this.profileCompletion === 0) {
    this.profileCompletion = this.calculateProfileCompletion();
  }

  // Ensure authProvider is set for new users if not provided
  if (this.isNew && !this.authProvider) {
    if (this.googleId) this.authProvider = 'google';
    else if (this.facebookId) this.authProvider = 'facebook';
    else this.authProvider = 'local';
  }

  next();
});

// Static method: tìm user bằng email hoặc username
userSchema.statics.findByEmailOrUsername = function (identifier) {
  return this.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { username: identifier }
    ]
  }).select('+password +passwordHash');
};

// Static method: tìm user bằng social ID
userSchema.statics.findByFacebookId = function (facebookId) {
  return this.findOne({ facebookId });
};

userSchema.statics.findByGoogleId = function (googleId) {
  return this.findOne({ googleId });
};

/**
 * Safely determine the authentication provider for a user
 * Handles both new users (with authProvider) and old users (via fallback logic)
 */
userSchema.statics.resolveAuthProvider = function (user) {
  if (!user) return 'local';
  
  // 1. Social ID indicators
  // We check these FIRST because authProvider might have a default 'local' value 
  // applied by Mongoose to old documents that don't actually have it in DB.
  if (user.googleId) return 'google';
  if (user.facebookId) return 'facebook';
  
  // 2. Explicit field (New users / Migrated users)
  if (user.authProvider && user.authProvider !== 'local') return user.authProvider;
  
  // 3. Login method fallback
  if (user.loginMethod === 'google') return 'google';
  if (user.loginMethod === 'facebook') return 'facebook';
  
  // 4. Default to local (email/password)
  return 'local';
};

export default mongoose.model('User', userSchema);
