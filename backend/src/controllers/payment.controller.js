import PaymentVNPAY from '../models/PaymentVNPAY.js';
import User from '../models/User.js';
import { createVnpayUrl, verifyVnpaySignature } from '../utils/vnpay.js';
import config from '../config/index.js';

/**
 * @desc    Tạo URL thanh toán VNPAY
 * @route   POST /api/payment/create-vnpay
 * @access  Private
 */
export const createVnpayPayment = async (req, res) => {
  try {
    const { plan } = req.body; // premium_monthly | premium_yearly
    const userId = req.user.id;

    if (!['premium_monthly', 'premium_yearly'].includes(plan)) {
      return res.status(400).json({ success: false, message: 'Gói thanh toán không hợp lệ' });
    }

    const amount = plan === 'premium_monthly' ? 49000 : 399000;
    const txnRef = `VNP_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;

    // Tạo bản ghi thanh toán PENDING
    await PaymentVNPAY.create({
      userId,
      amount,
      plan,
      txnRef,
      status: 'PENDING'
    });

    const vnpUrl = createVnpayUrl(req, {
      amount,
      txnRef,
      orderInfo: `Nang cap LoveAI Premium (${plan === 'premium_monthly' ? 'Monthly' : 'Yearly'})`
    });

    res.status(200).json({ success: true, url: vnpUrl, txnRef });
  } catch (error) {
    console.error('[VNPAY CHECKOUT ERROR]:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi tạo thanh toán' });
  }
};

/**
 * @desc    Xử lý kết quả trả về từ VNPAY
 * @route   GET /api/payment/vnpay-return
 * @access  Public
 */
export const vnpayReturn = async (req, res) => {
  console.log('[VNPAY RETURN] Received callback from VNPay');
  const vnp_Params = req.query;
  const txnRef = vnp_Params['vnp_TxnRef'];
  const frontendUrl = config.frontendUrl;

  try {
    // 1. Kiểm tra chữ ký
    const isValid = verifyVnpaySignature({ ...vnp_Params });
    console.log('[VNPAY RETURN] Signature Valid:', isValid);

    if (!isValid) {
      console.warn('[VNPAY RETURN ERROR] Invalid Signature for order:', txnRef);
      return res.redirect(`${frontendUrl}/#/payment/result?paymentId=${txnRef}&status=FAILED&error=invalid_signature`);
    }

    const responseCode = vnp_Params['vnp_ResponseCode'];
    const amount = parseInt(vnp_Params['vnp_Amount']) / 100;
    console.log('[VNPAY RETURN] responseCode:', responseCode, 'amount:', amount);

    const payment = await PaymentVNPAY.findOne({ txnRef });
    console.log('[VNPAY RETURN] DB Payment Record Found:', !!payment);

    if (!payment) {
      console.error('[VNPAY RETURN ERROR] Payment not found in DB:', txnRef);
      return res.redirect(`${frontendUrl}/#/payment/result?status=FAILED&error=payment_not_found`);
    }

    if (responseCode === '00') {
      console.log('[VNPAY RETURN] Success code 00 received. Updating DB...');
      payment.status = 'SUCCESS';
      await payment.save();

      console.log('[VNPAY RETURN] Upgrading User ID:', payment.userId);
      const user = await User.findById(payment.userId);
      
      if (user) {
        console.log('[VNPAY RETURN] User found:', user.username);
        const durationDays = payment.plan === 'premium_monthly' ? 30 : 365;
        const durationMs = durationDays * 24 * 60 * 60 * 1000;
        
        const isCurrentlyPremium = user.role === 'premium' && 
                                  user.membership?.premiumUntil && 
                                  new Date(user.membership.premiumUntil) > new Date();
        
        let newPremiumUntil;
        if (isCurrentlyPremium) {
          newPremiumUntil = new Date(new Date(user.membership.premiumUntil).getTime() + durationMs);
        } else {
          newPremiumUntil = new Date(Date.now() + durationMs);
        }

        user.membership = {
          plan: payment.plan,
          status: 'active',
          premiumUntil: newPremiumUntil,
          provider: 'vnpay'
        };
        user.role = 'premium';
        await user.save();

        payment.isRenewal = isCurrentlyPremium;
        await payment.save();
        console.log(`[VNPAY RETURN] USER ${isCurrentlyPremium ? 'RENEWED' : 'UPGRADED'} SUCCESSFULLY!`);
      } else {
        console.error('[VNPAY RETURN ERROR] User not found for upgrade!');
      }

      return res.redirect(`${frontendUrl}/#/payment/result?paymentId=${txnRef}&status=SUCCESS`);
    } else {
      console.warn(`[VNPAY RETURN] Transaction failed with code ${responseCode} for order: ${txnRef}`);
      payment.status = 'FAILED';
      await payment.save();
      return res.redirect(`${frontendUrl}/#/payment/result?paymentId=${txnRef}&status=FAILED&code=${responseCode}`);
    }
  } catch (error) {
    console.error('[VNPAY RETURN EXCEPTION]:', error);
    res.redirect(`${frontendUrl}/#/payment/result?status=FAILED&error=server_error`);
  }
};
