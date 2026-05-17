import crypto from 'crypto';
import axios from 'axios';

/**
 * MoMo Gateway Payment Service Provider
 */

const getMomoConfig = () => {
  const redirectUrl = process.env.MOMO_REDIRECT_URL;
  const ipnUrl = process.env.MOMO_IPN_URL;
  const accessKey = process.env.MOMO_ACCESS_KEY;
  const secretKey = process.env.MOMO_SECRET_KEY;
  const isProduction = process.env.NODE_ENV === 'production';

  // 1. Kiểm tra thiếu cấu hình bắt buộc
  if (!redirectUrl || !ipnUrl || !accessKey || !secretKey) {
    const missing = [];
    if (!accessKey) missing.push('MOMO_ACCESS_KEY');
    if (!secretKey) missing.push('MOMO_SECRET_KEY');
    if (!redirectUrl) missing.push('MOMO_REDIRECT_URL');
    if (!ipnUrl) missing.push('MOMO_IPN_URL');

    const errorMsg = `[MOMO CONFIG ERROR] Thiếu cấu hình bắt buộc: ${missing.join(', ')}`;
    console.error(errorMsg);

    // Chế độ production hoặc thiếu URL thì bắt buộc phải dừng và báo lỗi cấu hình
    if (isProduction || !redirectUrl || !ipnUrl) {
      throw new Error(
        'Cấu hình MoMo trên máy chủ chưa hoàn thiện. Vui lòng thiết lập đầy đủ trên Dashboard của Render: ' +
        'MOMO_ACCESS_KEY, MOMO_SECRET_KEY, MOMO_REDIRECT_URL, MOMO_IPN_URL.'
      );
    }
  }

  return {
    partnerCode: process.env.MOMO_PARTNER_CODE || 'MOMO',
    accessKey: accessKey || '',
    secretKey: secretKey || '',
    endpoint: process.env.MOMO_ENDPOINT || process.env.MOMO_API_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create',
    redirectUrl: redirectUrl || 'http://localhost:5000/api/membership/return/momo',
    ipnUrl: ipnUrl || 'http://localhost:5000/api/membership/webhook/momo'
  };
};

/**
 * Gọi API MoMo để sinh link thanh toán
 * @param {Object} params 
 * @param {string} params.orderId
 * @param {string} params.requestId
 * @param {number} params.amount
 * @param {string} params.orderInfo
 */
export const createMomoPayment = async ({ orderId, requestId, amount, orderInfo }) => {
  const config = getMomoConfig();
  const { partnerCode, accessKey, secretKey, endpoint, redirectUrl, ipnUrl } = config;

  if (!accessKey || !secretKey) {
    console.error('[MOMO CONFIG ERROR] Missing MoMo AccessKey or SecretKey inside Environment Variables!');
    throw new Error('Cấu hình MoMo trên máy chủ chưa hoàn thiện.');
  }

  const extraData = ''; // Để trống theo yêu cầu của ứng dụng
  const requestType = 'captureWallet'; // Loại thanh toán bằng ví MoMo
  const lang = 'vi';

  // Sắp xếp các tham số theo thứ tự alphabet để sinh signature
  const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

  // Tính toán signature HMAC-SHA256
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(rawSignature)
    .digest('hex');

  const requestBody = {
    partnerCode,
    partnerName: 'LoveAI Dating',
    storeId: partnerCode,
    requestId,
    amount,
    orderId,
    orderInfo,
    redirectUrl,
    ipnUrl,
    extraData,
    requestType,
    signature,
    lang
  };

  console.log('[MOMO] Sending Payment Request:', {
    orderId,
    requestId,
    amount,
    endpoint,
    ipnUrl,
    redirectUrl
  });

  try {
    const response = await axios.post(endpoint, requestBody, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // Timeout 30 giây theo đặc tả MoMo
    });

    const data = response.data;
    console.log('[MOMO] Response Code:', data.resultCode, '-', data.message);

    return {
      success: data.resultCode === 0,
      resultCode: data.resultCode,
      message: data.message,
      payUrl: data.payUrl || null,
      deeplink: data.deeplink || null,
      qrCodeUrl: data.qrCodeUrl || null,
      rawResponse: data
    };
  } catch (error) {
    if (error.response) {
      console.error('[MOMO API ERROR RESPONSE]:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('[MOMO API EXCEPTION] Failed to connect to MoMo Gateway:', error.message);
    }
    throw new Error('Không thể kết nối đến cổng thanh toán MoMo.');
  }
};

/**
 * Xác thực chữ ký phản hồi IPN từ MoMo
 * @param {Object} payload 
 * @returns {boolean}
 */
export const verifyIpnSignature = (payload) => {
  const { secretKey, accessKey } = getMomoConfig();
  const {
    partnerCode,
    orderId,
    requestId,
    amount,
    orderInfo,
    orderType,
    transId,
    resultCode,
    message,
    payType,
    responseTime,
    extraData,
    signature
  } = payload;

  if (!signature) return false;

  // Sắp xếp các trường nhận được để sinh signature kiểm chứng chéo
  const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}&payType=${payType}`;

  const calculatedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(rawSignature)
    .digest('hex');

  const isValid = calculatedSignature === signature;
  if (!isValid) {
    console.warn('[MOMO WEBHOOK WARNING] IPN signature verification failed!', {
      received: signature,
      calculated: calculatedSignature
    });
  }

  return isValid;
};
