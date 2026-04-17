import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

function defaultRouteFor(role) {
  return role === 'university' ? '/university/dashboard' : '/applicant/dashboard';
}

export default function ProtectedRoute({ children, roles = [] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner className="mt-12 justify-center" label="Checking authentication..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles.length && !roles.includes(user.role)) {
    return <Navigate to={defaultRouteFor(user.role)} replace />;
  }

  return children;
}
