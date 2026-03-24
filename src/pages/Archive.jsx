import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Archive as ArchiveIcon, ArrowLeft } from 'lucide-react';
import { useProject } from '../hooks/useProject';
import './Dashboard.css';

export function Archive() {
  const { id } = useParams();
  const { project, loading } = useProject(id);

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="dash-page-header">
        <h1 className="dash-title">歸檔管理</h1>
      </div>
      <div style={{ textAlign: 'center', padding: '64px 20px', background: 'var(--color-bg2)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
        <ArchiveIcon size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>歸檔管理功能建置中</h3>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px' }}>此模組預計於下一階段開放</p>
        <Link to={`/projects/${id}/dashboard`} className="btn-dash-action" style={{ display: 'inline-flex', background: 'var(--color-bg1)', color: 'var(--color-text1)', border: '1px solid var(--color-border)' }}>
          <ArrowLeft size={16} />
          <span>回儀表板</span>
        </Link>
      </div>
    </div>
  );
}
