/**
 * ID Resolver - Safely resolves a user ID string which can be
 * either a raw hex ObjectId (24 chars) or a Base64 encoded string.
 */
import mongoose from 'mongoose';

export const resolveUserId = (idString) => {
  if (!idString || typeof idString !== 'string') return null;

  const trimmed = idString.trim();

  // 1. If it's already a valid 24-character hexadecimal MongoDB ObjectId, return it as-is
  if (/^[0-9a-fA-F]{24}$/.test(trimmed)) {
    return trimmed;
  }

  // 2. Otherwise, attempt to decode it from Base64
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('ascii');
    // If the decoded result is a valid 24-character hex ObjectId, return it
    if (/^[0-9a-fA-F]{24}$/.test(decoded)) {
      return decoded;
    }
  } catch (err) {
    // Ignore decoding errors and fallback to other checks
  }

  // 3. Fallback to mongoose ObjectId validation on trimmed
  if (mongoose.Types.ObjectId.isValid(trimmed)) {
    return trimmed;
  }

  return null;
};

export default { resolveUserId };
