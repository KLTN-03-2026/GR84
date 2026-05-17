# ===========================================
# RENDER DEPLOYMENT GUIDE
# ===========================================
# Backend API deploy lên Render
# Hướng dẫn chi tiết: https://render.com/docs
# ===========================================

## Yêu cầu:
- Node.js 18+
- GitHub repository

## Deploy Backend trên Render

### Bước 1: Push code lên GitHub
```bash
cd backend
git init
git add .
git commit -m "Backend API"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/dating-app-backend.git
git push -u origin main
```

### Bước 2: Tạo Web Service trên Render
1. Truy cập https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect GitHub repository `dating-app-backend`
4. Cấu hình:
   - **Name:** `dating-app-api`
   - **Region:** Oregon (hoặc gần nhất)
   - **Branch:** `main`
   - **Runtime:** Node
   - **Build Command:** `npm ci --only=production`
   - **Start Command:** `npm start`
   - **Plan:** Free

### Bước 3: Thêm Environment Variables
Trong Render dashboard → Environment tab:

```env
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dating-app
JWT_SECRET=your-production-jwt-secret-min-32-chars
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://dating-app-api.onrender.com/api/auth/google/callback
FRONTEND_URL=https://your-frontend.vercel.app
ALLOWED_ORIGINS=https://your-frontend.vercel.app
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
MAX_FILE_SIZE=5242880
```

### Bước 4: Deploy
- Click **"Create Web Service"**
- Render sẽ tự động build và deploy
- Sau khi xong, URL sẽ là: `https://dating-app-api.onrender.com`

## Deploy Frontend trên Vercel

### Bước 1: Push frontend lên GitHub (nếu chưa có)
```bash
cd frontend
git init
git add .
git commit -m "Frontend"
git remote add origin https://github.com/YOUR_USERNAME/dating-app-frontend.git
git push -u origin main
```

### Bước 2: Import vào Vercel
1. Truy cập https://vercel.com
2. Import GitHub repository `dating-app-frontend`
3. Framework: **Vite**
4. Build Command: `npm run build`
5. Output Directory: `dist`

### Bước 3: Thêm Environment Variables
```env
VITE_API_URL=https://dating-app-api.onrender.com
VITE_API_BASE_URL=https://dating-app-api.onrender.com
VITE_SOCKET_URL=https://dating-app-api.onrender.com
```

## Sau khi deploy thành công

### 1. Test Backend
```bash
curl https://dating-app-api.onrender.com/api/health
```

### 2. Cập nhật CORS trên Backend
Đảm bảo `ALLOWED_ORIGINS` trong Render env chứa frontend URL:
```
ALLOWED_ORIGINS=https://dating-app-frontend.vercel.app
```

### 3. Test OAuth Callback
```
https://dating-app-api.onrender.com/api/auth/google
```

## Lưu ý quan trọng

1. **PORT:** Render tự động gán PORT, code đã dùng `process.env.PORT`
2. **Health Check:** Endpoint `/api/health` đã có sẵn
3. **CORS:** Backend cấu hình CORS cho Vercel frontend
4. **Socket.IO:** Hoạt động mặc định trên Render
5. **MongoDB:** Dùng MongoDB Atlas (connection string đã có)
6. **Cold Start:** Free tier có cold start ~30s lần đầu

## Troubleshooting

### Lỗi 503 Service Unavailable
- Kiểm tra health check endpoint
- Kiểm tra logs trên Render dashboard

### Lỗi CORS
- Kiểm tra `ALLOWED_ORIGINS` có chứa đúng frontend URL
- Đảm bảo protocol khớp (https://)

### Lỗi kết nối Database
- Kiểm tra `MONGODB_URI` trong Render env
- Kiểm tra IP whitelist trên MongoDB Atlas