import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['match', 'like', 'message', 'ai', 'system'],
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  matchedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  matchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match'
  },
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    unique: true,
    sparse: true
  },
  content: {
    type: String,
    default: ''
  },
  message: {
    type: String,
    default: ''
  },
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
