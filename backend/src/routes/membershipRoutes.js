import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getPlans,
  getMembershipStatus,
  checkout,
  verifyPaymentStatus,
  momoWebhook,
  momoReturn
} from '../controllers/membership.controller.js';

const router = express.Router();

// Lấy danh sách các gói sản phẩm
router.get('/plans', getPlans);

// Lấy trạng thái membership của người dùng hiện tại (Yêu cầu đăng nhập)
router.get('/me', authenticate, getMembershipStatus);

// Khởi tạo thanh toán MoMo (Yêu cầu đăng nhập)
router.post('/checkout', authenticate, checkout);

// Kiểm tra trạng thái đơn hàng (Yêu cầu đăng nhập)
router.get('/payment/:paymentId', authenticate, verifyPaymentStatus);

// Public Webhook IPN nhận tín hiệu giao dịch từ MoMo
router.post('/webhook/momo', momoWebhook);

// Public Return URL xử lý khách quay lại từ MoMo
router.get('/return/momo', momoReturn);

export default router;
