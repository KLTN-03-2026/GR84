import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const InterestsTab = ({
  selectedInterests,
  setSelectedInterests,
  popularTags,
  newTagInput,
  setNewTagInput,
  error,
  setError,
  blinkingTag,
  setBlinkingTag,
  maxInterests = 15,
  hasUnsavedChanges,
  loading,
  success,
  handleSubmit,
  onCancel
}) => {
  const CARD = { background: '#fff', borderRadius: 16, border: '1px solid #fce7f3', boxShadow: '0 2px 12px rgba(244,63,94,0.06)' };
  const INPUT = {
    width: '100%', padding: '10px 14px', borderRadius: 12,
    border: '1.5px solid #fce7f3', fontSize: 13, color: '#374151',
    background: '#fff9fb', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color .2s',
  };

  const isMaxReached = selectedInterests.length >= maxInterests;
  const isInputEmpty = !newTagInput.trim();

  // AC04: Handle duplicate detection with case-insensitive comparison
  const handleAddCustomTag = (e) => {
    e.preventDefault();
    const tag = newTagInput.trim();
    
    // AC03: Empty input validation
    if (!tag) return;

    // AC04: Duplicate detection (case-insensitive)
    const existingTag = selectedInterests.find(t => t.toLowerCase() === tag.toLowerCase());
    if (existingTag) {
      setNewTagInput(''); // Clear input
      setBlinkingTag(existingTag); // Trigger blink effect
      setTimeout(() => setBlinkingTag(null), 1000); // Remove blink after 1s
      return;
    }

    // AC08: Maximum limit check
    if (selectedInterests.length >= maxInterests) {
      setError(`Bạn đã đạt giới hạn ${maxInterests} sở thích.`);
      return;
    }

    // AC02: Add new tag
    setSelectedInterests([...selectedInterests, tag]);
    setNewTagInput(''); // Clear input
    setError(''); // Clear any errors
  };

  // AC05: Delete tag operation
  const handleDeleteTag = (tagToDelete) => {
    setSelectedInterests(selectedInterests.filter(t => t !== tagToDelete));
    setError(''); // Clear max limit error when deleting
  };

  // Handle clicking on popular tags
  const handleToggleTag = (tag) => {
    if (selectedInterests.includes(tag)) {
      handleDeleteTag(tag);
    } else {
      if (selectedInterests.length >= maxInterests) {
        setError(`Bạn đã đạt giới hạn ${maxInterests} sở thích.`);
        return;
      }
      setSelectedInterests([...selectedInterests, tag]);
      setError('');
    }
  };

  const predefinedTags = popularTags || ['Thể thao', 'Game', 'Leo núi', 'Chụp ảnh', 'Đọc sách', 'Cà phê', 'Thú cưng', 'Vẽ tranh', 'Tình nguyện'];

  return (
    <div className="flex-1 flex flex-col gap-4 min-w-0 w-full">
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: '0 0 4px' }}>
          Sở thích & Đam mê
        </h1>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
          Thêm các sở thích để tìm kiếm những người có cùng điểm chung 💕
        </p>
      </div>

      <div style={{ ...CARD, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Selected Interests Section */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: '0 0 12px' }}>
            Đã chọn ({selectedInterests.length}/{maxInterests})
          </h2>
          <div className="flex flex-wrap gap-2">
            {selectedInterests.length === 0 ? (
              <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Chưa có sở thích nào được chọn.</p>
            ) : (
              selectedInterests.map(tag => (
                <span 
                  key={tag}
                  className={blinkingTag === tag ? 'blink-red' : ''}
                  style={{
                    padding: '6px 14px', borderRadius: 20, background: 'linear-gradient(135deg,#fb7185,#f43f5e)',
                    color: '#fff', fontSize: 13, fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 6px rgba(244,63,94,0.3)',
                    transition: 'all 0.3s'
                  }}>
                  {tag}
                  <span 
                    onClick={() => handleDeleteTag(tag)}
                    style={{ 
                      fontSize: 10, 
                      opacity: 0.8, 
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: '50%',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
                  >
                    ✕
                  </span>
                </span>
              ))
            )}
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #fce7f3', margin: '4px 0' }} />

        {/* Add Custom Interest Section */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: '0 0 12px' }}>Thêm sở thích</h2>
          <form onSubmit={handleAddCustomTag} className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input 
                style={{ 
                  ...INPUT,
                  flex: 1,
                  opacity: isMaxReached ? 0.5 : 1,
                  cursor: isMaxReached ? 'not-allowed' : 'text'
                }}
                placeholder={isMaxReached ? `Đã đạt giới hạn ${maxInterests} sở thích` : "Nhập sở thích và ấn Enter..."}
                value={newTagInput}
                onChange={e => setNewTagInput(e.target.value)}
                onFocus={e => !isMaxReached && (e.target.style.borderColor = '#f43f5e')}
                onBlur={e => e.target.style.borderColor = '#fce7f3'}
                disabled={isMaxReached}
              />
              <button 
                type="submit"
                disabled={isInputEmpty || isMaxReached}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  border: 'none',
                  background: (!isInputEmpty && !isMaxReached) ? 'linear-gradient(135deg,#fb7185,#f43f5e)' : '#fce7f3',
                  color: (!isInputEmpty && !isMaxReached) ? '#fff' : '#9ca3af',
                  fontSize: 20,
                  fontWeight: 700,
                  cursor: (!isInputEmpty && !isMaxReached) ? 'pointer' : 'not-allowed',
                  transition: 'all .2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: (!isInputEmpty && !isMaxReached) ? '0 2px 8px rgba(244,63,94,0.3)' : 'none'
                }}
                onMouseEnter={e => {
                  if (!isInputEmpty && !isMaxReached) {
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                +
              </button>
            </div>
            
            {/* AC08: Max limit warning */}
            {isMaxReached && (
              <div style={{ 
                padding: '8px 12px', 
                background: '#fff5f5', 
                border: '1.5px solid #fecaca', 
                borderRadius: 10, 
                fontSize: 11, 
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                <span>⚠️</span>
                <span>Bạn đã đạt giới hạn {maxInterests} sở thích. Xóa một sở thích để thêm mới.</span>
              </div>
            )}

            {/* Cancel and Save buttons - show when there are unsaved changes */}
            {hasUnsavedChanges && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={loading}
                  style={{
                    padding: '10px 24px', 
                    borderRadius: 28, 
                    border: '1.5px solid #fca5a5',
                    background: '#fff', 
                    color: '#f43f5e', 
                    fontSize: 13, 
                    fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'all .2s',
                    opacity: loading ? 0.5 : 1
                  }}>
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{
                    padding: '10px 28px', 
                    borderRadius: 28, 
                    border: 'none',
                    background: loading ? '#fca5a5' : 'linear-gradient(135deg,#fb7185,#f43f5e)',
                    color: '#fff', 
                    fontSize: 13, 
                    fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: loading ? 'none' : '0 6px 20px rgba(244,63,94,0.35)',
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: 8,
                    transition: 'all .2s',
                  }}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.9'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                >
                  {loading ? '⏳ Đang lưu...' : '✅ Lưu thay đổi'}
                </button>
              </div>
            )}
          </form>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #fce7f3', margin: '4px 0' }} />

        {/* Popular Tags Section */}
        <div>
           <h2 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: '0 0 12px' }}>Gợi ý phổ biến</h2>
           <div className="flex flex-wrap gap-2">
            {predefinedTags.filter(t => !selectedInterests.some(si => si.toLowerCase() === t.toLowerCase())).map(tag => (
              <span 
                key={tag} 
                onClick={() => handleToggleTag(tag)}
                style={{
                  padding: '6px 14px', borderRadius: 20, border: '1.5px solid #fce7f3',
                  background: '#fff9fb', color: '#f43f5e', fontSize: 13, fontWeight: 600,
                  cursor: isMaxReached ? 'not-allowed' : 'pointer', 
                  transition: 'all .2s',
                  opacity: isMaxReached ? 0.5 : 1
                }}
                onMouseEnter={e => { 
                  if (!isMaxReached) {
                    e.currentTarget.style.background = '#fdf2f8'; 
                    e.currentTarget.style.borderColor = '#fbcfe8'; 
                  }
                }}
                onMouseLeave={e => { 
                  e.currentTarget.style.background = '#fff9fb'; 
                  e.currentTarget.style.borderColor = '#fce7f3'; 
                }}
              >
                + {tag}
              </span>
            ))}
           </div>
        </div>

        {/* Error message */}
        {error && (
          <div style={{ 
            padding: '10px 14px', 
            background: '#fff5f5', 
            border: '1.5px solid #fecaca', 
            borderRadius: 12, 
            fontSize: 12, 
            color: '#ef4444',
            marginTop: 8
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Success message */}
        {success && (
          <div style={{ 
            padding: '10px 14px', 
            background: '#f0fdf4', 
            border: '1.5px solid #bbf7d0', 
            borderRadius: 12, 
            fontSize: 12, 
            color: '#16a34a',
            marginTop: 8
          }}>
            ✅ {success}
          </div>
        )}
      </div>

      {/* Add CSS for blink animation */}
      <style>{`
        @keyframes blinkRed {
          0%, 100% { 
            box-shadow: 0 2px 6px rgba(244,63,94,0.3);
            transform: scale(1);
          }
          25% { 
            box-shadow: 0 0 20px rgba(239,68,68,0.8), 0 0 40px rgba(239,68,68,0.4);
            transform: scale(1.05);
          }
          50% { 
            box-shadow: 0 2px 6px rgba(244,63,94,0.3);
            transform: scale(1);
          }
          75% { 
            box-shadow: 0 0 20px rgba(239,68,68,0.8), 0 0 40px rgba(239,68,68,0.4);
            transform: scale(1.05);
          }
        }
        .blink-red {
          animation: blinkRed 1s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default InterestsTab;
