import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Lock, Mail, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Login.css';

function mapAuthError(message) {
  if (!message) return '登入失敗，請稍後再試。';
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) return '電子郵件或密碼不正確。';
  if (m.includes('email not confirmed')) return '電子郵件尚未驗證，請查收確認信。';
  if (m.includes('too many requests') || m.includes('rate limit')) return '嘗試次數過多，請稍後再試。';
  if (m.includes('user not found')) return '找不到此帳號，請確認電子郵件。';
  return `登入失敗：${message}`;
}

export function Login() {
  const navigate = useNavigate();
  const { user, loading, signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true });
  }, [user, loading, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    const { error } = await signIn(email, password);
    if (error) {
      setErrorMsg(mapAuthError(error.message));
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setErrorMsg('');
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setErrorMsg(mapAuthError(error.message));
      setGoogleLoading(false);
    }
  };

  return (
    <div className="lg-page">
      <main className="lg-card animate-slide-up">
        <div className="lg-brand">
          <span className="lg-brand-icon"><ClipboardCheck size={24} /></span>
          <div>
            <h1 className="lg-title">提送管制</h1>
            <p className="lg-subtitle">施工日誌與監造月報跨工程檢核</p>
          </div>
        </div>

        <button
          type="button"
          className="lg-google-btn"
          onClick={handleGoogle}
          disabled={googleLoading || submitting}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span>{googleLoading ? '導向 Google…' : '使用 Google 帳號登入'}</span>
        </button>

        <div className="lg-divider"><span>或使用電子郵件</span></div>

        <form className="lg-form" onSubmit={handleLogin}>
          <label className="lg-field">
            <span className="lg-label">電子郵件</span>
            <span className="lg-input-wrap">
              <Mail size={16} className="lg-input-icon" />
              <input
                type="email"
                className="lg-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="username"
                required
              />
            </span>
          </label>

          <label className="lg-field">
            <span className="lg-label">密碼</span>
            <span className="lg-input-wrap">
              <Lock size={16} className="lg-input-icon" />
              <input
                type="password"
                className="lg-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </span>
          </label>

          {errorMsg && <div className="lg-error" role="alert">{errorMsg}</div>}

          <button type="submit" className="lg-submit" disabled={submitting || googleLoading}>
            {submitting ? <Loader2 size={15} className="animate-spin" /> : null}
            {submitting ? '驗證中…' : '登入'}
          </button>
        </form>

        <p className="lg-note">帳號與 RT-PMIS 監造管理系統共用。</p>
      </main>
    </div>
  );
}
