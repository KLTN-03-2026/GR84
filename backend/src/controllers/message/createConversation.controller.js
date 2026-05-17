/**
 * Create or Get Conversation Controller
 */
import messageService from '../../services/message.service.js';

export const createConversation = async (req, res, next) => {
  try {
    const { receiverId } = req.body;

    if (!receiverId) {
      return res.status(400).json({ 
        success: false, 
        message: 'receiverId is required' 
      });
    }

    console.log(`[Chat] Request to create/open conversation with: ${receiverId}`);

    const result = await messageService.getOrCreateConversation(req.user._id, receiverId);

    if (result.error) {
      return res.status(result.status || 400).json({ 
        success: false, 
        message: result.error 
      });
    }

    res.json({
      success: true,
      conversationId: result.conversation._id,
      conversation: result.conversation
    });
  } catch (error) {
    console.error('[Chat Controller Error]:', error);
    next(error);
  }
};

export default { createConversation };
