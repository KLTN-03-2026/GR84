import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { userService } from '../services/api';
import { aiMatchService } from '../services/aiService';
import Webcam from "react-webcam";
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import axios from 'axios';
import imageCompression from 'browser-image-compression';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

const Onboarding = () => {
  const navigate = useNavigate();
  const [scanCountdown, setScanCountdown] = useState(null);
  const { user, setUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [verifyStatus, setVerifyStatus] = useState("idle");
  const challenges = ["straight", "left", "straight", "right"];
  const [currentChallengeIdx, setCurrentChallengeIdx] = useState(0);
  const [activeMessage, setActiveMessage] = useState("Chuẩn bị...");
  const [isScanningLive, setIsScanningLive] = useState(false);
  const scanIntervalRef = useRef(null);
  const webcamRef = useRef(null);
  const challengeRef = useRef(challenges[0]);
  const datePickerRef = useRef(null); // Ref cho date picker ẩn
  const [verifyScore, setVerifyScore] = useState(null); // Lưu điểm số thực thể từ AI
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: '',
    age: '',
    dateOfBirth: '', // Added for date of birth
    gender: '',
    bio: '',
    location: '',
    interests: [],
    occupation: '',
    lookingFor: '',
    avatar: null,
  });
  const [newInterest, setNewInterest] = useState('');

  const [showMapModal, setShowMapModal] = useState(false);
  const [mapPosition, setMapPosition] = useState(null);

  // ✅ VALIDATION FUNCTIONS
  const validateStep1 = () => {
    // Họ và tên - không chứa ký tự đặc biệt
    if (!formData.fullName.trim()) {
      setError('Vui lòng nhập họ và tên');
      return false;
    }
    const nameRegex = /^[a-zA-ZÀ-ỹ\s]+$/;
    if (!nameRegex.test(formData.fullName)) {
      setError('Họ và tên không được chứa ký tự đặc biệt hoặc số');
      return false;
    }

    // Ngày sinh - phải đúng định dạng dd/mm/yyyy và trên 18 tuổi
    if (!formData.dateOfBirth) {
      setError('Vui lòng nhập ngày sinh');
      return false;
    }

    // Validate format dd/mm/yyyy
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = formData.dateOfBirth.match(dateRegex);

    if (!match) {
      setError('Ngày sinh phải đúng định dạng dd/mm/yyyy');
      return false;
    }

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);

    // Validate ngày tháng hợp lệ
    if (month < 1 || month > 12) {
      setError('Tháng không hợp lệ (1-12)');
      return false;
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    if (day < 1 || day > daysInMonth) {
      setError('Ngày không hợp lệ');
      return false;
    }

    // Tính tuổi
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      setError('Bạn phải từ 18 tuổi trở lên để sử dụng dịch vụ');
      return false;
    }

    // Giới tính - bắt buộc chọn
    if (!formData.gender) {
      setError('Vui lòng chọn giới tính');
      return false;
    }

    return true;
  };

  const validateStep2 = () => {
    // Ảnh đại diện - bắt buộc
    if (!formData.avatar) {
      setError('Vui lòng chọn ảnh đại diện');
      return false;
    }

    // Bio không bắt buộc, không cần validate
    return true;
  };

  const validateStep3 = () => {
    // Sở thích - bắt buộc chọn ít nhất 3
    if (formData.interests.length < 3) {
      setError('Vui lòng chọn ít nhất 3 sở thích');
      return false;
    }

    // Nơi ở - bắt buộc
    if (!formData.location.trim()) {
      setError('Vui lòng nhập nơi ở (thành phố)');
      return false;
    }

    // Mục tiêu tìm kiếm - bắt buộc
    if (!formData.lookingFor) {
      setError('Vui lòng chọn mục tiêu tìm kiếm');
      return false;
    }

    return true;
  };

  const handleNextStep = () => {
    setError(''); // Reset error

    // Validate theo từng bước
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    if (currentStep === 3 && !validateStep3()) return;

    // Nếu pass validation, chuyển bước
    setCurrentStep(prev => prev + 1);
  };

  const LocationPickerMarker = () => {
    useMapEvents({
      click(e) {
        setMapPosition(e.latlng);
      },
    });
    return mapPosition ? <Marker position={mapPosition} /> : null;
  };
  const totalSteps = 4;
  // 1. Hàm kích hoạt đếm ngược 3 giây
  const startCapture = () => {
    setBiometricImage(null);
    setScanCountdown(3);
    let count = 3;
    const timer = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setScanCountdown(count);
      } else {
        clearInterval(timer);
        setScanCountdown(null);
        executeCapture();
      }
    }, 1000);
  };

  // 2. Hàm thực thi chụp ảnh với chất lượng tối đa
  const executeCapture = useCallback(() => {
    if (!webcamRef.current) return;

    // Lấy ảnh với định dạng JPEG chuẩn
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      fetch(imageSrc)
        .then(res => res.blob())
        .then(blob => {
          // Ép kiểu chuẩn image/jpeg
          const file = new File([blob], "biometric_capture.jpg", { type: "image/jpeg" });
          setBiometricImage(file);
        });
    }
  }, [webcamRef]);
  const stopScan = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setIsScanningLive(false);
    setIsAiProcessing(false);
  };
  const updateMessage = (challenge) => {
    const msgs = {
      'left': "Tuyệt! Giờ hãy quay mặt sang TRÁI",
      'straight': "Tốt! Giờ hãy nhìn THẲNG",
      'right': "Tuyệt! Giờ hãy quay mặt sang PHẢI"
    };
    setActiveMessage(msgs[challenge] || "Tiếp tục...");
  };
  const startLiveScan = () => {
    setIsScanningLive(true);
    setIsVerified(false);
    setCurrentChallengeIdx(0);
    challengeRef.current = challenges[0];

    scanIntervalRef.current = setInterval(async () => {
      if (!webcamRef.current || isAiProcessing) return;

      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) return;

      setIsAiProcessing(true);

      try {
        const blob = await fetch(imageSrc).then(res => res.blob());
        const file = new File([blob], "live.jpg", { type: "image/jpeg" });

        const sendData = new FormData();
        sendData.append("user_id", user?._id || user?.id);
        sendData.append("challenge", challengeRef.current);
        sendData.append("file", file);

        const res = await axios.post("https://nbinh3120-ai-dating.hf.space/verify-active-liveness", sendData);
        console.log("AI trả về:", res.data);

        // Mở rộng điều kiện: chấp nhận cả "passed", "success", hoặc "verified"
        if (res.data.status === "passed" || res.data.success === true || res.data.verified === true) {
          setCurrentChallengeIdx(prev => {
            const nextIdx = prev + 1;
            if (nextIdx >= challenges.length) {
              stopScan();
              setIsVerified(true);
              setBiometricImage(file);
              setActiveMessage(" XÁC THỰC THÀNH CÔNG!");
            } else {
              challengeRef.current = challenges[nextIdx];
              updateMessage(challenges[nextIdx]);
            }
            return nextIdx;
          });
        } else {
          // Chỉ hiện thông báo từ AI mà không dừng quét để UX mượt hơn
          setActiveMessage(res.data.message);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsAiProcessing(false);
      }
    }, 800); // Đẩy tốc độ lên 800ms để nhạy hơn
  };
  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, []);
  // Thêm state để quản lý ảnh chụp selfie xác thực
  const [biometricImage, setBiometricImage] = useState(null);
  const [isVerified, setIsVerified] = useState(false);

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, totalSteps));
  const interestsList = [
    'Du lịch', 'Âm nhạc', 'Phim ảnh', 'Đọc sách', 'Nấu ăn', 'Thể thao',
    'Chơi game', 'Gym', 'Nghệ thuật', 'Nhiếp ảnh', 'Khiêu vũ', 'Yoga'
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Xử lý format ngày sinh dd/mm/yyyy
    if (name === 'dateOfBirth') {
      // Chỉ cho phép nhập số và dấu /
      let formatted = value.replace(/[^\d/]/g, '');

      // Tự động thêm dấu / sau ngày và tháng
      if (formatted.length === 2 && !formatted.includes('/')) {
        formatted += '/';
      } else if (formatted.length === 5 && formatted.split('/').length === 2) {
        formatted += '/';
      }

      // Giới hạn độ dài: dd/mm/yyyy = 10 ký tự
      if (formatted.length <= 10) {
        setFormData({ ...formData, [name]: formatted });
      }
    } else {
      setFormData({ ...formData, [name]: value });
    }

    setError('');
  };

  // Xử lý khi chọn từ date picker
  const handleDatePickerChange = (e) => {
    const dateValue = e.target.value; // yyyy-mm-dd
    if (dateValue) {
      const [year, month, day] = dateValue.split('-');
      const formatted = `${day}/${month}/${year}`; // dd/mm/yyyy
      setFormData({ ...formData, dateOfBirth: formatted });
    }
  };

  const handleAvatarChange = (e) => {
    setFormData({ ...formData, avatar: e.target.files[0] });
  };

  const toggleInterest = (interest) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const handleAddCustomInterest = () => {
    if (newInterest.trim() && !formData.interests.includes(newInterest.trim())) {
      setFormData(prev => ({
        ...prev,
        interests: [...prev.interests, newInterest.trim()]
      }));
      setNewInterest('');
    }
  };

  const handleOpenMap = () => {
    setShowMapModal(true);
    if (!mapPosition && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMapPosition({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        () => {
          setMapPosition({ lat: 10.762622, lng: 106.660172 });
        }
      );
    } else if (!mapPosition) {
      setMapPosition({ lat: 10.762622, lng: 106.660172 });
    }
  };

  const handleConfirmMapSelection = async () => {
    if (!mapPosition) return;

    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${mapPosition.lat}&lon=${mapPosition.lng}&zoom=10&addressdetails=1`);
      const data = await response.json();

      let city = data.address.city || data.address.town || data.address.province || data.address.state;
      if (city) {
        setFormData(prev => ({ ...prev, location: city }));
        setError('');
        setShowMapModal(false);
      } else {
        setError('Không thể lấy tên thành phố từ vị trí vừa chọn.');
      }
    } catch (err) {
      setError('Lỗi khi lấy dữ liệu vị trí.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (skip = false) => {
    if (skip) { navigate('/discover'); return; }
    setIsLoading(true); setError('');

    try {
      // 1. Chuẩn bị dữ liệu gửi sang Node.js
      const onboardingData = new FormData();
      onboardingData.append('fullName', formData.fullName);
      onboardingData.append('dateOfBirth', formData.dateOfBirth);
      onboardingData.append('gender', formData.gender);
      onboardingData.append('bio', formData.bio);
      onboardingData.append('occupation', formData.occupation);
      onboardingData.append('lookingFor', formData.lookingFor);

      // Gửi tọa độ GPS lấy từ Map
      if (mapPosition) {
        onboardingData.append('latitude', mapPosition.lat);
        onboardingData.append('longitude', mapPosition.lng);
      }
      onboardingData.append('interests', JSON.stringify(formData.interests));
      if (formData.avatar) {
        onboardingData.append('avatar', formData.avatar);
      }

      // 2. Gọi API Node.js (Node.js sẽ chịu trách nhiệm gọi tiếp sang AI Milvus)
      const res = await aiMatchService.syncProfileToAI(finalData);
      if (result.success) {
        setUser(result.user);
        navigate('/discover');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Cập nhật hồ sơ thất bại');
    } finally {
      setIsLoading(false);
    }
  };
  const handleBiometricVerify = async (imageFile) => {
    const formData = new FormData();
    formData.append('file', imageFile);

    // Gọi API xác thực khuôn mặt thật so với ảnh hồ sơ
    const result = await api.post('/ai/verify-biometric', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    if (result.data.verified) {
      alert("Xác thực thành công! Bạn nhận được tích xanh ✅");
    } else {
      alert("Xác thực thất bại: " + result.data.message);
    }
  };
  // Onboarding.jsx - Hàm xử lý quét ảnh thực tế
  const handleCaptureAndVerify = async () => {
    if (!webcamRef.current) return;

    const imageSrc = webcamRef.current.getScreenshot();
    const blob = await fetch(imageSrc).then(res => res.blob());
    const file = new File([blob], "verify.jpg", { type: "image/jpeg" });

    setBiometricImage(file);
    setVerifyStatus("scanning");

    const formData = new FormData();
    formData.append("file", file);

    try {
      // Gọi AI check người thật
      const res = await axios.post("https://nbinh3120-ai-dating.hf.space/check-frame", formData);

      if (res.data.status === "real") {
        setVerifyStatus("real");
        setIsVerified(true);
      } else if (res.data.status === "fake") {
        setVerifyStatus("fake");
      } else {
        setVerifyStatus("noface");
      }
    } catch (err) {
      console.error(err);
      setVerifyStatus("idle");
    }
  };
  const handleFinalSubmit = async () => {
    setIsLoading(true);
    setError('');

    try {
      const finalData = new FormData();

      // Cấu hình nén ảnh
      const compressionOptions = {
        maxSizeMB: 1.0,
        maxWidthOrHeight: 1440,
        useWebWorker: true,
      };

      // Đóng gói thông tin hồ sơ
      Object.keys(formData).forEach(key => {
        if (key === 'interests') {
          finalData.append('interests', JSON.stringify(formData[key]));
        } else if (key !== 'avatar' && key !== 'dateOfBirth' && formData[key] !== null && formData[key] !== '') {
          finalData.append(key, formData[key]);
        }
      });

      // Tính tuổi từ ngày sinh
      if (formData.dateOfBirth) {
        const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
        const match = formData.dateOfBirth.match(dateRegex);
        if (match) {
          const day = parseInt(match[1], 10);
          const month = parseInt(match[2], 10);
          const year = parseInt(match[3], 10);
          const birthDate = new Date(year, month - 1, day);
          const today = new Date();
          let calculatedAge = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            calculatedAge--;
          }
          finalData.append('age', calculatedAge);
          finalData.append('dateOfBirth', formData.dateOfBirth);
        }
      }

      // Đính kèm ảnh đại diện
      if (formData.avatar) {
        const compressedFile = await imageCompression(formData.avatar, compressionOptions);
        finalData.append('avatar', compressedFile, formData.avatar.name || "avatar.jpg");
      }

      // Đính kèm ảnh selfie sinh trắc học
      if (biometricImage) {
        const compressedBio = await imageCompression(biometricImage, compressionOptions);
        finalData.append('biometricPhoto', compressedBio, "biometric.jpg");
      }

      // Thêm tọa độ
      if (mapPosition) {
        finalData.append('latitude', mapPosition.lat);
        finalData.append('longitude', mapPosition.lng);
      }

      // GỌI API ĐỒNG BỘ AI
      const res = await aiMatchService.syncProfileToAI(finalData);
      const result = res.data || res;

      if (result.success || result.message === "Hồ sơ đang được hệ thống AI xử lý nền!") {
        if (result.user) setUser(result.user);
        navigate('/discover', { state: { justVerified: true } });
      } else {
        setError(result.message || "Xác thực không thành công");
      }

    } catch (err) {
      console.error("Lỗi hoàn tất hồ sơ:", err);
      setError(err.response?.data?.message || err.response?.data?.error || 'Có lỗi xảy ra trong quá trình lưu hồ sơ.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="animate-fade-in">
            <h1 className="text-[1.75rem] leading-tight font-black text-gray-900 mb-6 tracking-tight">
              Hãy cho chúng tôi biết <span className="text-primary-600">về bạn.</span>
            </h1>

            <div className="space-y-4">
              {/* Họ và tên */}
              <div>
                <label className="block text-[10px] font-bold text-primary-700 uppercase tracking-widest mb-1.5 ml-1">
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="w-full bg-white text-gray-800 text-sm rounded-full border border-primary-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-200 transition-all placeholder:text-gray-400 font-semibold shadow-sm"
                  placeholder="Nhập tên của bạn..."
                />
              </div>

              {/* Ngày sinh */}
              <div>
                <label className="block text-[10px] font-bold text-primary-700 uppercase tracking-widest mb-1.5 ml-1">
                  Ngày sinh <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    className="w-full bg-white text-gray-800 text-sm rounded-full border border-primary-100 px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-primary-200 transition-all font-semibold shadow-sm"
                    placeholder="dd/mm/yyyy"
                    maxLength={10}
                  />
                  {/* Icon lịch */}
                  <button
                    type="button"
                    onClick={() => datePickerRef.current?.showPicker()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-primary-500 hover:text-white hover:bg-primary-500 rounded-full transition-all"
                    title="Chọn từ lịch"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                  {/* Date picker ẩn */}
                  <input
                    ref={datePickerRef}
                    type="date"
                    onChange={handleDatePickerChange}
                    className="absolute opacity-0 pointer-events-none"
                    tabIndex={-1}
                  />
                </div>
              </div>

              {/* Giới tính */}
              <div>
                <label className="block text-[10px] font-bold text-primary-700 uppercase tracking-widest mb-2 ml-1">
                  Giới tính <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleChange({ target: { name: 'gender', value: 'male' } })}
                    className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-2xl border-2 transition-all ${formData.gender === 'male' ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-sm shadow-primary-100' : 'border-transparent bg-white shadow-sm text-gray-500 hover:bg-primary-50'
                      }`}
                  >
                    <svg className="w-5 h-5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="14" r="5" /><line x1="21" y1="3" x2="13.5" y2="10.5" /><polyline points="16 3 21 3 21 8" /></svg>
                    <span className="text-[10px] font-bold mt-1">Nam</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange({ target: { name: 'gender', value: 'female' } })}
                    className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-2xl border-2 transition-all ${formData.gender === 'female' ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-sm shadow-primary-100' : 'border-transparent bg-white shadow-sm text-gray-500 hover:bg-primary-50'
                      }`}
                  >
                    <svg className="w-5 h-5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="10" r="5" /><line x1="12" y1="15" x2="12" y2="22" /><line x1="9" y1="19" x2="15" y2="19" /></svg>
                    <span className="text-[10px] font-bold mt-1">Nữ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange({ target: { name: 'gender', value: 'other' } })}
                    className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-2xl border-2 transition-all ${formData.gender === 'other' ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-sm shadow-primary-100' : 'border-transparent bg-white shadow-sm text-gray-500 hover:bg-primary-50'
                      }`}
                  >
                    <svg className="w-5 h-5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><line x1="21" y1="3" x2="14.8" y2="9.2" /><polyline points="16 3 21 3 21 8" /><line x1="3" y1="3" x2="9.2" y2="9.2" /><polyline points="3 8 3 3 8 3" /><line x1="4.5" y1="7.5" x2="7.5" y2="4.5" /><line x1="12" y1="16" x2="12" y2="22" /><line x1="9" y1="19" x2="15" y2="19" /></svg>
                    <span className="text-[10px] font-bold mt-1">Khác</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="animate-fade-in">
            <h1 className="text-[1.75rem] leading-tight font-black text-gray-900 mb-6 tracking-tight">
              Thêm vài dòng <span className="text-primary-600">về bản thân.</span>
            </h1>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-primary-700 uppercase tracking-widest mb-1.5 ml-1">
                  Ảnh đại diện <span className="text-red-500">*</span> <span className="text-gray-500 normal-case text-[9px]">(Bạn phải chọn ảnh khuôn mặt rõ nhất để xác thực tài khoản)</span>
                </label>
                <div className="border-2 border-dashed border-primary-200 bg-white/60 rounded-3xl py-2 px-4 text-center hover:border-primary-400 transition-colors shadow-sm">
                  <input type="file" name="avatar" onChange={handleAvatarChange} accept="image/*" className="hidden" id="avatar-upload" />
                  <label htmlFor="avatar-upload" className="cursor-pointer block">
                    {formData.avatar ? (
                      <div className="flex flex-col items-center">
                        <img src={URL.createObjectURL(formData.avatar)} alt="Preview" className="w-16 h-16 rounded-full object-cover mb-1 shadow-md border-2 border-white" />
                        <span className="text-[10px] font-bold text-primary-600">Thay đổi ảnh</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-white shadow-sm rounded-full flex items-center justify-center mx-auto mb-2">
                          <svg className="w-5 h-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                        </div>
                        <p className="text-sm font-bold text-gray-600">Nhấn để tải ảnh lên</p>
                        <p className="text-[10px] text-gray-400 mt-1 font-medium">JPG, PNG hoặc GIF</p>
                      </>
                    )}
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-primary-700 uppercase tracking-widest mb-1.5 ml-1">Tiểu sử (Bio)</label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  className="w-full bg-white text-gray-800 text-sm rounded-3xl border border-primary-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-200 transition-all font-semibold min-h-[70px] resize-none shadow-sm"
                  placeholder="Giới thiệu đôi nét về tính cách..."
                  maxLength={500}
                />
                <p className="text-[10px] text-gray-400 mt-1 text-right font-medium">{formData.bio.length}/500 ký tự</p>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="animate-fade-in">
            <h1 className="text-[1.75rem] leading-tight font-black text-gray-900 mb-6 tracking-tight">
              Sở thích & <span className="text-primary-600">Tìm kiếm.</span>
            </h1>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-primary-700 uppercase tracking-widest mb-1.5 ml-1">
                  Sở thích <span className="text-red-500">*</span> <span className="text-gray-500 normal-case text-[9px]">(Chọn ít nhất 3)</span>
                </label>

                {/* Hiển thị tất cả sở thích: Custom interests trước, sau đó là gợi ý */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {/* Custom interests - hiển thị trước */}
                  {formData.interests
                    .filter(interest => !interestsList.includes(interest))
                    .map((interest, idx) => (
                      <button
                        key={`custom-${idx}`}
                        type="button"
                        onClick={() => toggleInterest(interest)}
                        className="px-2.5 py-1 rounded-full text-[10px] font-bold transition-all shadow-sm bg-gradient-to-r from-primary-600 to-primary-500 text-white"
                      >
                        {interest}
                      </button>
                    ))}

                  {/* Suggested interests - hiển thị sau */}
                  {interestsList.map(interest => (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleInterest(interest)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all shadow-sm ${formData.interests.includes(interest)
                        ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white'
                        : 'bg-white text-gray-600 hover:bg-primary-50'
                        }`}
                    >
                      {interest}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newInterest}
                    onChange={(e) => setNewInterest(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomInterest())}
                    className="flex-1 bg-white text-gray-800 text-sm rounded-full border border-primary-100 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-200 transition-all font-semibold shadow-sm"
                    placeholder="Nhập sở thích khác..."
                  />
                  <button type="button" onClick={handleAddCustomInterest} className="px-4 py-2 bg-white text-gray-700 text-xs font-bold rounded-full hover:bg-gray-50 border border-gray-200 shadow-sm transition-colors">
                    Thêm
                  </button>
                </div>

                {/* Hiển thị số lượng sở thích đã chọn */}
                <p className="text-[10px] text-gray-500 mt-1 ml-1">
                  Đã chọn: <span className={`font-bold ${formData.interests.length >= 3 ? 'text-green-600' : 'text-red-500'}`}>{formData.interests.length}/3</span>
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-primary-700 uppercase tracking-widest mb-1.5 ml-1">
                  Nơi ở (Thành phố) <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    className="w-full bg-white text-gray-800 text-sm rounded-full border border-primary-100 pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-primary-200 transition-all font-semibold shadow-sm"
                    placeholder="VD: TP. Hồ Chí Minh"
                  />
                  <button
                    type="button"
                    onClick={handleOpenMap}
                    title="Mở bản đồ chọn vị trí"
                    className="absolute right-2 p-2 text-primary-500 hover:text-white hover:bg-primary-500 rounded-full transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-primary-700 uppercase tracking-widest mb-1.5 ml-1">
                  Mục tiêu tìm kiếm <span className="text-red-500">*</span>
                </label>
                <select
                  name="lookingFor"
                  value={formData.lookingFor}
                  onChange={handleChange}
                  className="w-full bg-white text-gray-800 text-sm rounded-full border border-primary-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-200 transition-all font-semibold appearance-none shadow-sm"
                >
                  <option value="">Chọn mục tiêu...</option>
                  <option value="relationship">Mối quan hệ nghiêm túc</option>
                  <option value="friendship">Kết bạn</option>
                  <option value="casual">Hẹn hò vui vẻ</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 4: {
        const CIRCUMFERENCE = Math.round(2 * Math.PI * 138);

        const totalChallenges = challenges?.length || 1; // Fallback về 1 để tránh chia cho 0
        const progressOffset = biometricImage
          ? 0
          : CIRCUMFERENCE - (currentChallengeIdx * (CIRCUMFERENCE / totalChallenges));

        const borderClass =
          isAiProcessing
            ? "border-yellow-400 opacity-80"
            : isScanningLive
              ? "border-primary-400 scale-105"
              : "border-white/40";

        const displayMessage =
          isAiProcessing
            ? "ĐANG PHÂN TÍCH..."
            : activeMessage.includes("Tuyệt")
              ? "✨ ĐIỂM DỮ LIỆU KHỚP"
              : activeMessage.toUpperCase();

        return (
          <div className="animate-fade-in text-center flex flex-col items-center w-full">

            {/* HEADER */}
            <div className="mb-6">
              <h1 className="text-2xl font-black text-gray-900">
                Xác thực <span className="text-primary-600">Gương mặt 3D</span>
              </h1>
              <p className="text-[11px] text-gray-500 font-bold mt-2 px-4 py-1 bg-gray-100 rounded-full">
                {isScanningLive
                  ? "Hệ thống đang quét sinh trắc học..."
                  : "Vui lòng giữ khung hình ổn định"}
              </p>
            </div>

            {/* CAMERA */}
            <div className="relative w-72 h-72 mx-auto mb-8">

              {/* PROGRESS */}
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="144" cy="144" r="138" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                <circle
                  cx="144"
                  cy="144"
                  r="138"
                  fill="none"
                  stroke="url(#gradient-strike)"
                  strokeWidth="8"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={progressOffset}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
                <defs>
                  <linearGradient id="gradient-strike">
                    <stop offset="0%" stopColor="#f43f5e" />
                    <stop offset="100%" stopColor="#fb7185" />
                  </linearGradient>
                </defs>
              </svg>

              {/* INNER */}
              <div className="absolute inset-4 rounded-full overflow-hidden border-4 border-white bg-slate-900 flex items-center justify-center">

                {!biometricImage ? (
                  <div className="relative w-full h-full">

                    {/* WEBCAM */}
                    <Webcam
                      ref={webcamRef}
                      audio={false}
                      screenshotFormat="image/jpeg"
                      videoConstraints={{
                        width: 640,   // giảm lag
                        height: 480,
                        facingMode: "user"
                      }}
                      className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                    />

                    {/* GUIDE */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className={`w-40 h-52 border-2 border-dashed rounded-[120px] shadow-[0_0_0_999px_rgba(15,23,42,0.6)] transition-all ${borderClass}`} />
                    </div>

                    {/* SCAN LINE */}
                    {isScanningLive && !isAiProcessing && (
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary-400 to-transparent animate-scan-move" />
                    )}

                    {/* MESSAGE */}
                    {isScanningLive && (
                      <div className="absolute bottom-8 w-full flex justify-center">
                        <div className={`bg-black/80 text-white px-4 py-2 rounded-xl text-xs font-bold ${isAiProcessing ? "opacity-50" : "animate-bounce"}`}>
                          {displayMessage}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative w-full h-full">
                    <img
                      src={URL.createObjectURL(biometricImage)}
                      className="w-full h-full object-cover scale-x-[-1]"
                    />

                    <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                      <div className="bg-white rounded-full p-2 shadow-lg">
                        <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* STATUS */}
            <div className="w-full px-10 space-y-5">
              <div className={`rounded-2xl p-4 flex justify-center gap-3 ${isScanningLive ? 'bg-primary-50' : 'bg-slate-50'}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${isScanningLive ? 'bg-primary-500 animate-pulse' : biometricImage ? 'bg-green-500' : 'bg-slate-400'}`} />
                <span className="text-xs font-bold">{activeMessage}</span>
              </div>

              {/* BUTTON */}
              {!isScanningLive && !biometricImage && (
                <button
                  onClick={startLiveScan}
                  className="w-full py-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-2xl font-bold"
                >
                  BẮT ĐẦU QUÉT
                </button>
              )}

              {isScanningLive && (
                <div className="w-full py-4 bg-slate-100 text-slate-400 rounded-2xl flex justify-center items-center gap-2">
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
                  ĐANG PHÂN TÍCH...
                </div>
              )}

              {biometricImage && (
                <button
                  onClick={() => {
                    setBiometricImage(null);
                    setCurrentChallengeIdx(0);
                    setActiveMessage("Chuẩn bị...");
                    setIsVerified(false);
                  }}
                  className="w-full py-4 bg-white border rounded-2xl font-bold"
                >
                  QUÉT LẠI
                </button>
              )}
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-primary-50 via-gray-50 to-primary-100/50 flex items-center justify-center p-4 relative overflow-hidden" style={{ fontFamily: 'Roboto, sans-serif' }}>
      <div className="pointer-events-none fixed -top-24 -left-24 w-72 h-72 rounded-full bg-primary-200/40 blur-3xl z-0" />
      <div className="pointer-events-none fixed top-40 -right-24 w-80 h-80 rounded-full bg-secondary-200/30 blur-3xl z-0" />

      <div className="w-full max-w-md bg-[#fdf8fa] rounded-3xl shadow-[0_15px_40px_-15px_rgba(0,0,0,0.1)] border border-primary-100/60 flex flex-col relative z-10 overflow-hidden max-h-[95vh]">
        {/* Header inside the card */}
        <header className="px-6 py-4 flex items-center justify-between shrink-0 bg-[#fdf8fa]">
          <div className="text-xl font-black text-primary-600 tracking-tighter cursor-pointer" onClick={() => navigate('/')}>LoveAI</div>
          <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest bg-white px-2.5 py-1 rounded-full shadow-sm border border-gray-100">
            Bước {currentStep}/4
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 flex flex-col pt-1 scrollbar-hide">
          {/* Progress Bar */}
          <div className="w-full mb-5 flex gap-1.5">
            {[1, 2, 3, 4].map(step => (
              <div key={step} className={`h-1 flex-1 rounded-full transition-all duration-500 ${step <= currentStep ? 'bg-primary-500' : 'bg-primary-100'}`} />
            ))}
          </div>

          <main className="flex-1 flex flex-col">
            {error && (
              <div className="mb-4 p-3 bg-red-50/80 backdrop-blur-sm border border-red-100 rounded-2xl flex items-start gap-2 shadow-sm">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" /></svg>
                <p className="text-red-700 text-xs font-bold">{error}</p>
              </div>
            )}

            {renderStep()}

            {/* Action Buttons */}
            <div className="mt-8 flex flex-col items-center gap-3">
              <div className="w-full flex gap-3 h-11">
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(prev => prev - 1)}
                    className="flex-1 rounded-full bg-white text-gray-700 text-[15px] font-bold border-2 border-primary-100 hover:bg-gray-50 transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg> Trở lại
                  </button>
                )}

                {currentStep < 4 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="flex-1 rounded-full bg-gradient-to-r from-primary-600 to-primary-500 text-white text-[15px] font-bold shadow-md hover:scale-105 transition-all flex items-center justify-center gap-2"
                  >
                    Tiếp theo <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleFinalSubmit} // SỬA: Gọi hàm handleFinalSubmit đã viết ở trên
                    disabled={isLoading || !biometricImage} // SỬA: Chỉ cho bấm khi đã chụp ảnh selfie
                    className="flex-1 rounded-full bg-gradient-to-r from-primary-600 to-primary-500 text-white text-[15px] font-bold shadow-md hover:scale-105 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {isLoading ? 'Đang xác thực AI...' : 'Hoàn tất'} <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  </button>
                )}
              </div>


            </div>
          </main>
        </div>
      </div>

      {/* Map Modal */}
      {showMapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-lg">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-800 text-sm">Chọn vị trí trên bản đồ</h3>
              <button type="button" onClick={() => setShowMapModal(false)} className="p-1.5 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="h-[350px] w-full relative z-0 relative z-0">
              {mapPosition && (
                <MapContainer center={mapPosition} zoom={13} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap'
                  />
                  <LocationPickerMarker />
                </MapContainer>
              )}
            </div>

            <div className="p-4 bg-gray-50/50 flex justify-between items-center border-t border-gray-100">
              <div className="text-xs text-gray-500 font-medium whitespace-nowrap overflow-hidden text-ellipsis mr-3 flex-1">
                {mapPosition ? `Chạm để đổi vị trí` : 'Đang tải bản đồ...'}
              </div>
              <button
                type="button"
                disabled={!mapPosition || isLoading}
                onClick={handleConfirmMapSelection}
                className="px-6 py-2 bg-gradient-to-r from-primary-600 to-primary-500 text-white text-xs font-bold rounded-full disabled:opacity-50 hover:shadow-md transition-all"
              >
                {isLoading ? 'Đang xác định...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations for AI Verification */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes success-pop {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        
        @keyframes scan-move {
          0% { top: 0; }
          100% { top: 100%; }
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        
        .animate-success-pop {
          animation: success-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        .animate-scan-move {
          animation: scan-move 2s linear infinite;
        }
        
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default Onboarding;


