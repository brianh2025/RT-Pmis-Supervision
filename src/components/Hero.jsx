import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, ShieldAlert } from 'lucide-react';
import { ParticleCanvas } from './ParticleCanvas';
import './Hero.css';

export function Hero() {
  const navigate = useNavigate();
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 769px)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 769px)');
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <section className="hero-section">
      <div className="hero-background">
        <div className="grid-overlay"></div>
        {isDesktop && <ParticleCanvas />}
        <div className="glow-orb orb-1"></div>
        <div className="glow-orb orb-2"></div>
      </div>
      
      <div className="hero-container">
        {/* Main Portal Card */}
        <div className="portal-card glass-panel animate-slide-up delay-200">
          <div className="portal-header">
            <div className="header-icon-ring delay-300">
               <ShieldAlert className="portal-icon" size={36} />
            </div>
            <h1 className="portal-title">專案監造管理系統</h1>
            <p className="portal-subtitle">PUBLIC CONSTRUCTION PMIS PORTAL</p>
          </div>

          <div className="portal-info animate-fade-in delay-400">
            {/* Dual Language Rows */}
            <div className="info-row">
              <div className="info-label-group">
                <span className="info-label-en">OPERATION ZONE</span>
                <span className="info-label-zh">營運區域</span>
              </div>
              <span className="info-value highlighted">雲林轄區 (Yunlin)</span>
            </div>
            
            <div className="info-row">
              <div className="info-label-group">
                <span className="info-label-en">ACTIVE PROJECTS</span>
                <span className="info-label-zh">執行中專案</span>
              </div>
              <span className="info-value">03</span>
            </div>
            
            <div className="info-row">
              <div className="info-label-group">
                <span className="info-label-en">NETWORK STATUS</span>
              </div>
              <span className="info-value success">
                <span className="success-dot-pulse">
                  <span className="success-dot-core"></span>
                  <span className="success-dot-ring"></span>
                  <span className="success-dot-ring ring2"></span>
                </span>
                SECURE
              </span>
            </div>
          </div>

          <div className="portal-actions animate-fade-in delay-500">
            <button 
              className="btn btn-login btn-block interactive-scale"
              onClick={() => navigate('/login')}
            >
              <span className="btn-glow-effect"></span>
              <Lock size={20} className="icon-left" />
              <span className="btn-text">
                <span className="btn-text-zh">進入系統</span>
                <span className="btn-text-en">Secure Login</span>
              </span>
              <ArrowRight size={20} className="icon-right" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
