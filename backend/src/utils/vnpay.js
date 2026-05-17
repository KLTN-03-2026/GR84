import crypto from 'crypto';
import config from '../config/index.js';

/**
 * Sắp xếp Object theo Alphabetical (A-Z)
 */
const sortObject = (obj) => {
  const sorted = {};
  const keys = Object.keys(obj).sort();
  keys.forEach((key) => {
    sorted[key] = obj[key];
  });
  return sorted;
};

/**
 * Chuẩn hóa IPv4
 */
const normalizeIp = (ip) => {
  if (!ip) return '127.0.0.1';
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    return '127.0.0.1';
  }
  if (ip.includes('::ffff:')) {
    ip = ip.replace('::ffff:', '');
  }
  return ip;
};

/**
 * Định dạng ngày yyyyMMddHHmmss
 */
const formatDate = (date) => {
  const pad = (n) => (n < 10 ? '0' + n : n);
  return (
    date.getFullYear() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
};

/**
 * Tạo URL thanh toán VNPAY
 */
export const createVnpayUrl = (req, { amount, txnRef, orderInfo }) => {
  const createDate = formatDate(new Date());

  const rawIp = req.headers['x-forwarded-for'] ||
    req.socket?.remoteAddress ||
    req.ip;
  const ipAddr = normalizeIp(rawIp);

  // Làm sạch orderInfo: Không dấu, không ngoặc, không ký tự đặc biệt
  // LoveAI Premium Monthly hoặc LoveAI Premium Yearly
  const cleanOrderInfo = orderInfo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Khử dấu tiếng Việt
    .replace(/[()]/g, '') // Khử dấu ngoặc
    .trim();

  let vnp_Params = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: config.vnpay.tmnCode,
    vnp_Locale: 'vn',
    vnp_CurrCode: 'VND',
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: cleanOrderInfo,
    vnp_OrderType: 'other',
    vnp_Amount: amount * 100,
    vnp_ReturnUrl: config.vnpay.returnUrl,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: createDate
  };

  // 1. Sắp xếp params
  vnp_Params = sortObject(vnp_Params);

  // 2. Tạo chuỗi ký bằng URLSearchParams (Tự động biến space thành +)
  const signData = new URLSearchParams(vnp_Params).toString();

  // 3. Băm HMAC-SHA512
  const hmac = crypto.createHmac('sha512', config.vnpay.hashSecret);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

  // 4. Gắn chữ ký và build URL cuối cùng
  vnp_Params.vnp_SecureHash = signed;
  const finalUrl = config.vnpay.url + '?' + new URLSearchParams(vnp_Params).toString();

  return finalUrl;
};

/**
 * Xác thực chữ ký trả về từ VNPAY
 */
export const verifyVnpaySignature = (queryParams) => {
  const vnp_Params = { ...queryParams };
  const secureHash = vnp_Params['vnp_SecureHash'];

  delete vnp_Params['vnp_SecureHash'];
  delete vnp_Params['vnp_SecureHashType'];

  // 1. Sắp xếp params
  const sortedParams = sortObject(vnp_Params);

  // 2. Tạo chuỗi ký bằng URLSearchParams
  const signData = new URLSearchParams(sortedParams).toString();

  // 3. Tính toán hash
  const hmac = crypto.createHmac('sha512', config.vnpay.hashSecret);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

  // Debug logs theo yêu cầu
  console.log('========== VNPAY VERIFY DEBUG ==========');
  console.log('RAW SIGN DATA :', signData);
  console.log('COMPUTED HASH :', signed);
  console.log('RECEIVED HASH :', secureHash);
  console.log('MATCH RESULT  :', signed === secureHash);
  console.log('========================================');

  return signed === secureHash;
};