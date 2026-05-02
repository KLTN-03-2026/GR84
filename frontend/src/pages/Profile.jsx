import { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { userService, matchService } from '../services/api';
import Navbar from '../components/Navbar';

/**
 * Helper: Format location for display
 * Handles both string and GeoJSON object { type: 'Point', coordinates: [lng, lat] }
 */
const formatLocation = (location) => {
    if (!location) return null;

    // If it's a string, return as-is
    if (typeof location === 'string') {
        return location.trim() || null;
    }

    // If it's an object (GeoJSON format)
    if (typeof location === 'object') {
        // Handle locationText if available
        if (location.locationText) return location.locationText;

        // Handle coordinates [lng, lat]
        if (location.coordinates && Array.isArray(location.coordinates)) {
            // Usually we don't want to show coordinates to users
            // Return a formatted string or null
            const [lng, lat] = location.coordinates;
            // Don't expose raw coordinates - just return null or a placeholder
            return null;
        }
    }

    return null;
};

/**
 * Helper: Check if location is a non-empty string
 */
const hasLocation = (location) => {
    if (!location) return false;
    if (typeof location === 'string') return location.trim().length > 0;
    if (typeof location === 'object') {
        // Has locationText
        if (location.locationText) return true;
        // Has valid coordinates (not [0, 0])
        if (location.coordinates && Array.isArray(location.coordinates)) {
            const [lng, lat] = location.coordinates;
            return lng !== 0 || lat !== 0;
        }
    }
    return false;
};

const ProfileCompletionCard = ({ profile, onEditClick }) => {
    const missingFields = useMemo(() => {
        const missing = [];

        if (!profile?.avatar || profile.avatar.trim() === '') {
            missing.push({ key: 'avatar', label: 'Thêm ảnh đại diện', icon: '📷', points: 20 });
        }
        if (!profile?.bio || profile.bio.trim() === '') {
            missing.push({ key: 'bio', label: 'Viết lời giới thiệu', icon: '✍️', points: 10 });
        }
        if (!profile?.age) {
            missing.push({ key: 'age', label: 'Thêm tuổi của bạn', icon: '🎂', points: 10 });
        }
        // FIX: Use hasLocation helper for proper object/string check
        if (!hasLocation(profile?.location) && !profile?.locationText) {
            missing.push({ key: 'location', label: 'Thêm địa điểm của bạn', icon: '📍', points: 10 });
        }
        if (!profile?.interests || profile.interests.length < 3) {
            const needed = profile?.interests ? 3 - profile.interests.length : 3;
            missing.push({ key: 'interests', label: `Thêm ${needed > 0 ? needed : ''} sở thích nữa`, icon: '❤️', points: 10 });
        }
        if (!profile?.photos || profile.photos.length < 2) {
            const needed = profile?.photos ? 2 - profile.photos.length : 2;
            missing.push({ key: 'photos', label: `Thêm ${needed > 0 ? needed : ''} ảnh nữa`, icon: '🖼️', points: 20 });
        }
        if ((!profile?.occupation || profile.occupation.trim() === '') && (!profile?.education || profile.education.trim() === '')) {
            missing.push({ key: 'work', label: 'Thêm công việc hoặc học vấn', icon: '💼', points: 10 });
        }
        if (!profile?.gender || !profile?.lookingFor) {
            missing.push({ key: 'preferences', label: 'Thiết lập sở thích tìm kiếm', icon: '⚙️', points: 10 });
        }
        return missing;
    }, [profile]);

    const completion = profile?.profileCompletion || 0;
    const getProgressColor = () => {
        if (completion >= 80) return 'from-green-400 to-green-500';
        if (completion >= 50) return 'from-yellow-400 to-orange-500';
        return 'from-pink-400 to-red-500';
    };

    const getMessage = () => {
        if (completion >= 100) return 'Hồ sơ của bạn đã hoàn tất!';
        if (completion >= 80) return 'Sắp xong rồi! Thêm chút chi tiết nữa nhé.';
        if (completion >= 50) return 'Tiếp tục nào! Thêm thông tin để tăng cơ hội tương hợp.';
        return 'Hoàn thiện hồ sơ để tăng cơ hội tương hợp!';
    };

    return (
        <div className="bg-white rounded-3xl p-4 sm:p-6 mb-6 sm:mb-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-pink-50/60">
            <div className="flex items-center justify-between mb-3 gap-3">
                <h3 className="text-gray-800 font-bold text-[15px]">Độ hoàn thiện hồ sơ</h3>
                <span className="text-sm font-bold text-rose-600">{completion}%</span>
            </div>

            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-4">
                <div
                    className="h-full bg-rose-600 rounded-full transition-all duration-500"
                    style={{ width: `${completion}%` }}
                />
            </div>

            {completion >= 100 ? (
                <div className="flex items-center gap-2 text-rose-600">
                    <div className="w-5 h-5 rounded-full bg-rose-100 flex items-center justify-center">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <span className="text-sm font-bold">Hồ sơ đã hoàn tất!</span>
                </div>
            ) : (
                <div className="space-y-2 mt-4">
                    <p className="text-gray-500 text-sm mb-3">Hoàn thiện để tăng lượt tương hợp:</p>
                    {missingFields.slice(0, 3).map(field => (
                        <button key={field.key} onClick={() => onEditClick?.(field.key)} className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-rose-50 rounded-xl transition-colors group gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="text-xl">{field.icon}</span>
                                <span className="text-gray-700 text-sm font-medium group-hover:text-rose-600 transition-colors text-left break-words">{field.label}</span>
                            </div>
                            <span className="text-xs font-bold text-rose-500">+{field.points}%</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const ProfileSection = ({ icon, title, value, editLink, missing }) => {
    // FIX: Ensure value is not an object before rendering
    const isValueObject = value !== null && typeof value === 'object' && !Array.isArray(value);
    const isMissing = !value || isValueObject || (Array.isArray(value) && value.length === 0);

    // If value is an object, treat as missing
    const displayValue = isValueObject ? null : value;

    return (
        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:px-5 rounded-2xl ${isMissing && missing ? 'bg-white border border-dashed border-rose-300' : 'bg-[#FDF2F4]'}`}>
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-10 h-10 rounded-full bg-[#fce7ec] flex items-center justify-center text-rose-500 text-lg flex-shrink-0">
                    {icon}
                </div>
                <div className="flex flex-col min-w-0">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{title}</p>
                    {isMissing ? (
                        <p className="text-sm font-medium text-gray-400 italic break-words">{missing || 'Chưa thêm thông tin'}</p>
                    ) : Array.isArray(displayValue) ? (
                        <p className="text-sm font-bold text-gray-800 break-words">Đã thêm {displayValue.length} mục</p>
                    ) : (
                        <p className="text-sm font-bold text-gray-800 break-words">{displayValue}</p>
                    )}
                </div>
            </div>
            {editLink && (
                <Link to={editLink} className="w-full sm:w-auto text-center sm:text-left sm:ml-4 flex-shrink-0 bg-[#E5DFE0] hover:bg-gray-300 text-gray-800 px-5 py-2 rounded-full text-sm font-bold transition-colors">
                    Sửa
                </Link>
            )}
        </div>
    );
};

const Profile = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const { user: currentUser } = useAuthStore();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isOwnProfile, setIsOwnProfile] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                setLoading(true);
                // FIX: userId from URL params (route is /profile/:userId)
                const profileUserId = userId || currentUser?._id;
                console.log('[Profile] Fetching profile:', { userId, profileUserId, currentUserId: currentUser?._id });

                if (!profileUserId) {
                    navigate('/login');
                    return;
                }

                // Determine if viewing own profile
                const isOwn = !userId || userId === currentUser?._id;
                setIsOwnProfile(isOwn);
                console.log('[Profile] isOwnProfile:', isOwn, { urlUserId: userId, currentUserId: currentUser?._id });

                const data = await userService.getUserById(profileUserId);
                const profileData = data?.user || data?.data?.user || data;
                if (!profileData?._id) {
                    throw new Error('Invalid profile data received');
                }
                setProfile(profileData);
                console.log('[Profile] Loaded profile:', profileData.username, profileData._id);
            } catch (err) {
                console.error('[Profile] Error fetching profile:', err);
                setError(err.response?.data?.message || 'Không thể tải hồ sơ');
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [userId, currentUser, navigate]);

    const handleLike = async () => {
        if (!currentUser?.isVerifiedProfile) {
            alert('Tài khoản chưa xác thực, vui lòng xác thực trước.');
            return;
        }
        try {
            const data = await matchService.likeUser(profile._id);
            if (data.matched) {
                alert(`Tương hợp thành công! Bạn có thể bắt đầu trò chuyện với ${profile.username}`);
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Có lỗi xảy ra khi Thích người này');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-400 mb-4">{error}</p>
                    <Link to="/discover" className="text-pink-400 hover:underline">
                        Quay lại Khám phá
                    </Link>
                </div>
            </div>
        );
    }

    // Tính toán khoảng cách
    let distanceKm = null;
    const userLat = currentUser?.location?.coordinates?.[1];
    const userLon = currentUser?.location?.coordinates?.[0];
    const pLat = profile?.location?.coordinates?.[1];
    const pLon = profile?.location?.coordinates?.[0];
    
    if (userLat && userLon && pLat && pLon && (userLat !== 0 || userLon !== 0) && (pLat !== 0 || pLon !== 0)) {
        const R = 6371;
        const dLat = (pLat - userLat) * Math.PI / 180;
        const dLon = (pLon - userLon) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(userLat * Math.PI / 180) * Math.cos(pLat * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2); 
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        distanceKm = Math.round(R * c);
    }

    const locText = formatLocation(profile?.location) || profile?.locationText || null;
    let finalLocationString = null;
    if (distanceKm !== null && !isOwnProfile) {
        finalLocationString = `Cách bạn ${distanceKm}km`;
        if (locText) {
            finalLocationString += ` (${locText.split(',')[0]})`;
        }
    } else if (locText) {
        finalLocationString = locText;
    } else if (!isOwnProfile) {
        finalLocationString = 'Đang ở gần bạn';
    } else if (isOwnProfile && locText) {
        finalLocationString = locText;
    }

    const displayLocation = finalLocationString;
    const hasValidLocation = displayLocation !== null;
    const displayAge = profile?.age ?? null;
    const displayInterests = Array.isArray(profile?.interests) ? profile.interests : [];
    const displayPhotos = Array.isArray(profile?.photos) ? profile.photos : [];

    return (
        <div className="min-h-screen bg-[#FCF9F9]">
            <Navbar />

            <main className="pt-4 md:pt-20 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-16 px-4 sm:px-5">
                <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">

                    {/* LEFT SIDE: Header & Info */}
                    <div className="w-full lg:w-[35%] flex flex-col lg:sticky lg:top-28">
                        {/* Profile Header */}
                        <div className="relative mb-6">
                            {/* Cover / Background */}
                            <div className="h-36 sm:h-40 rounded-3xl bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-600 overflow-hidden shadow-sm">
                                {displayPhotos.length > 0 && (
                                    <img
                                        src={displayPhotos[0]}
                                        alt="Cover"
                                        className="w-full h-full object-cover opacity-50"
                                    />
                                )}
                            </div>

                            {/* Avatar */}
                            <div className="absolute -bottom-14 sm:-bottom-16 left-1/2 transform -translate-x-1/2">
                                <div className="relative">
                                    <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-[#FCF9F9] overflow-hidden shadow-xl">
                                        {profile?.avatar ? (
                                            <img
                                                src={profile.avatar}
                                                alt={profile.username}
                                                className="w-full h-full object-cover bg-white"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
                                                <span className="text-5xl font-bold text-white">
                                                    {profile?.username?.charAt(0)?.toUpperCase() || '?'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    {profile?.isOnline && (
                                        <div className="absolute bottom-2 right-2 w-5 h-5 bg-green-500 rounded-full border-4 border-[#FCF9F9]"></div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Profile Info */}
                        <div className="mt-16 sm:mt-20 text-center mb-7 sm:mb-8">
                            <div className="flex items-center justify-center gap-2">
                                <h1 className="text-[24px] sm:text-[26px] font-bold text-gray-900 leading-tight break-words">
                                    {profile?.fullName || profile?.username || 'Unknown User'}
                                    {displayAge && <span>, {displayAge}</span>}
                                </h1>
                            </div>

                            {hasValidLocation && (
                                <div className="flex items-center justify-center gap-1 mt-1 text-gray-600 font-medium px-3">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-sm break-words">{displayLocation}</span>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        {isOwnProfile ? null : (
                            <div className="flex justify-center gap-3 sm:gap-4 mt-2 w-full">
                                <button
                                    onClick={handleLike}
                                    className="w-14 h-14 rounded-full bg-white border-2 border-pink-500 flex items-center justify-center hover:bg-pink-500 transition-all group shadow-sm flex-shrink-0"
                                >
                                    <svg className="w-6 h-6 text-pink-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                    </svg>
                                </button>
                                <Link
                                    to="/messages"
                                    state={{ matchId: profile?._id }}
                                    className="w-full max-w-xs py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-center font-semibold rounded-full hover:from-pink-600 hover:to-purple-700 transition-all shadow-md"
                                >
                                    Nhắn tin
                                </Link>
                            </div>
                        )}

                        {/* Member Since */}
                        <div className="text-center mt-6 sm:mt-8 text-gray-400 text-sm font-medium">
                            Thành viên từ {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' }) : 'Không rõ'}
                        </div>
                    </div>

                    {/* RIGHT SIDE: Content Sections */}
                    <div className="w-full lg:w-[65%]">
                        {/* Profile Completion (only for own profile) */}
                        {isOwnProfile && (
                            <ProfileCompletionCard profile={profile} />
                        )}

                        {/* Profile Sections Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                            {/* Basic Info */}
                            <div className="md:col-span-2">
                                <ProfileSection
                                    icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>}
                                    title="THÔNG TIN CƠ BẢN"
                                    value={profile?.gender ? `${profile.gender}${profile?.lookingFor ? ` - Đang tìm kiếm ${profile.lookingFor}` : ''}` : null}
                                    editLink="/settings"
                                    missing="Thiết lập hiển thị"
                                />
                            </div>

                            {/* Bio */}
                            <div className="md:col-span-2">
                                <ProfileSection
                                    icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>}
                                    title="VỀ TÔI"
                                    value={profile?.bio || null}
                                    editLink="/settings"
                                    missing="Viết vài điều về bản thân"
                                />
                            </div>

                            {/* Work & Education */}
                            <div className="md:col-span-2">
                                <ProfileSection
                                    icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" /></svg>}
                                    title="CÔNG VIỆC & HỌC VẤN"
                                    value={profile?.occupation || profile?.education || null}
                                    editLink="/settings"
                                    missing="Thêm công việc hoặc học vấn"
                                />
                            </div>

                            {/* Photos */}
                            <ProfileSection
                                icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>}
                                title="ẢNH"
                                value={displayPhotos.length > 0 ? displayPhotos : null}
                                editLink="/settings"
                                missing="Thêm ít nhất 2 ảnh"
                            />

                            {/* Interests */}
                            <ProfileSection
                                icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>}
                                title="SỞ THÍCH"
                                value={displayInterests.length > 0 ? displayInterests : null}
                                editLink="/settings"
                                missing="Thêm sở thích của bạn"
                            />

                            {/* Lifestyle */}
                            {(profile?.height || profile?.drinking || profile?.smoking) && (
                                <ProfileSection
                                    icon={<span>📏</span>}
                                    title="LỐI SỐNG"
                                    value={[
                                        profile.height ? `Cao: ${profile.height}cm` : null,
                                        profile.drinking ? `Uống rượu: ${profile.drinking}` : null,
                                        profile.smoking ? `Hút thuốc: ${profile.smoking}` : null
                                    ].filter(Boolean).join(' • ')}
                                    editLink="/settings"
                                />
                            )}

                            {/* Looking For */}
                            {profile?.lookingFor && (
                                <ProfileSection
                                    icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
                                    title="ĐANG TÌM KIẾM"
                                    value={profile.lookingFor === 'bạn' ? 'Kết bạn' : (profile.lookingFor.charAt(0).toUpperCase() + profile.lookingFor.slice(1))}
                                    editLink="/settings"
                                />
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Profile;
