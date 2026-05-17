# 🚀 Dating App API Documentation

> **Generated on:** 2026-05-11T08:57:28.670Z
> **Total API Endpoints:** 85
> **Total Socket Events:** 27

## 📑 Table of Contents
- [ADMIN APIs](#admin-apis)
- [AI APIs](#ai-apis)
- [AUTH APIs](#auth-apis)
- [DISCOVERY APIs](#discovery-apis)
- [INTEREST APIs](#interest-apis)
- [MATCH APIs](#match-apis)
- [MESSAGE APIs](#message-apis)
- [PROFILE APIs](#profile-apis)
- [SAFETY APIs](#safety-apis)
- [USERPROFILE APIs](#userprofile-apis)
- [USER APIs](#user-apis)
- [Websocket Events](#websocket-events)
- [Auto Analysis & Security Report](#auto-analysis--security-report)


---

## 🧩 ADMIN APIs

### Admin Login

**Endpoint**: `POST /api/admin/login`

**Description**: Xử lý request /api/admin/login

**Authentication**: ❌ None / Optional

**Request Body Example**:
```json
{
    "username": "admin",
    "password": "AdminPassword123!"
}
```

**Controller**: `adminLogin` (in `adminRoutes.js`)

<br/>

### POST /api/admin/logout

**Endpoint**: `POST /api/admin/logout`

**Description**: Xử lý request /api/admin/logout

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `adminLogout` (in `adminRoutes.js`)

<br/>

### POST /api/admin/forgot-password

**Endpoint**: `POST /api/admin/forgot-password`

**Description**: Xử lý request /api/admin/forgot-password

**Authentication**: ❌ None / Optional

**Controller**: `adminForgotPassword` (in `adminRoutes.js`)

<br/>

### POST /api/admin/verify-otp

**Endpoint**: `POST /api/admin/verify-otp`

**Description**: Xử lý request /api/admin/verify-otp

**Authentication**: ❌ None / Optional

**Controller**: `adminVerifyOTP` (in `adminRoutes.js`)

<br/>

### POST /api/admin/reset-password

**Endpoint**: `POST /api/admin/reset-password`

**Description**: Xử lý request /api/admin/reset-password

**Authentication**: ❌ None / Optional

**Controller**: `adminResetPassword` (in `adminRoutes.js`)

<br/>

### Get Admin Info

**Endpoint**: `GET /api/admin/me`

**Description**: Xử lý request /api/admin/me

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `getCurrentUser` (in `adminRoutes.js`)

<br/>

### Get Users

**Endpoint**: `GET /api/admin/users`

**Description**: Xử lý request /api/admin/users

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `getUsers` (in `adminRoutes.js`)

<br/>

### Toggle User Status

**Endpoint**: `PUT /api/admin/users/:id/status`

**Description**: Xử lý request /api/admin/users/:id/status

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `toggleUserStatus` (in `adminRoutes.js`)

<br/>

### Update User Role

**Endpoint**: `PUT /api/admin/users/:id/role`

**Description**: Xử lý request /api/admin/users/:id/role

**Authentication**: ✅ Required (Bearer Token)

**Request Body Example**:
```json
{
    "role": "premium"
}
```

**Controller**: `updateUserRole` (in `adminRoutes.js`)

<br/>

### Get Categories

**Endpoint**: `GET /api/admin/categories`

**Description**: Xử lý request /api/admin/categories

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `getCategories` (in `adminRoutes.js`)

<br/>

### POST /api/admin/categories/sync

**Endpoint**: `POST /api/admin/categories/sync`

**Description**: Xử lý request /api/admin/categories/sync

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `syncCategories` (in `adminRoutes.js`)

<br/>

### Add Category

**Endpoint**: `POST /api/admin/categories`

**Description**: Xử lý request /api/admin/categories

**Authentication**: ✅ Required (Bearer Token)

**Request Body Example**:
```json
{
    "name": "Đọc sách",
    "category": "interest",
    "description": "Sở thích đọc sách",
    "icon": "book"
}
```

**Controller**: `addCategory` (in `adminRoutes.js`)

<br/>

### Update Category

**Endpoint**: `PUT /api/admin/categories/:id`

**Description**: Xử lý request /api/admin/categories/:id

**Authentication**: ✅ Required (Bearer Token)

**Request Body Example**:
```json
{
    "name": "Đọc sách (v2)",
    "category": "interest",
    "description": "Sở thích đọc sách đã cập nhật"
}
```

**Controller**: `updateCategory` (in `adminRoutes.js`)

<br/>

### DELETE /api/admin/categories/:id

**Endpoint**: `DELETE /api/admin/categories/:id`

**Description**: Xử lý request /api/admin/categories/:id

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `deleteCategory` (in `adminRoutes.js`)

<br/>

### Toggle Category Status

**Endpoint**: `PUT /api/admin/categories/:id/status`

**Description**: Xử lý request /api/admin/categories/:id/status

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `toggleCategoryStatus` (in `adminRoutes.js`)

<br/>

### Get Dashboard Stats

**Endpoint**: `GET /api/admin/dashboard/stats`

**Description**: Xử lý request /api/admin/dashboard/stats

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `getDashboardStats` (in `adminRoutes.js`)

<br/>

### Get User Growth

**Endpoint**: `GET /api/admin/dashboard/growth`

**Description**: Xử lý request /api/admin/dashboard/growth

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `getUserGrowth` (in `adminRoutes.js`)

<br/>

### Get Gender Distribution

**Endpoint**: `GET /api/admin/dashboard/gender`

**Description**: Xử lý request /api/admin/dashboard/gender

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `getGenderDistribution` (in `adminRoutes.js`)

<br/>

### Get Recent Users

**Endpoint**: `GET /api/admin/dashboard/recent-users`

**Description**: Xử lý request /api/admin/dashboard/recent-users

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `getRecentUsers` (in `adminRoutes.js`)

<br/>

### GET /api/admin/sessions

**Endpoint**: `GET /api/admin/sessions`

**Description**: Xử lý request /api/admin/sessions

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `getSessions` (in `adminRoutes.js`)

<br/>

### GET /api/admin/sessions/stats

**Endpoint**: `GET /api/admin/sessions/stats`

**Description**: Xử lý request /api/admin/sessions/stats

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `getSessionStats` (in `adminRoutes.js`)

<br/>

### POST /api/admin/sessions/bulk-kill

**Endpoint**: `POST /api/admin/sessions/bulk-kill`

**Description**: Xử lý request /api/admin/sessions/bulk-kill

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `bulkKillSessions` (in `adminRoutes.js`)

<br/>

### POST /api/admin/sessions/:id/kill

**Endpoint**: `POST /api/admin/sessions/:id/kill`

**Description**: Xử lý request /api/admin/sessions/:id/kill

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `killSession` (in `adminRoutes.js`)

<br/>

### GET /api/admin/logs

**Endpoint**: `GET /api/admin/logs`

**Description**: Xử lý request /api/admin/logs

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `getAdminLogs` (in `adminRoutes.js`)

<br/>

### GET /api/admin/logs/export/excel

**Endpoint**: `GET /api/admin/logs/export/excel`

**Description**: Xử lý request /api/admin/logs/export/excel

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `exportExcel` (in `adminRoutes.js`)

<br/>

### GET /api/admin/logs/export/pdf

**Endpoint**: `GET /api/admin/logs/export/pdf`

**Description**: Xử lý request /api/admin/logs/export/pdf

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `exportPDF` (in `adminRoutes.js`)

<br/>


---

## 🧩 AI APIs

### POST /api/ai/match

**Endpoint**: `POST /api/ai/match`

**Description**: Xử lý request /api/ai/match

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `aiController.getDiscovery` (in `ai.routes.js`)

<br/>

### POST /api/ai/like

**Endpoint**: `POST /api/ai/like`

**Description**: Xử lý request /api/ai/like

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `aiController.sendLike` (in `ai.routes.js`)

<br/>

### POST /api/ai/icebreaker

**Endpoint**: `POST /api/ai/icebreaker`

**Description**: Xử lý request /api/ai/icebreaker

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `aiController.getIcebreaker` (in `ai.routes.js`)

<br/>

### POST /api/ai/photo/:action

**Endpoint**: `POST /api/ai/photo/:action`

**Description**: Xử lý request /api/ai/photo/:action

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `upload.single` (in `ai.routes.js`)

<br/>

### POST /api/ai/sync

**Endpoint**: `POST /api/ai/sync`

**Description**: Xử lý request /api/ai/sync

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `maxCount: 1 }
]` (in `ai.routes.js`)

<br/>

### POST /api/ai/pass

**Endpoint**: `POST /api/ai/pass`

**Description**: Xử lý request /api/ai/pass

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `aiController.sendPass` (in `ai.routes.js`)

<br/>

### POST /api/ai/verify-biometric

**Endpoint**: `POST /api/ai/verify-biometric`

**Description**: Xử lý request /api/ai/verify-biometric

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `upload.single` (in `ai.routes.js`)

<br/>

### POST /api/ai/verify-cccd

**Endpoint**: `POST /api/ai/verify-cccd`

**Description**: Xử lý request /api/ai/verify-cccd

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `maxCount: 1 }
]` (in `ai.routes.js`)

<br/>


---

## 🧩 AUTH APIs

### GET /api/auth/google

**Endpoint**: `GET /api/auth/google`

**Description**: Xử lý request /api/auth/google

**Authentication**: ❌ None / Optional

**Controller**: `next` (in `authRoutes.js`)

<br/>

### GET /api/auth/google/callback

**Endpoint**: `GET /api/auth/google/callback`

**Description**: Xử lý request /api/auth/google/callback

**Authentication**: ❌ None / Optional

**Controller**: `next` (in `authRoutes.js`)

<br/>

### GET /api/auth/facebook

**Endpoint**: `GET /api/auth/facebook`

**Description**: Xử lý request /api/auth/facebook

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `prompt: 'select_account'
  }` (in `authRoutes.js`)

<br/>

### GET /api/auth/facebook/callback

**Endpoint**: `GET /api/auth/facebook/callback`

**Description**: Xử lý request /api/auth/facebook/callback

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `session: false
  }` (in `authRoutes.js`)

<br/>

### Register

**Endpoint**: `POST /api/auth/register`

**Description**: Xử lý request /api/auth/register

**Authentication**: ❌ None / Optional

**Request Body Example**:
```json
{
    "username": "testuser",
    "email": "testuser@example.com",
    "password": "Password123!",
    "confirmPassword": "Password123!"
}
```

**Controller**: `next` (in `authRoutes.js`)

<br/>

### POST /api/auth/register-json

**Endpoint**: `POST /api/auth/register-json`

**Description**: Xử lý request /api/auth/register-json

**Authentication**: ❌ None / Optional

**Controller**: `register` (in `authRoutes.js`)

<br/>

### Login

**Endpoint**: `POST /api/auth/login`

**Description**: Xử lý request /api/auth/login

**Authentication**: ❌ None / Optional

**Request Body Example**:
```json
{
    "email": "testuser@example.com",
    "password": "Password123!"
}
```

**Controller**: `next` (in `authRoutes.js`)

<br/>

### POST /api/auth/google-login

**Endpoint**: `POST /api/auth/google-login`

**Description**: Xử lý request /api/auth/google-login

**Authentication**: ❌ None / Optional

**Controller**: `googleLogin` (in `authRoutes.js`)

<br/>

### Get Current User (Me)

**Endpoint**: `GET /api/auth/me`

**Description**: Xử lý request /api/auth/me

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `getCurrentUser` (in `authRoutes.js`)

<br/>

### Logout

**Endpoint**: `POST /api/auth/logout`

**Description**: Xử lý request /api/auth/logout

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `logout` (in `authRoutes.js`)

<br/>

### POST /api/auth/link-facebook

**Endpoint**: `POST /api/auth/link-facebook`

**Description**: Xử lý request /api/auth/link-facebook

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `linkFacebook` (in `authRoutes.js`)

<br/>

### POST /api/auth/link-google

**Endpoint**: `POST /api/auth/link-google`

**Description**: Xử lý request /api/auth/link-google

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `linkGoogle` (in `authRoutes.js`)

<br/>

### Password Reset - Forgot Password

**Endpoint**: `POST /api/auth/forgot-password`

**Description**: Xử lý request /api/auth/forgot-password

**Authentication**: ❌ None / Optional

**Request Body Example**:
```json
{
    "email": "testuser@example.com"
}
```

**Controller**: `forgotPassword` (in `authRoutes.js`)

<br/>

### POST /api/auth/send-otp

**Endpoint**: `POST /api/auth/send-otp`

**Description**: Xử lý request /api/auth/send-otp

**Authentication**: ❌ None / Optional

**Controller**: `forgotPassword` (in `authRoutes.js`)

<br/>

### Password Reset - Verify OTP

**Endpoint**: `POST /api/auth/verify-otp`

**Description**: Xử lý request /api/auth/verify-otp

**Authentication**: ❌ None / Optional

**Request Body Example**:
```json
{
    "email": "testuser@example.com",
    "otp": "123456"
}
```

**Controller**: `verifyOTP` (in `authRoutes.js`)

<br/>

### Password Reset - Reset Password

**Endpoint**: `POST /api/auth/reset-password`

**Description**: Xử lý request /api/auth/reset-password

**Authentication**: ❌ None / Optional

**Request Body Example**:
```json
{
    "email": "testuser@example.com",
    "otp": "123456",
    "newPassword": "NewPassword123!"
}
```

**Controller**: `resetPassword` (in `authRoutes.js`)

<br/>


---

## 🧩 DISCOVERY APIs

### POST /api/update-location

**Endpoint**: `POST /api/update-location`

**Description**: Xử lý request /api/update-location

**Authentication**: ❌ None / Optional

**Controller**: `updateLocation` (in `discovery.routes.js`)

<br/>

### GET /api/discovery

**Endpoint**: `GET /api/discovery`

**Description**: Xử lý request /api/discovery

**Authentication**: ❌ None / Optional

**Controller**: `discoverUsers` (in `discovery.routes.js`)

<br/>


---

## 🧩 INTEREST APIs

### GET /api/tags

**Endpoint**: `GET /api/tags`

**Description**: Xử lý request /api/tags

**Authentication**: ❌ None / Optional

**Controller**: `getTags` (in `interest.routes.js`)

<br/>

### Get User By ID

**Endpoint**: `GET /api/users/interests`

**Description**: Xử lý request /api/users/interests

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `getUserInterests` (in `interest.routes.js`)

<br/>

### POST /api/users/interests

**Endpoint**: `POST /api/users/interests`

**Description**: Xử lý request /api/users/interests

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `updateUserInterests` (in `interest.routes.js`)

<br/>

### POST /api/users/interests/add

**Endpoint**: `POST /api/users/interests/add`

**Description**: Xử lý request /api/users/interests/add

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `addUserInterest` (in `interest.routes.js`)

<br/>

### DELETE /api/users/interests/:tagId

**Endpoint**: `DELETE /api/users/interests/:tagId`

**Description**: Xử lý request /api/users/interests/:tagId

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `removeUserInterest` (in `interest.routes.js`)

<br/>


---

## 🧩 MATCH APIs

### Like User

**Endpoint**: `POST /api/match/like`

**Description**: Xử lý request /api/match/like

**Authentication**: ✅ Required (Bearer Token)

**Request Body Example**:
```json
{
    "targetUserId": "user_id_here"
}
```

**Controller**: `likeUser` (in `matchRoutes.js`)

<br/>

### Pass User

**Endpoint**: `POST /api/match/pass`

**Description**: Xử lý request /api/match/pass

**Authentication**: ✅ Required (Bearer Token)

**Request Body Example**:
```json
{
    "targetUserId": "user_id_here"
}
```

**Controller**: `passUser` (in `matchRoutes.js`)

<br/>

### POST /api/match/super

**Endpoint**: `POST /api/match/super`

**Description**: Xử lý request /api/match/super

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `superLikeUser` (in `matchRoutes.js`)

<br/>

### Get Likes

**Endpoint**: `GET /api/match/likes`

**Description**: Xử lý request /api/match/likes

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `getLikes` (in `matchRoutes.js`)

<br/>

### Get Mutual Likes

**Endpoint**: `GET /api/match/mutual`

**Description**: Xử lý request /api/match/mutual

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `getMutualLikes` (in `matchRoutes.js`)

<br/>

### Get Swipe History

**Endpoint**: `GET /api/match/swipes`

**Description**: Xử lý request /api/match/swipes

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `getSwipeHistory` (in `matchRoutes.js`)

<br/>

### Unmatch

**Endpoint**: `DELETE /api/match/:matchId`

**Description**: Xử lý request /api/match/:matchId

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `unmatch` (in `matchRoutes.js`)

<br/>


---

## 🧩 MESSAGE APIs

### Get Conversations

**Endpoint**: `GET /api/messages/conversations`

**Description**: Xử lý request /api/messages/conversations

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `getConversations` (in `messageRoutes.js`)

<br/>

### Get Conversations

**Endpoint**: `GET /api/messages/:matchId`

**Description**: Xử lý request /api/messages/:matchId

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `getMessages` (in `messageRoutes.js`)

<br/>

### Send Message

**Endpoint**: `POST /api/messages/:matchId`

**Description**: Xử lý request /api/messages/:matchId

**Authentication**: ✅ Required (Bearer Token)

**Request Body Example**:
```json
{
    "content": "Hello, how are you?"
}
```

**Controller**: `sendMessage` (in `messageRoutes.js`)

<br/>

### Mark As Read

**Endpoint**: `PUT /api/messages/:matchId/read`

**Description**: Xử lý request /api/messages/:matchId/read

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `markAsRead` (in `messageRoutes.js`)

<br/>

### POST /api/messages/:matchId/media

**Endpoint**: `POST /api/messages/:matchId/media`

**Description**: Xử lý request /api/messages/:matchId/media

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `uploadMessageImage` (in `messageRoutes.js`)

<br/>


---

## 🧩 PROFILE APIs

### GET /api/v1/profiles/stats

**Endpoint**: `GET /api/v1/profiles/stats`

**Description**: Xử lý request /api/v1/profiles/stats

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `getProfileStats` (in `profileRoutes.js`)

<br/>

### GET /api/v1/profiles/:userId/full

**Endpoint**: `GET /api/v1/profiles/:userId/full`

**Description**: Xử lý request /api/v1/profiles/:userId/full

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `getProfileDetail` (in `profileRoutes.js`)

<br/>

### GET /api/v1/profiles/:userId

**Endpoint**: `GET /api/v1/profiles/:userId`

**Description**: Xử lý request /api/v1/profiles/:userId

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `getProfile` (in `profileRoutes.js`)

<br/>


---

## 🧩 SAFETY APIs

### POST /api/report

**Endpoint**: `POST /api/report`

**Description**: Xử lý request /api/report

**Authentication**: ❌ None / Optional

**Controller**: `createReport` (in `safety.routes.js`)

<br/>

### GET /api/report/reasons

**Endpoint**: `GET /api/report/reasons`

**Description**: Xử lý request /api/report/reasons

**Authentication**: ❌ None / Optional

**Controller**: `getReportReasons` (in `safety.routes.js`)

<br/>

### POST /api/block

**Endpoint**: `POST /api/block`

**Description**: Xử lý request /api/block

**Authentication**: ❌ None / Optional

**Controller**: `createBlock` (in `safety.routes.js`)

<br/>

### GET /api/block

**Endpoint**: `GET /api/block`

**Description**: Xử lý request /api/block

**Authentication**: ❌ None / Optional

**Controller**: `getBlockedUsers` (in `safety.routes.js`)

<br/>

### DELETE /api/block/:targetId

**Endpoint**: `DELETE /api/block/:targetId`

**Description**: Xử lý request /api/block/:targetId

**Authentication**: ❌ None / Optional

**Controller**: `unblockUser` (in `safety.routes.js`)

<br/>


---

## 🧩 USERPROFILE APIs

### GET /api/profile/

**Endpoint**: `GET /api/profile/`

**Description**: Xử lý request /api/profile/

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `getMyProfile` (in `userProfile.routes.js`)

<br/>

### PUT /api/profile/

**Endpoint**: `PUT /api/profile/`

**Description**: Xử lý request /api/profile/

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `updateMyProfile` (in `userProfile.routes.js`)

<br/>

### GET /api/profile/stats

**Endpoint**: `GET /api/profile/stats`

**Description**: Xử lý request /api/profile/stats

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `getMyProfileStats` (in `userProfile.routes.js`)

<br/>


---

## 🧩 USER APIs

### Get User By ID

**Endpoint**: `GET /api/users/`

**Description**: Xử lý request /api/users/

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `getUsers` (in `userRoutes.js`)

<br/>

### Get Recommendations

**Endpoint**: `GET /api/users/recommendations`

**Description**: Xử lý request /api/users/recommendations

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `getRecommendedUsers` (in `userRoutes.js`)

<br/>

### Get User Matches

**Endpoint**: `GET /api/users/matches`

**Description**: Xử lý request /api/users/matches

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `getUserMatches` (in `userRoutes.js`)

<br/>

### Get Recommendations

**Endpoint**: `GET /api/users/:id`

**Description**: Xử lý request /api/users/:id

**Authentication**: ✅ Required (Bearer Token)

**Controller**: `getUserById` (in `userRoutes.js`)

<br/>


---

## 🔌 Websocket Events

### Liệt kê Events
| Event Name | Type | Handler File |
|---|---|---|
| `join_room` | 📥 Listen (Client -> Server) | `index.js` |
| `leave_room` | 📥 Listen (Client -> Server) | `index.js` |
| `send_message` | 📥 Listen (Client -> Server) | `index.js` |
| `typing` | 📥 Listen (Client -> Server) | `index.js` |
| `stop_typing` | 📥 Listen (Client -> Server) | `index.js` |
| `message_read` | 📥 Listen (Client -> Server) | `index.js` |
| `find_random_partner` | 📥 Listen (Client -> Server) | `index.js` |
| `cancel_find_partner` | 📥 Listen (Client -> Server) | `index.js` |
| `next_random` | 📥 Listen (Client -> Server) | `index.js` |
| `end_random_session` | 📥 Listen (Client -> Server) | `index.js` |
| `call_user` | 📥 Listen (Client -> Server) | `index.js` |
| `accept_call` | 📥 Listen (Client -> Server) | `index.js` |
| `reject_call` | 📥 Listen (Client -> Server) | `index.js` |
| `end_call` | 📥 Listen (Client -> Server) | `index.js` |
| `ice_candidate` | 📥 Listen (Client -> Server) | `index.js` |
| `webrtc_signal` | 📥 Listen (Client -> Server) | `index.js` |
| `random_webrtc_signal` | 📥 Listen (Client -> Server) | `index.js` |
| `disconnect` | 📥 Listen (Client -> Server) | `index.js` |
| `error` | 📥 Listen (Client -> Server) | `index.js` |
| `error` | 📤 Emit (Server -> Client) | `index.js` |
| `random_partner_found` | 📤 Emit (Server -> Client) | `index.js` |
| `waiting_for_partner` | 📤 Emit (Server -> Client) | `index.js` |
| `video_error` | 📤 Emit (Server -> Client) | `index.js` |
| `search_cancelled` | 📤 Emit (Server -> Client) | `index.js` |
| `finding_new_partner` | 📤 Emit (Server -> Client) | `index.js` |
| `session_ended` | 📤 Emit (Server -> Client) | `index.js` |
| `call_error` | 📤 Emit (Server -> Client) | `index.js` |

---

## 🚨 Auto Analysis & Security Report

### 1. Unprotected Routes (Potential Security Risks)
Các route sau không yêu cầu Authentication, hãy kiểm tra xem có đúng ý đồ thiết kế không:
- `POST /api/admin/forgot-password`
- `POST /api/admin/verify-otp`
- `POST /api/admin/reset-password`
- `POST /api/auth/forgot-password`
- `POST /api/auth/send-otp`
- `POST /api/auth/verify-otp`
- `POST /api/auth/reset-password`
- `POST /api/update-location`
- `GET /api/discovery`
- `GET /api/tags`
- `POST /api/report`
- `GET /api/report/reasons`
- `POST /api/block`
- `GET /api/block`
- `DELETE /api/block/:targetId`

### 2. General Analysis
- **Duplicate Routes**: Không phát hiện trùng lặp URL method.
- **Internal APIs**: Phát hiện các API có endpoint lạ hoặc params đặc biệt. Cần review `/api/admin/*` endpoints để đảm bảo authorizeAdmin.
- **Missing Validation**: Rất nhiều routes không đính kèm express-validator trực tiếp trên route layer mà đẩy xuống controller.
