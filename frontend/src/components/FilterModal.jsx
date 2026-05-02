import { useState, useEffect } from 'react';

// Common predefined interests for auto-suggest
const PREDEFINED_INTERESTS = [
  'Du lịch', 'Âm nhạc', 'Nấu ăn', 'Thể thao', 'Đọc sách',
  'Xem phim', 'Cà phê', 'Thú cưng', 'Nhiếp ảnh', 'Nghệ thuật'
];

const FilterModal = ({ isOpen, onClose, onApply, initialFilters }) => {
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(50);
  const [gender, setGender] = useState('both');
  const [distance, setDistance] = useState(25);
  const [interests, setInterests] = useState([]);
  const [interestInput, setInterestInput] = useState('');

  // Sync initial filters when modal opens
  useEffect(() => {
    if (isOpen && initialFilters) {
      setMinAge(initialFilters.minAge || 18);
      setMaxAge(initialFilters.maxAge || 50);
      setGender(initialFilters.gender || 'both');
      setDistance(initialFilters.maxDistance || 25);
      setInterests(initialFilters.interests || []);
      setInterestInput('');
    }
  }, [isOpen, initialFilters]);

  if (!isOpen) return null;

  const handleApply = () => {
    onApply({
      minAge,
      maxAge,
      gender,
      maxDistance: distance,
      interests
    });
    onClose();
  };

  const handleReset = () => {
    setMinAge(18);
    setMaxAge(50);
    setGender('both');
    setDistance(25);
    setInterests([]);
  };

  const toggleInterest = (tag) => {
    if (interests.includes(tag)) {
      setInterests(interests.filter(i => i !== tag));
    } else {
      setInterests([...interests, tag]);
    }
  };

  const addInterestFromInput = () => {
    const val = interestInput.trim();
    if (val && !interests.includes(val)) {
      setInterests([...interests, val]);
      setInterestInput('');
    }
  };

  // Prevent min > max
  const handleMinAgeChange = (e) => {
    const val = parseInt(e.target.value);
    if (val <= maxAge) setMinAge(val);
  };

  const handleMaxAgeChange = (e) => {
    const val = parseInt(e.target.value);
    if (val >= minAge) setMaxAge(val);
  };

  const filteredSuggestions = PREDEFINED_INTERESTS.filter(i => 
    i.toLowerCase().includes(interestInput.toLowerCase()) && !interests.includes(i)
  );

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 transition-opacity duration-300" onClick={onClose}>
      <style>{`
        @keyframes slideUpSheet {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-sheet {
          animation: slideUpSheet 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @media (min-width: 640px) {
          .animate-sheet {
            animation: fadeSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        }
        /* Custom scrollbar for webkit */
        .filter-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .filter-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .filter-scroll::-webkit-scrollbar-thumb {
          background-color: #fce7f3; /* rose-100 */
          border-radius: 20px;
        }
      `}</style>
      
      <div 
        className="bg-[#FFF9FA] w-full sm:max-w-[420px] rounded-t-[2.5rem] sm:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-sheet"
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-3 sm:hidden shrink-0"></div>

        {/* Header */}
        <div className="px-6 pt-4 sm:pt-6 pb-4 flex justify-between items-center shrink-0 border-b border-rose-50/50 bg-[#FFF9FA] z-10 relative">
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">Bộ lọc tìm kiếm</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-rose-100 hover:text-rose-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1 min-h-0 filter-scroll space-y-7 relative z-0">
          
          {/* Age Range */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50">
            <div className="flex justify-between items-end mb-4">
              <span className="text-[15px] font-bold text-gray-800 flex items-center gap-2">
                <span className="text-rose-500">🎂</span> Độ tuổi
              </span>
              <span className="text-[15px] font-extrabold text-rose-600 bg-rose-50 px-3 py-1 rounded-full">{minAge} - {maxAge}</span>
            </div>
            
            <div className="flex items-center gap-4 mt-2">
              <div className="flex-1 space-y-2">
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Tối thiểu</div>
                <input 
                  type="range" min="18" max="100" value={minAge} onChange={handleMinAgeChange}
                  className="w-full accent-rose-500 h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer hover:bg-rose-100 transition-colors"
                />
              </div>
              <div className="flex-1 space-y-2">
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Tối đa</div>
                <input 
                  type="range" min="18" max="100" value={maxAge} onChange={handleMaxAgeChange}
                  className="w-full accent-rose-500 h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer hover:bg-rose-100 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Gender */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50">
            <span className="text-[15px] font-bold text-gray-800 flex items-center gap-2 mb-4">
               <span className="text-indigo-500">⚧</span> Giới tính
            </span>
            <div className="flex justify-center gap-3 sm:gap-5">
              <button 
                onClick={() => setGender('male')}
                className={`w-[80px] h-[80px] sm:w-[90px] sm:h-[90px] rounded-[1.5rem] flex flex-col items-center justify-center gap-2 transition-all duration-300 ${gender === 'male' ? 'ring-2 ring-blue-500 bg-blue-50 text-blue-600 shadow-md scale-105' : 'bg-gray-50 border border-gray-100 text-gray-500 hover:bg-gray-100'}`}
              >
                <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" style={{transform: "rotate(45deg)", transformOrigin: "center"}} /><circle cx="10" cy="14" r="5" /></svg>
                <span className="text-[12px] font-bold">Nam</span>
              </button>

              <button 
                onClick={() => setGender('female')}
                className={`w-[80px] h-[80px] sm:w-[90px] sm:h-[90px] rounded-[1.5rem] flex flex-col items-center justify-center gap-2 transition-all duration-300 ${gender === 'female' ? 'ring-2 ring-pink-500 bg-pink-50 text-pink-600 shadow-md scale-105' : 'bg-gray-50 border border-gray-100 text-gray-500 hover:bg-gray-100'}`}
              >
                <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="10" r="5" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v7m-3-3h6" /></svg>
                <span className="text-[12px] font-bold">Nữ</span>
              </button>

              <button 
                onClick={() => setGender('both')}
                className={`w-[80px] h-[80px] sm:w-[90px] sm:h-[90px] rounded-[1.5rem] flex flex-col items-center justify-center gap-2 transition-all duration-300 ${gender === 'both' ? 'ring-2 ring-purple-500 bg-purple-50 text-purple-600 shadow-md scale-105' : 'bg-gray-50 border border-gray-100 text-gray-500 hover:bg-gray-100'}`}
              >
                <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                <span className="text-[12px] font-bold">Cả hai</span>
              </button>
            </div>
          </div>

          {/* Distance */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50">
            <div className="flex justify-between items-end mb-4">
              <span className="text-[15px] font-bold text-gray-800 flex items-center gap-2">
                 <span className="text-emerald-500">📍</span> Khoảng cách
              </span>
              <span className="text-[15px] font-extrabold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">{distance} km</span>
            </div>
            <input 
              type="range" min="1" max="100" value={distance} onChange={e => setDistance(parseInt(e.target.value))}
              className="w-full accent-emerald-500 h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer hover:bg-emerald-100 transition-colors"
            />
            <div className="flex justify-between text-[11px] font-bold text-gray-400 mt-2">
              <span>Gần (1km)</span>
              <span>Xa (100km)</span>
            </div>
          </div>

          {/* Interests */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50">
            <span className="text-[15px] font-bold text-gray-800 flex items-center gap-2 mb-3">
               <span className="text-amber-500">⭐</span> Sở thích
            </span>
            
            {/* Selected Tags */}
            <div className="flex flex-wrap gap-2 mb-3">
              {interests.map(tag => (
                <span key={tag} className="bg-rose-600 text-white px-3 py-1.5 rounded-[1rem] text-[13px] font-bold flex items-center gap-1.5 shadow-sm">
                  {tag}
                  <button onClick={() => toggleInterest(tag)} className="hover:text-rose-200 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </span>
              ))}
            </div>

            {/* Auto-suggest Tags */}
            {interests.length === 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {PREDEFINED_INTERESTS.slice(0, 4).map(tag => (
                  <button 
                    key={tag}
                    onClick={() => toggleInterest(tag)}
                    className="bg-gray-100 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-[1rem] text-[12px] font-bold hover:bg-gray-200 hover:text-gray-800 transition-colors"
                  >
                    {tag} +
                  </button>
                ))}
              </div>
            )}

            {/* Input field */}
            <div className="flex gap-2 relative mt-2">
              <input 
                type="text" 
                value={interestInput}
                onChange={e => setInterestInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addInterestFromInput()}
                placeholder="Thêm sở thích..."
                className="flex-1 bg-gray-50 border border-gray-200 rounded-[1.2rem] px-4 py-3 text-[14px] focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all font-medium text-gray-700"
              />
              <button 
                onClick={addInterestFromInput}
                className="w-12 h-12 rounded-[1.2rem] bg-rose-100 text-rose-500 flex items-center justify-center font-bold text-2xl hover:bg-rose-200 shrink-0 transition-colors"
              >
                +
              </button>
            </div>
            
            {/* Suggestions Dropdown */}
            {interestInput && filteredSuggestions.length > 0 && (
              <div className="mt-2 bg-white border border-gray-100 rounded-[1.2rem] shadow-lg p-3 flex flex-wrap gap-2 relative z-10">
                {filteredSuggestions.map(tag => (
                  <button 
                    key={tag}
                    onClick={() => {
                      toggleInterest(tag);
                      setInterestInput('');
                    }}
                    className="bg-gray-50 border border-gray-100 text-gray-700 px-3 py-1.5 rounded-[1rem] text-[12px] font-bold hover:bg-gray-100 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-5 sm:py-6 pb-8 sm:pb-6 shrink-0 flex flex-col gap-3 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] relative z-20">
          <button 
            onClick={handleApply}
            className="w-full bg-[#E11D48] text-white font-extrabold text-[15px] sm:text-[16px] py-4 rounded-[1.5rem] shadow-[0_4px_14px_rgba(225,29,72,0.3)] hover:bg-rose-700 hover:shadow-[0_6px_20px_rgba(225,29,72,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Áp dụng bộ lọc
          </button>
          <button 
            onClick={handleReset}
            className="w-full text-gray-400 font-bold py-2 text-[14px] hover:text-gray-600 transition-colors"
          >
            Đặt lại mặc định
          </button>
        </div>

      </div>
    </div>
  );
};

export default FilterModal;
