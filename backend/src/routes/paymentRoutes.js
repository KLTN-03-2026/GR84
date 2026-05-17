import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { createVnpayPayment, vnpayReturn } from '../controllers/payment.controller.js';

const router = express.Router();

// Tạo thanh toán VNPAY (Yêu cầu đăng nhập)
router.post('/create-vnpay', authenticate, createVnpayPayment);

// Callback từ VNPAY (Public)
router.get('/vnpay-return', vnpayReturn);

export default router;
