import User from '../models/User.js';
import Payment from '../models/Payment.js';
import PaymentVNPAY from '../models/PaymentVNPAY.js';
import { createMomoPayment, verifyIpnSignature } from '../services/payment/momo.provider.js';

/**
 * Lấy danh sách các gói thành viên
 */
export const getPlans = (req, res) => {
  const plans = [
    {
      id: "free",
      name: "Cơ bản",
      price: 0,
      durationDays: 0,
      features: [
        "Nhắn tin cơ bản",
        "Xem hồ sơ cơ bản",
        "Random Video bị khóa"
      ]
    },
    {
      id: "premium_monthly",
      name: "Premium Monthly",
      price: 49000,
      durationDays: 30,
      features: [
        "Mở khóa Random Video",
        "Huy hiệu Premium nổi bật",
        "Ưu tiên hiển thị hồ sơ",
        "Tăng lượt tương hợp hàng ngày"
      ]
    },
    {
      id: "premium_yearly",
      name: "Premium Yearly",
      price: 399000,
      durationDays: 365,
      features: [
        "Mở khóa Random Video",
        "Huy hiệu Premium nổi bật",
        "Ưu tiên hiển thị hồ sơ",
        "Tăng lượt tương hợp hàng ngày",
        "Tiết kiệm chi phí lên đến 32%"
      ],
      badge: "Tiết kiệm"
    }
  ];

  return res.json({ success: true, data: plans });
};

/**
 * Lấy trạng thái membership của user hiện tại
 */
export const getMembershipStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isPremium = user.isPremium;
    const role = user.role;

    const hasActiveMembership = Boolean(
      user.membership &&
      user.membership.status === "active" &&
      user.membership.premiumUntil &&
      new Date(user.membership.premiumUntil) > new Date()
    );

    let premiumSource = "none";
    if (hasActiveMembership) {
      premiumSource = "membership";
    } else if (role === "premium") {
      premiumSource = "role";
    }

    let remainingDays = 0;
    let premiumUntil = user.membership?.premiumUntil || null;

    if (premiumSource === "membership" && premiumUntil) {
      const diffTime = new Date(premiumUntil) - new Date();
      remainingDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    } else if (premiumSource === "role") {
      if (premiumUntil) {
        const diffTime = new Date(premiumUntil) - new Date();
        remainingDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      } else {
        remainingDays = 365; // Hoặc một số mặc định lớn cho manual override
      }
    }

    return res.json({
      success: true,
      membership: user.membership || { plan: 'free', status: 'inactive', premiumUntil: null },
      role,
      isPremium,
      premiumSource,
      premiumUntil,
      remainingDays
    });
  } catch (error) {
    console.error('[MEMBERSHIP STATUS ERROR]:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Khởi tạo thanh toán MoMo nâng cấp Premium
 */
export const checkout = async (req, res) => {
  const { plan, provider } = req.body;

  if (provider !== 'momo') {
    return res.json({
      success: false,
      message: "Cổng thanh toán này sắp được cập nhật"
    });
  }

  if (plan !== 'premium_monthly' && plan !== 'premium_yearly') {
    return res.status(400).json({ success: false, message: "Gói nâng cấp không hợp lệ" });
  }

  // Thiết lập mức giá tương ứng
  const amount = plan === 'premium_monthly' ? 49000 : 399000;
  const orderId = `LOVEAI_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
  const requestId = `REQ_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
  const orderInfo = `Nang cap LoveAI Premium (${plan === 'premium_monthly' ? 'Monthly' : 'Yearly'})`;

  try {
    const momoResult = await createMomoPayment({
      orderId,
      requestId,
      amount,
      orderInfo
    });

    if (momoResult.success) {
      // Lưu thông tin đơn thanh toán ở trạng thái "pending"
      const payment = await Payment.create({
        userId: req.user.id,
        plan,
        amount,
        orderId,
        requestId,
        status: 'pending',
        paymentUrl: momoResult.payUrl,
        deeplink: momoResult.deeplink,
        qrCodeUrl: momoResult.qrCodeUrl,
        rawRequest: { plan, amount, orderId, requestId, orderInfo }
      });

      return res.json({
        success: true,
        paymentId: orderId,
        paymentUrl: momoResult.payUrl,
        deeplink: momoResult.deeplink,
        qrCodeUrl: momoResult.qrCodeUrl
      });
    } else {
      return res.status(400).json({
        success: false,
        message: momoResult.message || 'Lỗi khởi tạo thanh toán MoMo'
      });
    }
  } catch (error) {
    console.error('[CHECKOUT ERROR]:', error);
    return res.status(500).json({ success: false, message: error.message || 'Lỗi xử lý giao dịch' });
  }
};

/**
 * Kiểm tra trạng thái Payment từ phía Client (Polling)
 */
export const verifyPaymentStatus = async (req, res) => {
  try {
    let payment = await Payment.findOne({ orderId: req.params.paymentId });
    let vnpayPayment = null;
    let status = 'pending';

    if (payment) {
      status = payment.status;
    } else {
      vnpayPayment = await PaymentVNPAY.findOne({ txnRef: req.params.paymentId });
      if (vnpayPayment) {
        status = vnpayPayment.status === 'SUCCESS' ? 'paid' : 
                 vnpayPayment.status === 'FAILED' ? 'failed' : 'pending';
      }
    }

    // FALLBACK: Nếu vẫn đang pending nhưng User đã là Premium thì trả về 'paid' luôn
    if (status === 'pending' && req.user && (req.user.role === 'premium' || req.user.role === 'admin')) {
      console.log('[VERIFY PAYMENT] User is already premium, returning paid status as fallback');
      status = 'paid';
    }

    if (status === 'pending' && !payment && !vnpayPayment) {
      return res.status(404).json({ success: false, message: "Không tìm thấy hóa đơn giao dịch" });
    }

    return res.json({ 
      success: true, 
      status,
      isRenewal: vnpayPayment?.isRenewal || false 
    });
  } catch (error) {
    console.error('[VERIFY PAYMENT ERROR]:', error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Nhận phản hồi IPN trực tiếp từ MoMo Webhook (Public POST Endpoint)
 */
export const momoWebhook = async (req, res) => {
  console.log('[MOMO WEBHOOK] Received IPN hook payload:', JSON.stringify(req.body));

  try {
    // 1. Xác minh chữ ký số của MoMo
    const isValid = verifyIpnSignature(req.body);
    if (!isValid) {
      console.warn('[MOMO WEBHOOK ERROR] Invalid Signature!');
      return res.status(400).json({ message: 'Signature verification failed' });
    }

    const { orderId, requestId, resultCode, transId, amount } = req.body;

    // 2. Tìm hóa đơn tương ứng
    const payment = await Payment.findOne({ orderId, requestId });
    if (!payment) {
      console.error('[MOMO WEBHOOK ERROR] Payment not found for:', { orderId, requestId });
      return res.status(404).json({ message: 'Payment record not found' });
    }

    // 3. Kiểm tra trùng lặp (Idempotent Check)
    if (payment.status === 'paid') {
      console.log('[MOMO WEBHOOK SUCCESS] Already processed paid status for:', orderId);
      return res.status(200).json({ message: 'Success' });
    }

    // 4. Nếu giao dịch thất bại (resultCode !== 0)
    if (resultCode !== 0) {
      console.log(`[MOMO WEBHOOK FAILED] Transaction failed (resultCode: ${resultCode}) for order: ${orderId}`);
      payment.status = 'failed';
      payment.rawResponse = req.body;
      await payment.save();
      return res.status(200).json({ message: 'Success' });
    }

    // 5. Nếu giao dịch thành công (resultCode === 0)
    console.log('[MOMO WEBHOOK SUCCESS] Payment successful, upgrading subscription!');
    payment.status = 'paid';
    payment.transId = String(transId);
    payment.paidAt = new Date();
    payment.rawResponse = req.body;
    await payment.save();

    // 6. Nâng cấp tài khoản User sang Premium
    const user = await User.findById(payment.userId);
    if (user) {
      const durationDays = payment.plan === 'premium_monthly' ? 30 : 365;
      const durationMs = durationDays * 24 * 60 * 60 * 1000;
      
      let currentPremiumUntil = user.membership?.premiumUntil;
      let newPremiumUntil;

      // Nếu user đang là Premium, cộng dồn tiếp vào hạn cũ
      if (currentPremiumUntil && new Date(currentPremiumUntil) > new Date()) {
        newPremiumUntil = new Date(new Date(currentPremiumUntil).getTime() + durationMs);
      } else {
        newPremiumUntil = new Date(Date.now() + durationMs);
      }

      user.membership = {
        plan: payment.plan,
        status: 'active',
        premiumUntil: newPremiumUntil,
        provider: 'momo',
        lastPaymentId: payment._id.toString()
      };

      // Đồng bộ role người dùng cho backward-compatibility
      user.role = 'premium';

      await user.save();
      console.log(`[MOMO WEBHOOK] Upgraded user: ${user.username} to Premium until ${newPremiumUntil}`);
    } else {
      console.error('[MOMO WEBHOOK ERROR] User not found for payment:', payment._id);
    }

    return res.status(200).json({ message: 'Success' });
  } catch (error) {
    console.error('[MOMO WEBHOOK EXCEPTION]:', error);
    return res.status(500).json({ message: 'Webhook processing error' });
  }
};

/**
 * Xử lý chuyển hướng người dùng khi MoMo redirect sau thanh toán
 */
export const momoReturn = (req, res) => {
  const { orderId } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'https://dating-deploy-kxhn.vercel.app';
  
  console.log('[MOMO RETURN] Redirecting customer back to frontend with orderId:', orderId);
  return res.redirect(`${frontendUrl}/#/payment/result?paymentId=${orderId}`);
};
