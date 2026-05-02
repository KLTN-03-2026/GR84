import api from './api';

export const aiMatchService = {

  // 1. LẤY DANH SÁCH MATCH 
  getSmartMatches: (userId, targetGender, preferences, location, swiped_ids = []) => {
    const data = {
      user_id: userId.toString(), 
      target: targetGender === 'female' ? 1 : (targetGender === 'male' ? 0 : 2),
      min: parseInt(preferences.minAge) || 18,
      max: parseInt(preferences.maxAge) || 50,
      lat: parseFloat(location?.lat) || 16.047079,
      lng: parseFloat(location?.lng) || 108.206230,
      swiped_ids: swiped_ids, 
      limit: 100
    };
    return api.post('/ai/match', data);
  },

  // 2. TÍN HIỆU THÍCH
  sendLikeSignal: (userId, likedUserId) => {
    return api.post('/ai/like', { 
      user_id: userId.toString(),
      likedUserId: likedUserId.toString() 
    });
  },

  // 3. TÍN HIỆU BỎ QUA 
  sendPassSignal: (userId, passedUserId) => {
    return api.post('/ai/pass', { 
      user_id: userId.toString(),
      passedUserId: passedUserId.toString() // Đã đổi lại chuẩn với Backend
    });
  },

  getIcebreakers: (myBio, partnerBio) => {
    return api.post('/ai/icebreaker', { myBio, partnerBio });
  },

  syncProfileToAI: (formData) => {
    return api.post('/ai/sync', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  verifyFull: (userId, file) => {
    const formData = new FormData();
    formData.append('user_id', userId.toString());
    formData.append('file', file);

    return api.post('/ai/photo/verify', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  checkFrame: (file) => {
    const formData = new FormData();
    formData.append('file', file, 'avatar.jpeg');
    return api.post('/ai/photo/check-frame', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  uploadPhoto: (file) => {
    const formData = new FormData();
    formData.append('file', file, 'gallery.jpeg');
    return api.post('/ai/photo/upload-photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  enhancePhoto: (file) => {
    const formData = new FormData();
    formData.append('file', file, 'avatar.jpeg');
    return api.post('/ai/photo/enhance-photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      responseType: 'blob' 
    });
  },

  verifyBiometric: (file) => {
    const formData = new FormData();
    formData.append('file', file, 'kyc.jpeg');
    return api.post('/ai/verify-biometric', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

export default aiMatchService;