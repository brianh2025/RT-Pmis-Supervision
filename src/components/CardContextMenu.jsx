import React, { useEffect, useRef } from 'react';
import { Star, Trash2 } from 'lucide-react';
import './CardContextMenu.css';

export function CardContextMenu({ x, y, project, onClose, onToggleStar, onDelete }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClick = () => onClose();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [onClose]);

  // 確保選單不超出視窗邊界
  const adjustedX = Math.min(x, window.innerWidth - 160);
  const adjustedY = Math.min(y, window.innerHeight - 100);

  return (
    <div
      ref={menuRef}
      className="card-ctx-menu"
      style={{ left: adjustedX, top: adjustedY }}
      onClick={e => e.stopPropagation()}
    >
      <button
        className="card-ctx-item"
        onClick={() => { onToggleStar(); onClose(); }}
      >
        <Star size={13} fill={project.is_starred ? '#f59e0b' : 'none'} color={project.is_starred ? '#f59e0b' : undefined} />
        {project.is_starred ? '取消我的最愛' : '設為我的最愛'}
      </button>
      <div className="card-ctx-divider" />
      <button
        className="card-ctx-item danger"
        onClick={() => { onDelete(); onClose(); }}
      >
        <Trash2 size={13} />
        刪除工程
      </button>
    </div>
  );
}
