import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { userService, tagsService, interestsService } from '../services/api';
import { aiMatchService } from '../services/aiService';
import Navbar from '../components/Navbar';
import InterestsTab from '../components/InterestsTab';
import Cropper from 'react-easy-crop';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Helper: Create Image
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.src = url;
  });

// Helper: Get Cropped Image
const getCroppedImg = async (imageSrc, pixelCrop) => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  const base64 = canvas.toDataURL('image/jpeg', 0.9);

  return new Promise((resolve, reject) => {
    canvas.toBlob((file) => {
      if (file) {
        file.name = 'cropped.jpeg';
        resolve({ blob: file, url: URL.createObjectURL(file), base64 });
      } else {
        reject(new Error('Canvas is empty'));
      }
    }, 'image/jpeg', 0.9);
  });
};

// Helper: Format date for input
const formatDateForInput = (isoDate) => {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return isoDate;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/* ── Sidebar nav items ── */
const NAV_ITEMS = [
  { id: 'info', icon: '👤', label: 'Thông tin cá nhân' },
  { id: 'photos', icon: '📸', label: 'Thư viện ảnh' },
  { id: 'interests', icon: '❤️', label: 'Sở thích & Đam mê' },
  { id: 'security', icon: '🔒', label: 'Bảo mật tài khoản' },
  { id: 'pref', icon: '⚙️', label: 'Tùy chọn' },
  { id: 'plan', icon: '💎', label: 'Gói thành viên' },
  { id: 'privacy', icon: '🛡️', label: 'Quyền riêng tư' },
];

/* ── Range slider util ── */
const RangeSlider = ({ min, max, value, onChange, unit = '', label }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
      <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#f43f5e' }}>{value} {unit}</span>
    </div>
    <input
      type="range" min={min} max={max} value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{ width: '100%', accentColor: '#f43f5e', cursor: 'pointer', height: 4 }}
    />
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
      <span style={{ fontSize: 10, color: '#d1d5db' }}>{min} {unit}</span>
      <span style={{ fontSize: 10, color: '#d1d5db' }}>{max} {unit}</span>
    </div>
  </div>
);

/* ════════════════════════════
    EditProfile Page
════════════════════════════ */
const EditProfile = () => {
  const navigate = useNavigate();
  const { user: currentUser, setUser } = useAuthStore();
  const [activeNav, setActiveNav] = useState('info');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(currentUser?.avatar || '');
  const [viewAvatar, setViewAvatar] = useState(false);
  const fileRef = useRef(null);

  const [popularTags, setPopularTags] = useState([]);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [originalInterests, setOriginalInterests] = useState([]); // Track original saved interests
  const [newTagInput, setNewTagInput] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [blinkingTag, setBlinkingTag] = useState(null); // For duplicate tag blink effect
  const MAX_INTERESTS = 15;

  // Reset interests to saved values whenever component mounts or currentUser changes
  useEffect(() => {
    if (currentUser?.interests) {
      setSelectedInterests([...currentUser.interests]);
      setOriginalInterests([...currentUser.interests]);
    } else {
      setSelectedInterests([]);
      setOriginalInterests([]);
    }
  }, [currentUser]);

  // Check for unsaved changes whenever selectedInterests changes
  useEffect(() => {
    const interestsChanged = JSON.stringify(selectedInterests.sort()) !== JSON.stringify(originalInterests.sort());
    setHasUnsavedChanges(interestsChanged);
  }, [selectedInterests, originalInterests]);

  // Warn user before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges && activeNav === 'interests') {
        e.preventDefault();
        e.returnValue = 'Bạn có thay đổi chưa được lưu. Bạn có chắc chắn muốn rời đi?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, activeNav]);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const data = await tagsService.getTags();
        const tags = Array.isArray(data) ? data.map(t => t.name || t) : [];
        if (tags.length === 0) {
          setPopularTags(['Du lịch', 'Âm nhạc']); // Fix cứng 2 sở thích mặc định
        } else {
          setPopularTags(tags);
        }
      } catch (err) {
        setPopularTags(['Du lịch', 'Âm nhạc']);
      }
    };
    fetchTags();
  }, []);

  const [form, setForm] = useState({
    fullName: currentUser?.fullName || '',
    gender: currentUser?.gender || 'female',
    dateOfBirth: formatDateForInput(currentUser?.dateOfBirth),
    bio: currentUser?.bio || '',
    location: currentUser?.location || '',
    occupation: currentUser?.occupation || '',
    avatar: null,
    photos: currentUser?.photos || [],
    preferences: {
      maxDistance: currentUser?.preferences?.maxDistance || 25,
      minAge: currentUser?.preferences?.minAge || 18,
      maxAge: currentUser?.preferences?.maxAge || 35,
      gender: currentUser?.preferences?.gender || 'both',
    },
  });

  // Modal and Map states
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapPosition, setMapPosition] = useState([10.8231, 106.6297]); // Default HCMC

  // Cropper states
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cropType, setCropType] = useState('avatar'); // 'avatar' | 'gallery'
  const [cropGalleryIndex, setCropGalleryIndex] = useState(-1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // AI Validation
  const validateImageAI = async (blob, type) => {
    try {
      console.log(`[AI] Validating image for ${type}...`);
      if (type === 'gallery') {
        await aiMatchService.uploadPhoto(blob);
      } else {
        await aiMatchService.checkFrame(blob);
      }
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        message: error.response?.data?.detail || error.response?.data?.error || error.response?.data?.message || 'AI phát hiện ảnh không hợp lệ (không có mặt hoặc chứa nội dung nhạy cảm).' 
      };
    }
  };

  /* ── handlers ── */
  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setError(''); setSuccess('');
  };
  const setPref = (key, val) => {
    setForm(f => ({ ...f, preferences: { ...f.preferences, [key]: val } }));
    setError(''); setSuccess('');
  };

  // Reset interests when switching away from interests tab
  const handleNavChange = (navId) => {
    if (activeNav === 'interests' && navId !== 'interests' && hasUnsavedChanges) {
      // User is leaving interests tab with unsaved changes - show warning
      const confirmLeave = window.confirm('Bạn có thay đổi chưa được lưu. Bạn có chắc chắn muốn rời đi?');
      if (!confirmLeave) {
        return; // Stay on current tab
      }
      // Reset to saved values
      if (currentUser?.interests) {
        setSelectedInterests([...currentUser.interests]);
        setOriginalInterests([...currentUser.interests]);
      } else {
        setSelectedInterests([]);
        setOriginalInterests([]);
      }
      setNewTagInput('');
      setError('');
      setSuccess('');
      setHasUnsavedChanges(false);
    }
    setActiveNav(navId);
  };

  const handleAvatar = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setCropImageSrc(reader.result);
      setCropType('avatar');
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
    e.target.value = null; // reset input
  };

  const handleGalleryPhoto = (e, idx = -1) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setCropImageSrc(reader.result);
      setCropType('gallery');
      setCropGalleryIndex(idx);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  const handleCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const showCroppedImage = async () => {
    try {
      setIsAnalyzing(true);
      const { blob, url, base64 } = await getCroppedImg(cropImageSrc, croppedAreaPixels);
      
      const aiResult = await validateImageAI(blob, cropType);
      
      if (!aiResult.valid) {
        setIsAnalyzing(false);
        setError(aiResult.message);
        setTimeout(() => setError(''), 5000);
        setShowCropModal(false);
        return;
      }

      if (cropType === 'avatar') {
        setAvatarPreview(url);
        set('avatar', blob);
      } else {
        const newPhotos = [...form.photos];
        if (cropGalleryIndex >= 0) {
          newPhotos[cropGalleryIndex] = base64;
        } else {
          newPhotos.push(base64);
        }
        set('photos', newPhotos);
      }
      
      setIsAnalyzing(false);
      setShowCropModal(false);
    } catch (e) {
      console.error(e);
      setIsAnalyzing(false);
      setError('Lỗi khi cắt ảnh');
    }
  };

  const handleSetAsAvatar = async (base64Src) => {
    if (window.confirm('Bạn muốn đặt ảnh này làm ảnh đại diện? Hệ thống sẽ chạy AI quét khuôn mặt.')) {
      setLoading(true);
      try {
        const res = await fetch(base64Src);
        const blob = await res.blob();
        
        const aiResult = await validateImageAI(blob, 'avatar');
        if (!aiResult.valid) {
          setError(aiResult.message);
          setTimeout(() => setError(''), 5000);
          return;
        }
        
        setAvatarPreview(URL.createObjectURL(blob));
        set('avatar', blob);
        
        setSuccess('Đã đặt làm ảnh đại diện thành công! Vui lòng "Lưu thay đổi".');
        setTimeout(() => setSuccess(''), 4000);
      } catch (err) {
        setError('Lỗi khi đổi ảnh đại diện');
      } finally {
        setLoading(false);
      }
    }
  };

  // Reverse Geocoding for Map
  const fetchAddressFromCoords = async (lat, lon) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=vi&addressdetails=1`);
      const data = await res.json();
      if (data && data.address) {
        const { road, neighbourhood, quarter, suburb, city_district, county, city, state, town } = data.address;
        const addressWard = quarter || neighbourhood || '';
        const addressDistrict = city_district || suburb || county || town || '';
        const addressCity = city || state || '';
        const parts = [road, addressWard, addressDistrict, addressCity].filter(Boolean);
        set('location', parts.join(', '));
      } else if (data && data.display_name) {
        const parts = data.display_name.split(', ');
        set('location', parts.slice(0, 3).join(', '));
      }
    } catch (e) {
      console.error('Lỗi lấy địa chỉ', e);
    }
  };

  const MapClickHandler = () => {
    useMapEvents({
      click(e) {
        setMapPosition([e.latlng.lat, e.latlng.lng]);
        fetchAddressFromCoords(e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  };

  const MapUpdater = ({ center }) => {
    const map = useMapEvents({});
    useEffect(() => {
      map.setView(center, map.getZoom());
    }, [center, map]);
    return null;
  };

  const handleSubmit = async () => {
    setLoading(true); setError(''); setSuccess('');
    try {
      // Validate Age
      if (activeNav === 'info' || activeNav === 'pref') {
        if (form.dateOfBirth) {
          const birthDate = new Date(form.dateOfBirth);
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          if (age < 18) {
            setError('Bạn phải từ đủ 18 tuổi trở lên để sử dụng ứng dụng.');
            setLoading(false);
            return;
          }
        }
      }

      if (activeNav === 'interests') {
        // Only update interests for interests tab
        await interestsService.updateAllInterests(selectedInterests);
        
        // Also update profile with interests included
        await userService.updateProfile({
          fullName: form.fullName,
          gender: form.gender,
          dateOfBirth: form.dateOfBirth,
          bio: form.bio,
          locationText: form.location,
          occupation: form.occupation,
          avatar: form.avatar,
          preferences: form.preferences,
          interests: selectedInterests,
        });

        // Update auth store with new interests
        const mergedUser = {
          ...currentUser,
          interests: selectedInterests,
        };
        setUser(mergedUser);
        setOriginalInterests([...selectedInterests]);
        setHasUnsavedChanges(false);
        
        setSuccess('Cập nhật sở thích thành công!');
        setTimeout(() => setSuccess(''), 3000);
      } else if (activeNav === 'photos') {
        // Update profile with photos
        await userService.updateProfile({
          fullName: form.fullName,
          gender: form.gender,
          dateOfBirth: form.dateOfBirth,
          bio: form.bio,
          locationText: form.location,
          occupation: form.occupation,
          avatar: form.avatar,
          preferences: form.preferences,
          photos: form.photos,
        });

        setSuccess('Lưu thành công!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        // Update profile for other tabs (info, security, pref, plan, privacy)
        const profileData = await userService.updateProfile({
          fullName: form.fullName,
          gender: form.gender,
          dateOfBirth: form.dateOfBirth,
          bio: form.bio,
          locationText: form.location,
          occupation: form.occupation,
          avatar: form.avatar,
          preferences: form.preferences,
        });

        // Extract user from response - handle multiple formats
        const updatedUser = profileData?.user || profileData?.data?.user || profileData;

        // Update auth store with merged data
        const mergedUser = {
          ...currentUser,
          ...updatedUser,
          preferences: form.preferences, // Ensure preferences are synced
        };
        setUser(mergedUser);

        // Update local form just in case format changes
        if (updatedUser?.dateOfBirth) {
          set('dateOfBirth', formatDateForInput(updatedUser.dateOfBirth));
        }
        
        setSuccess('Lưu thành công!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  /* ── tokens ── */
  const BG = '#ffffff';
  const CARD = { background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' };
  const INPUT = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: '1px solid #d1d5db', fontSize: 14, color: '#111827',
    background: '#fff', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color .2s',
  };
  const LABEL = { fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6, display: 'block' };

  const initial = ((currentUser?.fullName || currentUser?.username) ?? '?').charAt(0).toUpperCase();

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <div className="flex-1 flex flex-col lg:flex-row max-w-[1200px] mx-auto w-full px-4 sm:px-5 py-6 pb-16 gap-6 lg:gap-8 box-border">

        {/* ══ LEFT SIDEBAR ══ */}
        <div className="w-full lg:w-[220px] shrink-0">
          <div style={{ ...CARD, padding: '20px 12px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#f43f5e', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4, padding: '0 8px' }}>
              Cài đặt
            </p>
            <p style={{ fontSize: 10, color: '#c4b5fd', marginBottom: 16, padding: '0 8px' }}>
              Quản lý trải nghiệm của bạn
            </p>
            <nav className="flex flex-row lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
              {NAV_ITEMS.map(item => (
                <button key={item.id} onClick={() => handleNavChange(item.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px',
                    borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
                    fontSize: 12, fontWeight: activeNav === item.id ? 700 : 500,
                    background: activeNav === item.id ? 'linear-gradient(135deg,#fce7f3,#fdf4ff)' : 'transparent',
                    color: activeNav === item.id ? '#f43f5e' : '#9ca3af',
                    transition: 'all .2s',
                  }}>
                  <span style={{ fontSize: 14 }}>{item.icon}</span>
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* ══ CENTER — Main form ══ */}
        <div className={`flex flex-col gap-4 min-w-0 ${activeNav === 'interests' ? 'lg:flex-row flex-wrap w-full' : 'flex-1'}`}>

          {activeNav === 'info' && (
            <div className="flex-1 flex flex-col gap-4 min-w-0">
              {/* Header */}
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: '0 0 4px' }}>
                  Quản lý hồ sơ cá nhân
                </h1>
                <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
                  Hoàn thiện vẻ đẹp tâm hồn để kết nối cùng người thương 💕
                </p>
              </div>

              {/* Avatar */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-6" style={{ ...CARD, padding: '18px 20px' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 120, height: 120, borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg,#fce7f3,#ede9fe)', boxShadow: '0 0 0 3px #fce7f3' }}>
                    {avatarPreview
                      ? <img
                        src={avatarPreview}
                        alt="avatar"
                        onClick={() => setViewAvatar(true)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in', transition: 'transform 0.3s' }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 700, color: '#f9a8d4' }}>{initial}</div>
                    }
                  </div>
                  <button onClick={() => fileRef.current?.click()}
                    style={{ position: 'absolute', bottom: 4, right: 4, width: 28, height: 28, borderRadius: '50%', border: '2px solid #fff', background: '#f43f5e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(244,63,94,0.4)' }}>
                    <svg width="13" height="13" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} style={{ display: 'none' }} />
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Ảnh đại diện</p>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px', lineHeight: 1.5, maxWidth: 300 }}>
                    Tải lên một bức ảnh rõ nét để AI phân tích. Bấm vào ảnh để xem chi tiết.
                  </p>
                  <div className="flex justify-center sm:justify-start gap-2.5">
                    <button onClick={() => fileRef.current?.click()}
                      style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#111827', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                      Đổi ảnh
                    </button>
                    {avatarPreview && (
                      <button onClick={() => { setAvatarPreview(''); set('avatar', null); }}
                        style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#ef4444', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                        Gỡ bỏ
                      </button>
                    )}
                  </div>
                  {form.avatar && (
                    <p style={{ fontSize: 12, color: '#f59e0b', marginTop: 8 }}>
                      ⚠️ Ảnh chưa được lưu. Vui lòng bấm "Lưu thay đổi" để áp dụng.
                    </p>
                  )}
                </div>
              </div>

              {/* Personal Info */}
              <div style={{ ...CARD, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 16 }}>❤️</span>
                  <h2 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: 0 }}>Thông tin cá nhân</h2>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={LABEL}>Họ tên</label>
                    <input style={INPUT} value={form.fullName} placeholder="Nguyễn Thuý An"
                      onChange={e => set('fullName', e.target.value)}
                      onFocus={e => e.target.style.borderColor = '#f43f5e'}
                      onBlur={e => e.target.style.borderColor = '#fce7f3'} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label style={LABEL}>Giới tính</label>
                      <select style={{ ...INPUT, appearance: 'none', backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%239ca3af' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'calc(100% - 12px) center', paddingRight: 32, cursor: 'pointer' }}
                        value={form.gender} onChange={e => set('gender', e.target.value)}>
                        <option value="female">Nữ</option>
                        <option value="male">Nam</option>
                        <option value="other">Khác</option>
                      </select>
                    </div>
                    <div>
                      <label style={LABEL}>Ngày sinh</label>
                      <input type="date" style={{ ...INPUT, cursor: 'pointer' }}
                        value={form.dateOfBirth}
                        onChange={e => set('dateOfBirth', e.target.value)}
                        onFocus={e => e.target.style.borderColor = '#f43f5e'}
                        onBlur={e => e.target.style.borderColor = '#fce7f3'} />
                    </div>
                  </div>

                  <div>
                    <label style={LABEL}>Tiểu sử</label>
                    <textarea style={{ ...INPUT, minHeight: 88, resize: 'vertical', lineHeight: 1.6 }}
                      value={form.bio} placeholder="Yêu âm nhạc cổ điển, thích đọc sách bên tách trà nóng..."
                      maxLength={500}
                      onChange={e => set('bio', e.target.value)}
                      onFocus={e => e.target.style.borderColor = '#f43f5e'}
                      onBlur={e => e.target.style.borderColor = '#fce7f3'} />
                    <p style={{ fontSize: 10, color: '#d1d5db', marginTop: 3, textAlign: 'right' }}>{form.bio.length}/500</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label style={LABEL}>Vị trí</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input style={{ ...INPUT, flex: 1 }} value={form.location} placeholder="Nhập vị trí..."
                          onChange={e => set('location', e.target.value)}
                          onFocus={e => e.target.style.borderColor = '#f43f5e'}
                          onBlur={e => e.target.style.borderColor = '#d1d5db'} />
                        <button type="button" onClick={() => setShowMapModal(true)}
                          style={{ padding: '0 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer', flexShrink: 0, fontSize: 14 }}
                          title="Chọn vị trí trên bản đồ">
                          📍
                        </button>
                      </div>
                    </div>
                    <div>
                      <label style={LABEL}>Nghề nghiệp</label>
                      <input style={INPUT} value={form.occupation} placeholder="VD: Bác sĩ, Giáo viên, IT..."
                        onChange={e => set('occupation', e.target.value)}
                        onFocus={e => e.target.style.borderColor = '#f43f5e'}
                        onBlur={e => e.target.style.borderColor = '#fce7f3'} />
                    </div>
                  </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '4px 0' }} />

                {error && (
                  <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#ef4444' }}>
                    {error}
                  </div>
                )}
                {success && (
                  <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 13, color: '#16a34a' }}>
                    {success}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <Link to="/profile"
                    style={{
                      padding: '10px 24px', borderRadius: 8, border: '1px solid #d1d5db',
                      background: '#fff', color: '#374151', fontSize: 14, fontWeight: 500,
                      textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
                      cursor: 'pointer', transition: 'background .2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                  >
                    Hủy
                  </Link>
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    style={{
                      padding: '10px 24px', borderRadius: 8, border: 'none',
                      background: loading ? '#fca5a5' : '#f43f5e',
                      color: '#fff', fontSize: 14, fontWeight: 600,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'inline-flex', alignItems: 'center',
                      transition: 'background .2s',
                    }}
                    onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#e11d48'; }}
                    onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#f43f5e'; }}
                  >
                    {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeNav === 'photos' && (
            <div className="flex-1 flex flex-col gap-4 min-w-0">
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: '0 0 4px' }}>
                  Thư viện ảnh
                </h1>
                <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
                  Thêm tối đa 5 bức ảnh để làm nổi bật hồ sơ của bạn 📸
                </p>
              </div>

              <div style={{ ...CARD, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {form.photos.map((src, idx) => (
                    <div key={idx} className="relative aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden shadow-sm group">
                      <img src={src} className="w-full h-full object-cover" />
                      
                      <div className="absolute inset-x-0 bottom-0 p-2 flex justify-between items-center bg-gradient-to-t from-black/70 to-transparent">
                        <div className="flex gap-2">
                          <label className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/40 rounded-full cursor-pointer transition-colors backdrop-blur-sm" title="Sửa ảnh">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={(e) => handleGalleryPhoto(e, idx)} 
                            />
                          </label>
                          <button 
                            onClick={() => handleSetAsAvatar(src)}
                            className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-emerald-500 rounded-full cursor-pointer transition-colors backdrop-blur-sm" title="Đặt làm ảnh đại diện"
                          >
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                          </button>
                        </div>
                        
                        <button 
                          onClick={() => {
                            if (window.confirm('Bạn có chắc chắn muốn xóa bức ảnh này?')) {
                              const newPhotos = [...form.photos];
                              newPhotos.splice(idx, 1);
                              set('photos', newPhotos);
                            }
                          }}
                          className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-rose-500 rounded-full cursor-pointer transition-colors backdrop-blur-sm" title="Xóa ảnh"
                        >
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {form.photos.length < 5 && (
                    <label className="relative aspect-[3/4] border-2 border-dashed border-rose-200 bg-rose-50/50 hover:bg-rose-50 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors text-rose-400">
                      <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                      <span className="text-sm font-bold">Thêm ảnh</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleGalleryPhoto(e, -1)} 
                      />
                    </label>
                  )}
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #fce7f3', margin: '4px 0' }} />

                {error && (
                  <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#ef4444' }}>
                    {error}
                  </div>
                )}
                {success && (
                  <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 13, color: '#16a34a' }}>
                    {success}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <Link to="/profile" style={{ padding: '12px 28px', borderRadius: 28, border: '1.5px solid #fca5a5', background: '#fff', color: '#f43f5e', fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    Hủy &nbsp;✕
                  </Link>
                  <button onClick={handleSubmit} disabled={loading} style={{ padding: '12px 36px', borderRadius: 28, border: 'none', background: loading ? '#fca5a5' : 'linear-gradient(135deg,#fb7185,#f43f5e)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 6px 20px rgba(244,63,94,0.35)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {loading ? '⏳ Đang lưu...' : '✅ Lưu thay đổi'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeNav === 'pref' && (
            <div className="flex-1 flex flex-col gap-4 min-w-0">
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: '0 0 4px' }}>
                  Tùy chọn tìm kiếm
                </h1>
                <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
                  Điều chỉnh tiêu chí để AI tìm đúng người bạn cần 💘
                </p>
              </div>

              <div style={{ ...CARD, padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <RangeSlider
                  label="Khoảng cách tối đa"
                  min={1} max={100}
                  value={form.preferences.maxDistance}
                  onChange={v => setPref('maxDistance', v)}
                  unit="km"
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <RangeSlider
                    label="Độ tuổi tối thiểu"
                    min={18} max={60}
                    value={form.preferences.minAge}
                    onChange={v => { if (v <= form.preferences.maxAge) setPref('minAge', v); }}
                    unit="tuổi"
                  />
                  <RangeSlider
                    label="Độ tuổi tối đa"
                    min={18} max={60}
                    value={form.preferences.maxAge}
                    onChange={v => { if (v >= form.preferences.minAge) setPref('maxAge', v); }}
                    unit="tuổi"
                  />
                </div>
                <div>
                  <label style={{ ...LABEL, marginBottom: 12 }}>Giới tính mục tiêu</label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[{ v: 'male', l: 'Nam' }, { v: 'female', l: 'Nữ' }, { v: 'both', l: 'Cả hai' }].map(({ v, l }) => (
                      <button key={v} onClick={() => setPref('gender', v)}
                        style={{
                          flex: 1, padding: '10px', borderRadius: 8, border: '1px solid',
                          borderColor: form.preferences.gender === v ? '#f43f5e' : '#d1d5db',
                          background: form.preferences.gender === v ? '#fef2f2' : '#fff',
                          color: form.preferences.gender === v ? '#f43f5e' : '#374151',
                          fontSize: 14, fontWeight: form.preferences.gender === v ? 600 : 500,
                          cursor: 'pointer', transition: 'all .2s',
                        }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '8px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    style={{
                      padding: '10px 24px', borderRadius: 8, border: 'none',
                      background: loading ? '#fca5a5' : '#f43f5e',
                      color: '#fff', fontSize: 14, fontWeight: 600,
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {loading ? 'Đang lưu...' : 'Lưu tùy chọn'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeNav === 'interests' && (
            <InterestsTab 
              selectedInterests={selectedInterests}
              setSelectedInterests={setSelectedInterests}
              popularTags={popularTags}
              newTagInput={newTagInput}
              setNewTagInput={setNewTagInput}
              error={error}
              setError={setError}
              blinkingTag={blinkingTag}
              setBlinkingTag={setBlinkingTag}
              maxInterests={MAX_INTERESTS}
              hasUnsavedChanges={hasUnsavedChanges}
              loading={loading}
              success={success}
              handleSubmit={handleSubmit}
              onCancel={() => {
                // Reset to original values
                if (currentUser?.interests) {
                  setSelectedInterests([...currentUser.interests]);
                  setOriginalInterests([...currentUser.interests]);
                } else {
                  setSelectedInterests([]);
                  setOriginalInterests([]);
                }
                setNewTagInput('');
                setError('');
                setSuccess('');
                setHasUnsavedChanges(false);
              }}
            />
          )}

        </div>
      </div>

      {/* ══ MODAL CẮT ẢNH ══ */}
      {showCropModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {cropType === 'avatar' ? 'Cắt ảnh đại diện' : 'Cắt ảnh thư viện'}
              </h3>
              {!isAnalyzing && <button onClick={() => setShowCropModal(false)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>}
            </div>
            <div style={{ position: 'relative', height: 400, background: '#333' }}>
              <Cropper
                image={cropImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={cropType === 'avatar' ? 1 : 3/4}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
              />
              {isAnalyzing && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="font-semibold text-sm">🤖 AI đang phân tích nội dung ảnh...</p>
                </div>
              )}
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ ...LABEL, marginBottom: 8 }}>Phóng to</label>
                <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={e => setZoom(e.target.value)} disabled={isAnalyzing} style={{ width: '100%', accentColor: '#f43f5e' }} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setShowCropModal(false)} disabled={isAnalyzing} style={{ flex: 1, padding: '12px', borderRadius: 8, border: '1px solid #d1d5db', background: isAnalyzing ? '#f3f4f6' : '#fff', fontWeight: 600, cursor: isAnalyzing ? 'not-allowed' : 'pointer' }}>Hủy</button>
                <button onClick={showCroppedImage} disabled={isAnalyzing} style={{ flex: 1, padding: '12px', borderRadius: 8, border: 'none', background: isAnalyzing ? '#fca5a5' : '#f43f5e', color: '#fff', fontWeight: 600, cursor: isAnalyzing ? 'not-allowed' : 'pointer' }}>
                  {isAnalyzing ? 'Đang xử lý...' : 'Xác nhận'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL BẢN ĐỒ ══ */}
      {showMapModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 600, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Chọn vị trí trên bản đồ</h3>
              <button onClick={() => setShowMapModal(false)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ height: 400 }}>
              <MapContainer center={mapPosition} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={mapPosition} />
                <MapClickHandler />
                <MapUpdater center={mapPosition} />
              </MapContainer>
            </div>
            <div style={{ padding: '20px', borderTop: '1px solid #e5e7eb' }}>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>Nhấp chuột vào bản đồ để chọn vị trí. Địa chỉ sẽ được tự động cập nhật.</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button 
                  onClick={() => {
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        (position) => {
                          const lat = position.coords.latitude;
                          const lng = position.coords.longitude;
                          setMapPosition([lat, lng]);
                          fetchAddressFromCoords(lat, lng);
                        },
                        (error) => {
                          console.error("Lỗi lấy vị trí hiện tại:", error);
                          alert("Không thể lấy vị trí hiện tại. Vui lòng cho phép quyền truy cập vị trí.");
                        }
                      );
                    } else {
                      alert("Trình duyệt của bạn không hỗ trợ Geolocation.");
                    }
                  }} 
                  style={{ flex: 1, padding: '12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 600, cursor: 'pointer' }}
                >
                  📍 Vị trí hiện tại
                </button>
                <button onClick={() => setShowMapModal(false)} style={{ flex: 1, padding: '12px', borderRadius: 8, border: 'none', background: '#f43f5e', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Xong</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL XEM ẢNH ĐẠI DIỆN PHÓNG TO ══ */}
      {viewAvatar && avatarPreview && (
        <div
          onClick={() => setViewAvatar(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out', padding: 20
          }}
        >
          <button
            onClick={() => setViewAvatar(false)}
            style={{
              position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.2)',
              border: 'none', color: '#fff', fontSize: 24, width: 40, height: 40,
              borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          >
            ✕
          </button>

          <img
            src={avatarPreview}
            alt="Phóng to"
            onClick={(e) => e.stopPropagation()}
            style={{
              height: '85vh',
              minHeight: '400px',
              width: 'auto',
              maxWidth: '95vw',
              borderRadius: 16,
              objectFit: 'contain',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              cursor: 'default',
              backgroundColor: '#fff'
            }}
          />
        </div>
      )}
    </div>
  );
};

export default EditProfile;