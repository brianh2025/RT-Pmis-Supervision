import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { Footer } from './components/Footer';
import { Login } from './pages/Login';

function WelcomePage() {
  return (
    <>
      <Navbar />
      <Hero />
      <Footer />
    </>
  );
}

/** Placeholder dashboard — will be developed into the full PMIS portal */
function Dashboard() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '1rem',
      backgroundColor: 'var(--color-background-base)',
      color: 'var(--color-text-main)',
    }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.1em' }}>
        專案監造管理系統
      </h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', letterSpacing: '0.1em' }}>
        DASHBOARD — Coming Soon
      </p>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="app-container">
            <Routes>
              <Route path="/" element={<WelcomePage />} />
              <Route path="/login" element={<Login />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              {/* Fallback: redirect unknown routes to home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
