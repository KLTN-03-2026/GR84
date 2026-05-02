/**
 * Get Recommended Users Controller - Thin layer, delegates to service
 */
import userService from '../../services/user.service.js';

export const getRecommendedUsers = async (req, res, next) => {
  try {
    // ✅ FIX: Check if refresh PARAM EXISTS (not just 'true')
    // Frontend sends timestamp like ?refresh=1740816000000
    const isRefresh = !!req.query.refresh;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    console.log('[GetRecommendedUsers] isRefresh:', isRefresh, '| page:', page, '| limit:', limit);

    const result = await userService.getRecommendedUsers(req.user._id, {
      refresh: isRefresh,
      page,
      limit
    });

    if (result.error) {
      return res.status(result.status).json({ success: false, message: result.error });
    }

    console.log('[GetRecommendedUsers] returning', result.users?.length, 'users with pagination');

    // Return with pagination metadata and secure data payload
    const secureUsers = result.users.map(u => {
      // Create a plain object to avoid modifying the Mongoose document directly
      const uObj = typeof u.toJSON === 'function' ? u.toJSON() : { ...u };
      
      // Absolute PII Removal
      delete uObj.email;
      delete uObj.password;
      delete uObj.passwordHash;
      
      // Hide Database ID by replacing it with a Base64 encoded string
      if (uObj._id) {
        uObj.id = Buffer.from(uObj._id.toString()).toString('base64');
        delete uObj._id;
      }
      
      return uObj;
    });

    return res.json({
      success: true,
      users: secureUsers,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

export default { getRecommendedUsers };
