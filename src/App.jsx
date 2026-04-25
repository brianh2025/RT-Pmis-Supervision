import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { Footer } from './components/Footer';
import { ProjectLayout } from './components/ProjectLayout';
import { ErrorBoundary } from './components/ErrorBoundary';

const Login = React.lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const ProjectDashboard = React.lazy(() => import('./pages/ProjectDashboard').then(m => ({ default: m.ProjectDashboard })));
const Submission = React.lazy(() => import('./pages/Submission').then(m => ({ default: m.Submission })));
const Quality = React.lazy(() => import('./pages/Quality').then(m => ({ default: m.Quality })));
const Archive = React.lazy(() => import('./pages/Archive').then(m => ({ default: m.Archive })));
const Analytics = React.lazy(() => import('./pages/Analytics').then(m => ({ default: m.Analytics })));
const DiaryLog = React.lazy(() => import('./pages/DiaryLog').then(m => ({ default: m.DiaryLog })));
const DiaryPrintView = React.lazy(() => import('./pages/DiaryPrintView').then(m => ({ default: m.DiaryPrintView })));
const ProgressManagement = React.lazy(() => import('./pages/ProgressManagement').then(m => ({ default: m.ProgressManagement })));
const MaterialControl = React.lazy(() => import('./pages/MaterialControl').then(m => ({ default: m.MaterialControl })));
const PhotoTable = React.lazy(() => import('./pages/PhotoTable').then(m => ({ default: m.PhotoTable })));
const DiaryJournal = React.lazy(() => import('./pages/DiaryJournal').then(m => ({ default: m.DiaryJournal })));

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
      載入中…
    </div>
  );
}

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
          <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
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
                  <Route path="supervision" element={<DiaryLog />} />
                  <Route path="supervision/print/:logDate" element={<DiaryPrintView />} />
                  <Route path="progress" element={<ProgressManagement />} />
                  <Route path="material" element={<MaterialControl />} />
                  <Route path="submission" element={<Submission />} />
                  <Route path="quality" element={<Quality />} />
                  <Route path="archive" element={<Archive />} />
                  <Route path="analytics" element={<Analytics />} />
                  <Route path="photos" element={<PhotoTable />} />
                  <Route path="journal" element={<DiaryJournal />} />
                </Route>

                {/* Fallback: redirect unknown routes to home */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </Suspense>
          </ErrorBoundary>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
