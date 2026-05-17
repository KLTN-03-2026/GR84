import mongoose from 'mongoose';

const paymentVNPAYSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  plan: {
    type: String,
    enum: ['premium_monthly', 'premium_yearly'],
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'SUCCESS', 'FAILED'],
    default: 'PENDING'
  },
  txnRef: {
    type: String,
    required: true,
    unique: true
  },
  vnpTransactionNo: {
    type: String,
    default: null
  },
  bankCode: {
    type: String,
    default: null
  },
  payDate: {
    type: String,
    default: null
  },
  responseCode: {
    type: String,
    default: null
  },
  isRenewal: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for faster lookups
paymentVNPAYSchema.index({ userId: 1 });
paymentVNPAYSchema.index({ txnRef: 1 }, { unique: true });
paymentVNPAYSchema.index({ status: 1 });

export default mongoose.model('PaymentVNPAY', paymentVNPAYSchema);
