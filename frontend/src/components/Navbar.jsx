import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NotificationBell from './NotificationBell';

const Navbar = () => {
    const { user, logout } = useAuthStore();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogoutClick = () => {
        setIsMenuOpen(false);
        setShowLogoutModal(true);
    };

    const handleConfirmLogout = async () => {
        setShowLogoutModal(false);
        await logout();
        navigate('/');
    };

    const handleCancelLogout = () => {
        setShowLogoutModal(false);
    };

    useEffect(() => {
        const handleNotificationOpened = () => {
            setIsMenuOpen(false);
        };

        window.addEventListener('navbar:notificationOpened', handleNotificationOpened);
        return () => {
            window.removeEventListener('navbar:notificationOpened', handleNotificationOpened);
        };
    }, []);

    const navLinks = [
        { to: '/discover', label: 'Khám phá' },
        { to: '/messages', label: 'Tin nhắn' },
        { to: '/video-chat', label: 'Random Video' },
    ];

    const bottomNavItems = [
        {
            to: '/discover',
            label: 'Khám phá',
            icon: (isActive) => (
                <svg className={`w-8 h-8 ${isActive ? 'text-gray-900' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            )
        },
        {
            to: '/messages',
            label: 'Tin nhắn',
            icon: (isActive) => (
                <svg className={`w-8 h-8 ${isActive ? 'text-gray-900' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
            )
        },
        {
            to: '/video-chat',
            label: 'Video',
            icon: (isActive) => (
                <svg className={`w-8 h-8 ${isActive ? 'text-gray-900' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            )
        },
        {
            to: '/safety',
            label: 'An toàn',
            icon: (isActive) => (
                <svg className={`w-8 h-8 ${isActive ? 'text-gray-900' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        },
        {
            to: '/profile',
            label: 'Tôi',
            icon: (isActive) => (
                <svg className={`w-8 h-8 ${isActive ? 'text-gray-900' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            )
        }
    ];

    const isDiscover = location.pathname === '/discover';
    const isMessages = location.pathname === '/messages' || location.pathname.startsWith('/messages/');
    const isVideo = location.pathname === '/video-chat';
    const isSafety = location.pathname === '/safety';
    const isProfile = location.pathname === '/profile' || location.pathname.startsWith('/profile/');
    const useInlineMobileBottomSpacing = isDiscover || isMessages || isVideo || isSafety || isProfile;

    return (
        <>
            <nav className="hidden md:block bg-gray-50 border-b border-gray-200 sticky top-0 z-50 shadow-sm">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex items-center h-16 gap-8">
                        <Link
                            to="/discover"
                            className="text-2xl font-bold text-rose-500 flex-shrink-0"
                            style={{ fontFamily: 'Georgia, serif', letterSpacing: '-0.5px' }}
                        >
                            LoveAI
                        </Link>

                        <div className="flex flex-1 justify-center">
                            <div className="flex items-center gap-1">
                                {navLinks.map((link) => {
                                    const isHighlighted =
                                        (link.label === 'Khám phá' && isDiscover) ||
                                        (link.label === 'Tin nhắn' && isMessages) ||
                                        (link.label === 'Random Video' && isVideo);

                                    return (
                                        <Link
                                            key={`${link.to}-${link.label}`}
                                            to={link.to}
                                            className={`px-5 py-2 text-sm font-medium transition-all rounded-full ${isHighlighted
                                                ? 'text-gray-900 border-b-2 border-rose-500'
                                                : 'text-gray-500 hover:text-gray-800'
                                                }`}
                                            style={isHighlighted ? { borderRadius: 0, borderBottom: '2px solid #f43f5e' } : {}}
                                        >
                                            {link.label}
                                        </Link>
                                    );
                                })}
                                <Link
                                    to="/safety"
                                    className={`px-5 py-2 text-sm font-medium transition-all ${isSafety
                                        ? 'text-gray-900'
                                        : 'text-gray-500 hover:text-gray-800'
                                        }`}
                                    style={isSafety ? { borderBottom: '2px solid #f43f5e' } : {}}
                                >
                                    An toàn
                                </Link>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
                            {/* Filter/Search Button */}
                            <button 
                                onClick={() => window.dispatchEvent(new CustomEvent('openFilterModal'))}
                                className="w-9 h-9 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
                                title="Bộ lọc tìm kiếm"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                            </button>

                            <NotificationBell />

                            <div className="relative">
                                <button
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                    className="flex items-center gap-2"
                                >
                                    <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-rose-300">
                                        {user?.avatar ? (
                                            <img
                                                src={user.avatar}
                                                alt={user.username}
                                                className="w-9 h-9 object-cover"
                                            />
                                        ) : (
                                            <div className="w-9 h-9 bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white font-semibold text-sm">
                                                {user?.username?.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {isMenuOpen && (
                                    <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-10">
                                        <div className="px-4 py-3 border-b border-gray-100">
                                            <p className="text-sm font-semibold text-gray-800">{user?.fullName || user?.username}</p>
                                            <p className="text-xs text-gray-400">{user?.email}</p>
                                        </div>
                                        <Link
                                            to="/profile"
                                            onClick={() => setIsMenuOpen(false)}
                                            className="flex items-center gap-3 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                                        >
                                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                            Xem hồ sơ
                                        </Link>
                                        <Link
                                            to="/profile/edit"
                                            onClick={() => setIsMenuOpen(false)}
                                            className="flex items-center gap-3 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                                        >
                                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            Chỉnh sửa hồ sơ
                                        </Link>
                                        <div className="border-t border-gray-100 mt-2 pt-2">
                                            <button
                                                onClick={handleLogoutClick}
                                                className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                                </svg>
                                                Đăng xuất
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="md:hidden bg-white border-b border-gray-200 sticky top-0 z-40 px-4 py-3 flex items-center justify-between">
                <Link
                    to="/discover"
                    className="text-xl font-bold text-rose-500"
                    style={{ fontFamily: 'Georgia, serif', letterSpacing: '-0.5px' }}
                >
                    LoveAI
                </Link>
                <div className="flex items-center gap-3">
                    {/* Filter/Search Button for Mobile */}
                    <button 
                        onClick={() => window.dispatchEvent(new CustomEvent('openFilterModal'))}
                        className="w-9 h-9 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
                        title="Bộ lọc tìm kiếm"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                    </button>

                    <NotificationBell />
                    <div className="relative">
                        <button
                            onClick={() => {
                                setIsMenuOpen((prev) => {
                                    const next = !prev;
                                    if (next) {
                                        window.dispatchEvent(new CustomEvent('navbar:profileMenuOpened'));
                                    }
                                    return next;
                                });
                            }}
                            className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-rose-300 flex items-center justify-center"
                        >
                            {user?.avatar ? (
                                <img
                                    src={user.avatar}
                                    alt={user.username}
                                    className="w-9 h-9 object-cover"
                                />
                            ) : (
                                <div className="w-9 h-9 bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white font-semibold text-sm">
                                    {user?.username?.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </button>

                        {isMenuOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50">
                                <div className="px-4 py-3 border-b border-gray-100">
                                    <p className="text-sm font-semibold text-gray-800">{user?.fullName || user?.username}</p>
                                    <p className="text-xs text-gray-400">{user?.email}</p>
                                </div>
                                <Link
                                    to="/profile"
                                    onClick={() => setIsMenuOpen(false)}
                                    className="flex items-center gap-3 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    Xem hồ sơ
                                </Link>
                                <Link
                                    to="/profile/edit"
                                    onClick={() => setIsMenuOpen(false)}
                                    className="flex items-center gap-3 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Chỉnh sửa hồ sơ
                                </Link>
                                <div className="border-t border-gray-100 mt-2 pt-2">
                                    <button
                                        onClick={handleLogoutClick}
                                        className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                        </svg>
                                        Đăng xuất
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                <div className="w-full px-1">
                    <div className="grid grid-cols-5 items-center h-[82px] pt-2">
                        {bottomNavItems.map((item) => {
                            const isActive =
                                (item.label === 'Khám phá' && isDiscover) ||
                                (item.label === 'Tin nhắn' && isMessages) ||
                                (item.label === 'Video' && isVideo) ||
                                (item.label === 'An toàn' && isSafety) ||
                                (item.label === 'Tôi' && isProfile);

                            return (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    className={`flex flex-col items-center justify-center gap-1 w-full h-full pt-1 pb-0.5 transition-all ${isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${isActive ? 'bg-rose-50' : 'bg-transparent'}`}>
                                        {item.icon(isActive)}
                                    </div>
                                    <span className={`text-[12px] font-medium ${isActive ? 'text-gray-900' : 'text-gray-600'}`}>
                                        {item.label}
                                    </span>
                                    <span className={`h-1 w-1 rounded-full transition-colors ${isActive ? 'bg-rose-400' : 'bg-transparent'}`} />
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className={`md:hidden ${useInlineMobileBottomSpacing ? 'h-0' : 'h-[90px]'}`} />

            {showLogoutModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gradient-to-br from-black/30 to-black/10 backdrop-blur-md">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all">
                        <div className="h-1.5 bg-gradient-to-r from-rose-400 via-pink-400 to-rose-400"></div>

                        <div className="p-8 text-center">
                            <div className="relative w-24 h-24 mx-auto mb-5">
                                <div className="absolute inset-0 bg-gradient-to-br from-rose-100 to-pink-100 rounded-full blur-xl opacity-60"></div>
                                <div className="relative w-24 h-24 bg-gradient-to-br from-rose-50 to-pink-50 rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                                    <svg className="w-12 h-12 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                </div>
                            </div>

                            <h3 className="text-2xl font-bold text-gray-900 mb-2">Đăng xuất</h3>
                            <p className="text-sm text-gray-500 mb-8 leading-relaxed">
                                Bạn có chắc chắn muốn đăng xuất khỏi<br />tài khoản của mình?
                            </p>

                            <div className="space-y-3">
                                <button
                                    type="button"
                                    onClick={handleConfirmLogout}
                                    className="w-full h-12 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white text-sm font-semibold shadow-lg shadow-rose-200 hover:shadow-xl hover:shadow-rose-300 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                                >
                                    Đồng ý, đăng xuất
                                </button>

                                <button
                                    type="button"
                                    onClick={handleCancelLogout}
                                    className="w-full h-12 rounded-full bg-gray-50 text-gray-700 text-sm font-semibold hover:bg-gray-100 active:scale-[0.98] transition-all duration-200"
                                >
                                    Ở lại
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Navbar;
