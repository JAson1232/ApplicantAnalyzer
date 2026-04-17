import { Navigate, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import ToastContainer from './components/ToastContainer';
import { useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import UniversityDashboardPage from './pages/UniversityDashboardPage';
import UniversityDegreesListPage from './pages/UniversityDegreesListPage';
import UniversityDegreeFormPage from './pages/UniversityDegreeFormPage';
import UniversityApplicationsListPage from './pages/UniversityApplicationsListPage';
import UniversityApplicationDetailPage from './pages/UniversityApplicationDetailPage';
import UniversityCandidatesListPage from './pages/UniversityCandidatesListPage';
import UniversityCandidateFormPage from './pages/UniversityCandidateFormPage';
import UniversityCandidateDetailPage from './pages/UniversityCandidateDetailPage';
import UniversityCandidateTestPage from './pages/UniversityCandidateTestPage';
import ApplicantDashboardPage from './pages/ApplicantDashboardPage';
import ApplicantDegreesListPage from './pages/ApplicantDegreesListPage';
import ApplicantDegreeDetailPage from './pages/ApplicantDegreeDetailPage';
import ApplyPage from './pages/ApplyPage';
import ApplicantApplicationsListPage from './pages/ApplicantApplicationsListPage';
import ApplicantApplicationDetailPage from './pages/ApplicantApplicationDetailPage';
import ApplicantProfilePage from './pages/ApplicantProfilePage';
import NotFoundPage from './pages/NotFoundPage';

function DashboardRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'university' ? '/university/dashboard' : '/applicant/dashboard'} replace />;
}

export default function App() {
  return (
    <NotificationProvider>
    <div className="min-h-screen bg-navy-950 text-slate-100">
      <ToastContainer />
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<DashboardRedirect />} />

          <Route
            path="/university/dashboard"
            element={
              <ProtectedRoute roles={['university']}>
                <UniversityDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/university/degrees"
            element={
              <ProtectedRoute roles={['university']}>
                <UniversityDegreesListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/university/degrees/new"
            element={
              <ProtectedRoute roles={['university']}>
                <UniversityDegreeFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/university/degrees/:degreeId/edit"
            element={
              <ProtectedRoute roles={['university']}>
                <UniversityDegreeFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/university/applications"
            element={
              <ProtectedRoute roles={['university']}>
                <UniversityApplicationsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/university/applications/:applicationId"
            element={
              <ProtectedRoute roles={['university']}>
                <UniversityApplicationDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/university/candidates"
            element={
              <ProtectedRoute roles={['university']}>
                <UniversityCandidatesListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/university/candidates/new"
            element={
              <ProtectedRoute roles={['university']}>
                <UniversityCandidateFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/university/candidates/:candidateId"
            element={
              <ProtectedRoute roles={['university']}>
                <UniversityCandidateDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/university/candidates/:candidateId/tests/:testId"
            element={
              <ProtectedRoute roles={['university']}>
                <UniversityCandidateTestPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/applicant/dashboard"
            element={
              <ProtectedRoute roles={['applicant']}>
                <ApplicantDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/applicant/degrees"
            element={
              <ProtectedRoute roles={['applicant']}>
                <ApplicantDegreesListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/applicant/degrees/:degreeId"
            element={
              <ProtectedRoute roles={['applicant']}>
                <ApplicantDegreeDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/applicant/degrees/:degreeId/apply"
            element={
              <ProtectedRoute roles={['applicant']}>
                <ApplyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/applicant/applications"
            element={
              <ProtectedRoute roles={['applicant']}>
                <ApplicantApplicationsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/applicant/applications/:applicationId"
            element={
              <ProtectedRoute roles={['applicant']}>
                <ApplicantApplicationDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/applicant/profile"
            element={
              <ProtectedRoute roles={['applicant']}>
                <ApplicantProfilePage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
    </NotificationProvider>
  );
}
