import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { Footer } from './components/Footer';
import { ProjectLayout } from './components/ProjectLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ProjectDashboard } from './pages/ProjectDashboard';
import { Submission } from './pages/Submission';
import { Quality } from './pages/Quality';
import { Archive } from './pages/Archive';
import { Analytics } from './pages/Analytics';
import { DailyReportController } from './pages/DailyReport/DailyReportController';
import { DiaryLog } from './pages/DiaryLog';
import { DiaryPrintView } from './pages/DiaryPrintView';
import { ProgressManagement } from './pages/ProgressManagement';

function WelcomePage() {
  return (
    <>
      <Navbar />
      <Hero />
      <Footer />
    </>
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
              
              {/* Per-project routes nested within ProjectLayout */}
              <Route 
                path="/projects/:id" 
                element={
                  <ProtectedRoute>
                    <ProjectLayout />
                  </ProtectedRoute>
                }
              >
                {/* Redirect /projects/:id to /projects/:id/dashboard */}
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<ProjectDashboard />} />
                <Route path="diary" element={<DailyReportController />} />
                <Route path="supervision" element={<DiaryLog />} />
                <Route path="supervision/print/:logDate" element={<DiaryPrintView />} />
                <Route path="progress" element={<ProgressManagement />} />
                <Route path="submission" element={<Submission />} />
                <Route path="quality" element={<Quality />} />
                <Route path="archive" element={<Archive />} />
                <Route path="analytics" element={<Analytics />} />
              </Route>
              
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
