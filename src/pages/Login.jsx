import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Login.css';

/** Map Supabase error messages → bilingual user-friendly messages */
function mapAuthError(message) {
  if (!message) return '登入失敗，請稍後再試。(Login failed, please try again.)';
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) {
    return '電子郵件或密碼不正確。(Invalid email or password.)';
  }
  if (m.includes('email not confirmed')) {
    return '電子郵件尚未驗證，請查收確認信。(Email not confirmed.)';
  }
  if (m.includes('too many requests') || m.includes('rate limit')) {
    return '嘗試次數過多，請稍後再試。(Too many attempts.)';
  }
  if (m.includes('user not found')) {
    return '找不到此帳號，請確認電子郵件。(User not found.)';
  }
  return `登入失敗：${message}`;
}

export function Login() {
  const navigate = useNavigate();
  const { user, loading, signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);

  // If already authenticated, skip the login page
  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    const { error } = await signIn(email, password);

    if (error) {
      setErrorMsg(mapAuthError(error.message));
      setIsSubmitting(false);
    }
    // On success, the useEffect above handles the redirect via auth state change
  };

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setIsGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setErrorMsg(mapAuthError(error.message));
      setIsGoogleLoading(false);
    }
    // On success, Supabase redirects the browser to /dashboard automatically
  };

  return (
    <div className="login-page">
      <div className="login-background">
        <div className="grid-overlay"></div>
        <div className="glow-orb orb-login-1"></div>
        <div className="glow-orb orb-login-2"></div>
      </div>
      
      <div className="login-container">
        <button 
          className="btn-back hover-float" 
          onClick={() => navigate('/')}
          aria-label="回首頁 Back to Portal"
        >
          <ArrowLeft size={20} />
          <span className="btn-back-text">
            <span>回首頁</span>
            <span className="en-text">Portal</span>
          </span>
        </button>

        <main className="login-card glass-panel animate-slide-up">
          <header className="login-header">
            <div className="login-icon-wrapper">
              <ShieldCheck className="login-icon" size={28} />
            </div>
            <h1 className="login-title">系統登入</h1>
            <p className="login-subtitle">SECURE SYSTEM LOGIN</p>
          </header>

          {/* Google OAuth Button */}
          <button
            type="button"
            className="btn-google"
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading || isSubmitting}
          >
            <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="btn-google-text">
              <span>{isGoogleLoading ? '導向 Google...' : '使用 Google 帳號登入'}</span>
              <span className="btn-google-en">{isGoogleLoading ? 'Redirecting...' : 'Sign in with Google'}</span>
            </span>
          </button>

          {/* 展開電子郵件登入 */}
          <button
            type="button"
            className="btn-email-toggle"
            onClick={() => setShowEmailForm(v => !v)}
          >
            {showEmailForm ? '隱藏電子郵件登入' : '使用電子郵件登入'}
          </button>

          {showEmailForm && (
            <>
              <div className="login-divider">
                <span className="divider-line"></span>
                <span className="divider-text">電子郵件 / EMAIL</span>
                <span className="divider-line"></span>
              </div>

              <form className="login-form" onSubmit={handleLogin}>
                <div className="input-group">
                  <label htmlFor="email" className="dual-label">
                    <span className="label-zh">電子郵件</span>
                    <span className="label-en">EMAIL</span>
                  </label>
                  <div className="input-wrapper">
                    <Mail className="input-icon" size={18} />
                    <input
                      type="email"
                      id="email"
                      className="glass-input"
                      placeholder="name@yunlin-pmis.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="off"
                      required
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label htmlFor="password" className="dual-label">
                    <span className="label-zh">密碼</span>
                    <span className="label-en">PASSWORD</span>
                  </label>
                  <div className="input-wrapper">
                    <Lock className="input-icon" size={18} />
                    <input
                      type="password"
                      id="password"
                      className="glass-input"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div className="error-message animate-fade-in" role="alert">
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-submit interactive-scale"
                  disabled={isSubmitting}
                >
                  <span className="btn-text-zh">{isSubmitting ? '驗證中...' : '登入系統'}</span>
                  <span className="btn-text-en">{isSubmitting ? 'AUTHORIZING...' : 'LOGIN'}</span>
                </button>
              </form>
            </>
          )}

          {errorMsg && !showEmailForm && (
            <div className="error-message animate-fade-in" role="alert">
              {errorMsg}
            </div>
          )}
          
          <footer className="login-footer">
            <Lock size={12} />
            <span>256-bit AES Encrypted Connection</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
