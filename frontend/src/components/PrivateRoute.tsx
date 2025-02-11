import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, useOrganization } from '@clerk/clerk-react';
import OrganizationSelector from './OrganizationSelector';

const PrivateRoute: React.FC = () => {
  const { isSignedIn } = useAuth();
  const { organization } = useOrganization();

  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
  }

  if (!organization) {
    return <OrganizationSelector />;
  }

  return <Outlet />;
};

export default PrivateRoute;
