import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '60vh', gap: '12px', color: 'var(--color-text1)', padding: '24px',
        }}>
          <div style={{ fontSize: '32px' }}>⚠️</div>
          <div style={{ fontWeight: 600, fontSize: '16px' }}>此頁面發生錯誤</div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '13px', maxWidth: '400px', textAlign: 'center' }}>
            {this.state.error?.message || '未知錯誤'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: '8px', padding: '8px 20px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg2)', color: 'var(--color-text1)', cursor: 'pointer', fontSize: '13px' }}
          >
            重試
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
