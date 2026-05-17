import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  plan: {
    type: String,
    enum: ["premium_monthly", "premium_yearly"],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: "VND"
  },
  provider: {
    type: String,
    default: "momo"
  },
  status: {
    type: String,
    enum: ["pending", "paid", "failed", "cancelled", "expired"],
    default: "pending"
  },
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  requestId: {
    type: String,
    required: true,
    unique: true
  },
  transId: {
    type: String,
    default: null
  },
  paymentUrl: {
    type: String,
    default: null
  },
  deeplink: {
    type: String,
    default: null
  },
  qrCodeUrl: {
    type: String,
    default: null
  },
  rawRequest: {
    type: Object,
    default: null
  },
  rawResponse: {
    type: Object,
    default: null
  },
  paidAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Safe indexes declaration
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ orderId: 1 }, { unique: true });
paymentSchema.index({ requestId: 1 }, { unique: true });
paymentSchema.index({ status: 1 });
paymentSchema.index({ provider: 1 });

export default mongoose.model('Payment', paymentSchema);
