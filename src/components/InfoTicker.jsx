import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import './InfoTicker.css';

export function InfoTicker({ items, onDismiss }) {
  const [idx,     setIdx]     = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    setIdx(0);
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => {
      setExiting(true);
      setTimeout(() => {
        setIdx(prev => (prev + 1) % items.length);
        setExiting(false);
      }, 300);
    }, 5000);
    return () => clearInterval(t);
  }, [items.length]);

  if (!items.length) return null;
  const item = items[idx % items.length];

  return (
    <div className={`info-ticker ticker-${item.type}`}>
      <div key={idx} className={`ticker-body${exiting ? ' ticker-exit' : ' ticker-enter'}`}>
        <span className="ticker-icon">{item.icon}</span>
        <span className="ticker-msg">{item.message}</span>
      </div>
      <div className="ticker-side">
        {items.length > 1 && (
          <div className="ticker-dots">
            {items.map((_, i) => (
              <span key={i} className={`ticker-dot${i === idx % items.length ? ' on' : ''}`} />
            ))}
          </div>
        )}
        {item.dismissible && onDismiss && (
          <button className="ticker-dismiss" onClick={() => onDismiss(item.key)} title="關閉">
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
