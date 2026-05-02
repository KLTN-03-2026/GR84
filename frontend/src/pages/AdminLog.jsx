import React, { useState, useEffect, useCallback, useRef } from 'react';
import AdminLayout from '../components/AdminLayout';
import { adminLogService } from '../services/api';

const Icons = {
    ChevronDown: (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m6 9 6 6 6-6" /></svg>
    ),
    Download: (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
    ),
    ChevronLeft: (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m15 18-6-6 6-6" /></svg>
    ),
    ChevronRight: (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m9 18 6-6-6-6" /></svg>
    ),
    Search: (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
    ),
    Refresh: (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
    ),
    Filter: (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
    ),
    ActionLogin: (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" /></svg>
    ),
    ActionBan: (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>
    ),
    ActionRefresh: (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
    ),
    ActionTrash: (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
    ),
    ActionDefault: (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
    ),
    CheckCircleBadge: (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
    )
};

const getActionIcon = (actionStr) => {
    const act = (actionStr || '').toLowerCase();
    if (act.includes('đăng nhập')) return <Icons.ActionLogin className="text-gray-400" />;
    if (act.includes('khóa')) return <Icons.ActionBan className="text-[#E53258]" />;
    if (act.includes('xóa')) return <Icons.ActionTrash className="text-[#E53258]" />;
    if (act.includes('cập nhật')) return <Icons.ActionRefresh className="text-[#E53258]" />;
    return <Icons.ActionDefault className="text-gray-400" />;
};

export default function AdminLog() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    // Filter states (applied)
    const [search, setSearch] = useState('');
    const [action, setAction] = useState('');
    const [status, setStatus] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Temp inputs for filter bar
    const [tempSearch, setTempSearch] = useState('');
    const [tempAction, setTempAction] = useState('');
    const [tempStatus, setTempStatus] = useState('');
    const [tempStartDate, setTempStartDate] = useState('');
    const [tempEndDate, setTempEndDate] = useState('');

    const [showExport, setShowExport] = useState(false);
    const exportRef = useRef();

    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true);
            try {
                const res = await adminLogService.getLogs({ page, limit, search, action, status, startDate, endDate });
                if (res.success) {
                    setLogs(res.data);
                    setTotal(res.pagination.total);
                    setTotalPages(res.pagination.pages);
                }
            } catch (error) {
                console.error("Failed to fetch logs", error);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, [page, limit, search, action, status, startDate, endDate]);

    // Handle click outside for export dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (exportRef.current && !exportRef.current.contains(event.target)) {
                setShowExport(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleApply = () => {
        setSearch(tempSearch);
        setAction(tempAction);
        setStatus(tempStatus);
        setStartDate(tempStartDate);
        setEndDate(tempEndDate);
        setPage(1);
    };

    const handleReset = () => {
        setTempSearch('');
        setTempAction('');
        setTempStatus('');
        setTempStartDate('');
        setTempEndDate('');
        setSearch('');
        setAction('');
        setStatus('');
        setStartDate('');
        setEndDate('');
        setPage(1);
    };

    const handleExport = async (type) => {
        try {
            const params = { search, action, status, startDate, endDate };
            const res = type === 'excel' ? await adminLogService.exportExcel(params) : await adminLogService.exportPdf(params);

            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `admin-logs.${type === 'excel' ? 'xlsx' : 'pdf'}`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setShowExport(false);
        } catch (e) {
            alert('Lỗi xuất báo cáo');
        }
    };

    const formatDateObj = (isoString) => {
        if (!isoString) return { date: '', time: '' };
        const d = new Date(isoString);
        return {
            date: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            time: d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };
    };

    return (
        <AdminLayout title="Nhật ký hệ thống" noPadding={true}>
            <div className="flex flex-col h-full bg-[#FAFAFA] relative min-h-screen">
                <div className="p-10 max-w-7xl mx-auto w-full">

                    {/* Header */}
                    <div className="flex justify-between items-start mb-8">
                        <div>

                            <p className="text-[14px] text-gray-500 font-medium">Theo dõi và quản lý mọi hoạt động thao tác của quản trị viên.</p>
                        </div>
                        <div className="relative" ref={exportRef}>
                            <button onClick={() => setShowExport(!showExport)} className="bg-[#E53258] hover:bg-[#D42247] text-white px-6 py-3 rounded-full font-bold transition-all text-[14px] flex items-center gap-2 shadow-lg shadow-rose-200">
                                <Icons.Download className="w-4 h-4" />
                                Xuất báo cáo
                                <Icons.ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showExport ? 'rotate-180' : ''}`} />
                            </button>
                            {showExport && (
                                <div className="absolute right-0 top-14 bg-white rounded-2xl shadow-[0_10px_40px_rgb(0,0,0,0.1)] border border-gray-100 py-2 w-52 z-50 overflow-hidden">
                                    <button onClick={() => handleExport('excel')} className="w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors text-[14px] font-bold text-gray-700">Xuất file Excel (.xlsx)</button>
                                    <button onClick={() => handleExport('pdf')} className="w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors text-[14px] font-bold text-gray-700">Xuất file PDF (.pdf)</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Filters Bar */}
                    <div className="bg-[#FCF5F6] rounded-[32px] p-8 mb-8">
                        <div className="flex flex-wrap items-end gap-6">
                            <div className="flex-1 min-w-[220px]">
                                <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest mb-3 pl-2">TÌM KIẾM</label>
                                <div className="relative">
                                    <Icons.Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input
                                        type="text"
                                        placeholder="Tìm tên admin hoặc ID"
                                        value={tempSearch}
                                        onChange={(e) => setTempSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                                        className="w-full bg-white border-0 rounded-full pl-12 pr-5 py-3.5 font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#E53258]/20 shadow-sm text-[14px]"
                                    />
                                </div>
                            </div>
                            <div className="w-[200px]">
                                <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest mb-3 pl-2">LOẠI THAO TÁC</label>
                                <div className="relative">
                                    <select
                                        value={tempAction}
                                        onChange={(e) => setTempAction(e.target.value)}
                                        className="appearance-none w-full bg-white border-0 rounded-full pl-5 pr-10 py-3.5 font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#E53258]/20 shadow-sm text-[14px] cursor-pointer"
                                    >
                                        <option value="">Tất cả thao tác</option>
                                        <option value="Đăng nhập">Đăng nhập</option>
                                        <option value="Khóa tài khoản">Khóa tài khoản</option>
                                        <option value="Cập nhật">Cập nhật</option>
                                        <option value="Xóa">Xóa</option>
                                    </select>
                                    <Icons.ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none w-4 h-4" />
                                </div>
                            </div>
                            <div className="w-[180px]">
                                <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest mb-3 pl-2">TRẠNG THÁI</label>
                                <div className="relative">
                                    <select
                                        value={tempStatus}
                                        onChange={(e) => setTempStatus(e.target.value)}
                                        className="appearance-none w-full bg-white border-0 rounded-full pl-5 pr-10 py-3.5 font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#E53258]/20 shadow-sm text-[14px] cursor-pointer"
                                    >
                                        <option value="">Tất cả trạng thái</option>
                                        <option value="Thành công">Thành công</option>
                                        <option value="Thất bại">Thất bại</option>
                                    </select>
                                    <Icons.ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none w-4 h-4" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest mb-3 pl-2">KHOẢNG THỜI GIAN</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        value={tempStartDate}
                                        onChange={(e) => setTempStartDate(e.target.value)}
                                        className="bg-white border-0 rounded-full px-5 py-3.5 font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#E53258]/20 shadow-sm text-[14px] cursor-pointer"
                                    />
                                    <span className="text-gray-500 text-[14px] font-medium mx-1">đến</span>
                                    <input
                                        type="date"
                                        value={tempEndDate}
                                        onChange={(e) => setTempEndDate(e.target.value)}
                                        className="bg-white border-0 rounded-full px-5 py-3.5 font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#E53258]/20 shadow-sm text-[14px] cursor-pointer"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-3 ml-auto">
                                <button onClick={handleReset} className="bg-[#59667C] hover:bg-[#475569] text-white px-6 py-3.5 rounded-full font-bold shadow-lg shadow-[#59667C]/30 transition-all text-[14px] flex items-center gap-2">
                                    <Icons.Refresh className="w-4 h-4" />
                                    Làm mới
                                </button>
                                <button onClick={handleApply} className="bg-[#B21C3A] hover:bg-[#90162f] text-white px-8 py-3.5 rounded-full font-bold shadow-lg shadow-rose-200/50 transition-all text-[14px] flex items-center gap-2">
                                    <Icons.Filter className="w-4 h-4" />
                                    Truy xuất
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Data Table */}
                    <div className="bg-white rounded-[32px] p-2 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-gray-100/50 mb-10 overflow-hidden">
                        <table className="w-full text-left border-collapse table-fixed mt-2">
                            <thead>
                                <tr>
                                    <th className="pb-6 pt-4 text-[11px] font-black tracking-widest text-[#A19D9F] uppercase w-[15%] pl-8">THỜI GIAN</th>
                                    <th className="pb-6 pt-4 text-[11px] font-black tracking-widest text-[#A19D9F] uppercase w-[15%]">TÁC NHÂN</th>
                                    <th className="pb-6 pt-4 text-[11px] font-black tracking-widest text-[#A19D9F] uppercase w-[15%]">CHỨC VỤ</th>
                                    <th className="pb-6 pt-4 text-[11px] font-black tracking-widest text-[#A19D9F] uppercase w-[15%]">THAO TÁC</th>
                                    <th className="pb-6 pt-4 text-[11px] font-black tracking-widest text-[#A19D9F] uppercase w-[12%] text-center">TRẠNG THÁI</th>
                                    <th className="pb-6 pt-4 text-[11px] font-black tracking-widest text-[#A19D9F] uppercase w-[13%] text-center">ĐỊA CHỈ IP</th>
                                    <th className="pb-6 pt-4 text-[11px] font-black tracking-widest text-[#A19D9F] uppercase w-[15%] pr-8">MÔ TẢ CHI TIẾT</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50/80">
                                {loading ? (
                                    <tr><td colSpan="7" className="py-12 text-center text-gray-400">Đang tải dữ liệu...</td></tr>
                                ) : logs.length === 0 ? (
                                    <tr><td colSpan="7" className="py-12 text-center text-gray-400">Không tìm thấy nhật ký nào.</td></tr>
                                ) : logs.map((log) => {
                                    const { date, time } = formatDateObj(log.createdAt);
                                    return (
                                        <tr key={log._id} className="hover:bg-[#FCFAFA] transition-colors group">
                                            <td className="py-5 pl-8">
                                                <div className="font-bold text-gray-900 text-[14px]">{date}</div>
                                                <div className="text-[12px] text-gray-500 font-medium mt-0.5">{time}</div>
                                            </td>
                                            <td className="py-5">
                                                <div className="font-bold text-gray-900 text-[14px] truncate" title={log.adminName}>{log.adminName}</div>
                                            </td>
                                            <td className="py-5">
                                                {log.adminRole === 'super_admin' ? (
                                                    <span className="inline-block px-3 py-1.5 bg-[#FFF0F3] text-[#E53258] text-[9px] font-black rounded-full uppercase tracking-widest whitespace-nowrap">QUẢN TRỊ VIÊN TỐI CAO</span>
                                                ) : (
                                                    <span className="inline-block px-3 py-1.5 bg-[#F1F5F9] text-[#64748B] text-[9px] font-black rounded-full uppercase tracking-widest whitespace-nowrap">QUẢN TRỊ VIÊN</span>
                                                )}
                                            </td>
                                            <td className="py-5">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-gray-400 flex-shrink-0">
                                                        {getActionIcon(log.action)}
                                                    </span>
                                                    <span className="font-bold text-gray-900 text-[13px] truncate" title={log.action}>{log.action}</span>
                                                </div>
                                            </td>
                                            <td className="py-5 text-center">
                                                {log.status === 'Thành công' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#E8FFF0] text-[#10B981] rounded-full text-[9px] font-black tracking-widest">
                                                        THÀNH CÔNG
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFF0F3] text-[#E53258] rounded-full text-[9px] font-black tracking-widest">
                                                        THẤT BẠI
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-5 text-center">
                                                <span className="font-mono text-[13px] text-gray-500 font-bold">{log.ipAddress}</span>
                                            </td>
                                            <td className="py-5 pr-8">
                                                <div className="text-[12px] text-gray-500 font-medium leading-relaxed max-w-[150px] line-clamp-2" title={log.description}>
                                                    {log.description}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        {totalPages > 0 && (
                            <div className="flex justify-between items-center mt-2 px-8 pb-4 pt-4 border-t border-gray-50">
                                <div className="flex items-center gap-3 text-[13px] text-gray-500 font-bold tracking-wide">
                                    <span>Hiển thị</span>
                                    <div className="relative">
                                        <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="appearance-none bg-white border border-gray-200 rounded-full pl-4 pr-8 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-100 cursor-pointer text-gray-700">
                                            <option value={10}>10 mục</option>
                                            <option value={20}>20 mục</option>
                                            <option value={50}>50 mục</option>
                                        </select>
                                        <Icons.ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none w-3 h-3" />
                                    </div>
                                    <span>trong tổng số {total} kết quả</span>
                                </div>

                                <div className="flex items-center gap-1">
                                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-30">
                                        <Icons.ChevronLeft />
                                    </button>

                                    {Array.from({ length: totalPages }).map((_, i) => {
                                        const p = i + 1;
                                        if (p < page - 1 || p > page + 1) {
                                            if (p === 1 || p === totalPages) {
                                                return (
                                                    <button key={p} onClick={() => setPage(p)} className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-gray-500 hover:bg-gray-100 transition-colors">
                                                        {p}
                                                    </button>
                                                )
                                            }
                                            if (p === page - 2 || p === page + 2) {
                                                return <span key={p} className="w-8 h-8 flex items-center justify-center font-bold text-gray-400">...</span>
                                            }
                                            return null;
                                        }
                                        return (
                                            <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors ${page === p ? 'bg-[#B21C3A] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}>
                                                {p}
                                            </button>
                                        )
                                    })}

                                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-30">
                                        <Icons.ChevronRight />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bottom Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">
                        {/* Red Card */}
                        <div className="bg-[#B21C3A] rounded-[32px] p-8 relative overflow-hidden text-white shadow-xl shadow-rose-900/10 h-[200px] flex flex-col justify-center">
                            <div className="absolute top-8 left-8 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                <Icons.CheckCircleBadge className="w-6 h-6 text-white" />
                            </div>
                            <div className="mt-8">
                                <div className="text-[11px] font-black uppercase tracking-widest text-white/80 mb-2">ĐĂNG NHẬP HÔM NAY</div>
                                <div className="text-[56px] font-black leading-none tracking-tight">42</div>
                            </div>
                        </div>

                        {/* Light Pink Card */}
                        <div className="bg-[#FCF5F6] rounded-[32px] p-8 relative overflow-hidden h-[200px] flex flex-col justify-center border border-[#FDE1E6]/50">
                            <div className="text-[11px] font-black uppercase tracking-widest text-[#E53258]/80 mb-3 z-10">CẢNH BÁO HỆ THỐNG</div>
                            <div className="text-[22px] font-black text-gray-900 leading-tight max-w-[300px] mb-6 z-10">
                                3 thao tác thất bại được ghi nhận trong 1 giờ qua.
                            </div>
                            <button className="bg-white text-[#E53258] px-6 py-2.5 rounded-full font-bold text-[13px] shadow-sm w-fit z-10 hover:shadow-md transition-shadow">
                                Kiểm tra ngay
                            </button>

                            <div className="absolute -right-6 -bottom-6 text-[#E53258]/10 w-48 h-48 pointer-events-none">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                                    <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </AdminLayout>
    );
}
