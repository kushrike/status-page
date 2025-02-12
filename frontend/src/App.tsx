import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, useOrganization } from '@clerk/clerk-react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Services from './pages/Services';
import Incidents from './pages/Incidents';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { useAuthToken } from './utils/auth';
import { initializeApi } from './api';
import { useEffect } from 'react';
import { initializeWebSocket, getWebSocketManager } from './utils/websocket';
import Landing from './pages/Landing';
import PublicDashboard from './pages/PublicDashboard';
import PrivateRoute from './components/PrivateRoute';

function App() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { getAuthToken } = useAuthToken();
  const { organization } = useOrganization();

  useEffect(() => {
    if (isSignedIn) {
      initializeApi(getAuthToken);
    }
  }, [isSignedIn, getAuthToken]);

  // Initialize WebSocket when user is signed in and has an organization
  useEffect(() => {
    let mounted = true;

    const initWs = async () => {
      if (isSignedIn && organization) {
        try {
          const token = (await getToken({
            template: 'org-jwt',
          })) as string;

          // Only initialize if still mounted and no existing connection
          if (mounted && !getWebSocketManager()) {
            initializeWebSocket(organization.id, token);
          }
        } catch (error) {
          console.error('Failed to initialize WebSocket:', error);
        }
      }
    };

    initWs();

    // Cleanup function
    return () => {
      mounted = false;
      // Only disconnect if component is being unmounted
      if (!isSignedIn || !organization) {
        const wsManager = getWebSocketManager();
        wsManager?.disconnect();
      }
    };
  }, [isSignedIn, organization, getToken]);

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/"
        element={isLoaded && isSignedIn ? <Navigate to="/dashboard" replace /> : <Landing />}
      />

      {/* Auth Routes - Use wildcard to allow Clerk to handle sub-routes */}
      <Route path="/login/*" element={<Login />} />
      <Route path="/sign-up/*" element={<Login />} />
      <Route path="/org/:orgSlug" element={<PublicDashboard />} />

      {/* Protected Routes */}
      <Route element={<PrivateRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/services" element={<Services />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>

      {/* Catch all route - redirect to landing or dashboard */}
      <Route
        path="*"
        element={
          isLoaded && isSignedIn ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
    </Routes>
  );
}

export default App;
