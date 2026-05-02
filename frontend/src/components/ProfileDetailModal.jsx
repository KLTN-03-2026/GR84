import React, { useState, useEffect, useRef } from 'react';
import { getFullImageUrl } from '../services/api';

/* ─── Icons ─── */
const Icons = {
  ChevronDown: (props) => <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="6 9 12 15 18 9"></polyline></svg>,
  Target: (props) => <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 20} height={props.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>,
  MapPin: (props) => <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 20} height={props.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>,
  User: (props) => <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 20} height={props.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
};

const ProfileDetailModal = ({ isOpen, onClose, profile, matchScore, sharedInterests }) => {
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const contentRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen || !profile) return null;

  // Swipe handlers for the entire overlay/modal
  const handleTouchStart = (e) => {
    // Only allow swipe down if we are at the top of the scroll container
    if (contentRef.current && contentRef.current.scrollTop > 0) {
      return;
    }
    setStartY(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const y = e.touches[0].clientY;
    const deltaY = y - startY;
    if (deltaY > 0) {
      // Swipe down
      setCurrentY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (currentY > 150) {
      // Swiped down far enough to close
      onClose();
    }
    setCurrentY(0); // Reset for animation
  };

  // Compile all photos
  const photos = [];
  if (profile.avatar) photos.push(profile.avatar);
  if (profile.photos) {
    profile.photos.forEach(p => {
      if (p !== profile.avatar) photos.push(p);
    });
  }
  if (photos.length === 0) {
    photos.push(null); // placeholder
  }

  const initial = ((profile.fullName || profile.username) ?? '?').charAt(0).toUpperCase();

  // Handle translation of the modal based on drag
  const transformStyle = currentY > 0 ? `translateY(${currentY}px)` : 'translateY(0)';

  return (
    <div 
      className={`fixed inset-0 z-50 flex flex-col justify-end transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>

      {/* Modal Content */}
      <div 
        className="relative bg-white w-full h-[90vh] md:h-[85vh] rounded-t-3xl shadow-2xl flex flex-col transition-transform duration-300 ease-out"
        style={{ transform: transformStyle }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Swipe Handle */}
        <div className="w-full flex justify-center py-3 cursor-grab flex-shrink-0" onClick={onClose}>
          <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
        </div>

        {/* Scrollable Content */}
        <div 
          className="flex-1 overflow-y-auto px-4 pb-12 sm:px-6 md:px-8" 
          ref={contentRef}
          onTouchStart={(e) => e.stopPropagation()} 
        >
          {/* Header Info */}
          <div className="flex justify-between items-end mb-6 mt-2">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-2">
                {profile.fullName || profile.username}
                {profile.age && <span className="text-2xl font-semibold text-gray-600">, {profile.age}</span>}
                {profile.isVerifiedProfile && (
                  <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </h1>
              
              <div className="flex items-center gap-3 mt-2 text-gray-500 font-medium">
                {profile.distanceKm !== undefined && profile.distanceKm !== null && (
                  <span className="flex items-center gap-1">
                    <Icons.MapPin size={16} />
                    Cách bạn {profile.distanceKm}km
                  </span>
                )}
                {profile.gender && (
                  <span className="capitalize bg-gray-100 px-2 py-0.5 rounded-md text-xs">
                    {profile.gender === 'male' ? 'Nam' : profile.gender === 'female' ? 'Nữ' : 'Khác'}
                  </span>
                )}
              </div>
            </div>
            
            {/* Match Rate AI */}
            {matchScore !== undefined && (
              <div className="flex flex-col items-center justify-center p-3 bg-gradient-to-br from-rose-50 to-pink-100 rounded-2xl border border-rose-100 shadow-sm">
                <span className="text-2xl font-black text-rose-600">{matchScore}%</span>
                <span className="text-[10px] font-bold text-rose-400 uppercase">Tương hợp</span>
              </div>
            )}
          </div>

          {/* Photos Gallery - Horizontal Scroll */}
          <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory hide-scrollbar">
            {photos.map((src, index) => (
              <div 
                key={index} 
                className="relative flex-shrink-0 w-64 h-80 sm:w-80 sm:h-96 rounded-2xl overflow-hidden snap-center bg-gray-100 shadow-md"
              >
                {src ? (
                  <img src={getFullImageUrl(src)} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-pink-100 to-rose-50 text-rose-300">
                    <Icons.User size={48} />
                    <span className="mt-4 font-bold text-2xl">{initial}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Main Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
            
            {/* Bio */}
            <div className="md:col-span-2">
              <h2 className="text-lg font-bold text-gray-900 mb-2 border-b pb-2">Giới thiệu bản thân</h2>
              <p className="text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-2xl whitespace-pre-wrap min-h-[100px]">
                {profile.bio || "Chưa có lời giới thiệu nào."}
              </p>
              
              {/* Additional Details */}
              <div className="mt-6 flex flex-wrap gap-2">
                {profile.occupation && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                    💼 {profile.occupation}
                  </span>
                )}
                {profile.education && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium">
                    🎓 {profile.education}
                  </span>
                )}
                {profile.height && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium">
                    📏 {profile.height} cm
                  </span>
                )}
              </div>
            </div>

            {/* Interests & Lifestyle */}
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-3 border-b pb-2">Sở thích</h2>
                {profile.interests && profile.interests.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {profile.interests.map((interest, i) => {
                      const isShared = sharedInterests?.includes(interest);
                      return (
                        <span 
                          key={i} 
                          className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
                            isShared 
                            ? 'bg-rose-100 border-rose-200 text-rose-700 font-bold shadow-sm' 
                            : 'bg-white border-gray-200 text-gray-600'
                          }`}
                        >
                          {interest}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500 italic text-sm">Chưa có thông tin.</p>
                )}
              </div>

              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-3 border-b pb-2">Lối sống</h2>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">🍷</span>
                    <div className="text-sm">
                      <span className="text-gray-500 block text-xs uppercase font-bold">Uống rượu bia</span>
                      <span className="text-gray-900 font-medium">
                        {profile.drinking === 'never' ? 'Không bao giờ' : profile.drinking === 'sometimes' ? 'Thỉnh thoảng' : profile.drinking === 'often' ? 'Thường xuyên' : 'Không rõ'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">🚬</span>
                    <div className="text-sm">
                      <span className="text-gray-500 block text-xs uppercase font-bold">Hút thuốc</span>
                      <span className="text-gray-900 font-medium">
                        {profile.smoking === 'never' ? 'Không bao giờ' : profile.smoking === 'sometimes' ? 'Thỉnh thoảng' : profile.smoking === 'often' ? 'Thường xuyên' : 'Không rõ'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
          
          <div className="mt-8 text-center pb-8">
            <button 
              onClick={onClose}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-bold rounded-full hover:bg-gray-800 transition-colors shadow-lg"
            >
              <Icons.ChevronDown size={20} />
              Đóng hồ sơ
            </button>
          </div>
          
        </div>
      </div>
      
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default ProfileDetailModal;
