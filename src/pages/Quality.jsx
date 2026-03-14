import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Construction, ArrowLeft } from 'lucide-react';
import { useProject } from '../hooks/useProject';
import './Dashboard.css';

export function Quality() {
  const { id } = useParams();
  const { project, loading } = useProject(id);

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '1rem', background: 'var(--color-bg2)', padding: '6px 16px', borderRadius: '10px', border: '1px solid var(--color-block-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-main)' }}>工程品質管理</span>
          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginLeft: '8px' }}>QUALITY CONTROL & ASSURANCE</span>
        </div>
      </div>
      <div style={{ marginTop: '32px', textAlign: 'center', padding: '64px 20px', background: 'var(--color-bg2)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
        <Construction size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>品管管理功能建置中</h3>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px' }}>此模組預計於下一階段開放</p>
        <Link to={`/projects/${id}/dashboard`} className="btn-dash-action" style={{ display: 'inline-flex', background: 'var(--color-bg1)', color: 'var(--color-text1)', border: '1px solid var(--color-border)' }}>
          <ArrowLeft size={16} />
          <span>回儀表板</span>
        </Link>
      </div>
    </div>
  );
}
