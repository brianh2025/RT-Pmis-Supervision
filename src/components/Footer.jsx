import React from 'react';
import { Shield } from 'lucide-react';
import './Footer.css';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer-section">
      <div className="footer-container">
        <div className="footer-bottom">
          <p className="copyright animate-fade-in delay-500">
            <Shield size={14} className="shield-icon" />
            <span>&copy; {currentYear} PMIS Cloud System. Yunlin Engineering Division.</span>
            <span className="divider desktop-only">|</span>
            <span className="made-with">Internal Portal Use Only.</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
