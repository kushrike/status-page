import { useAuth, useOrganization, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useEffect, useState } from 'react';

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export function useAuthErrorHandler() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleAuthError = async (error: Error) => {
    if (error instanceof AuthError || error.message.includes('401')) {
      toast.error('Your session has expired. Please sign in again.');
      await signOut();
      navigate('/login');
    } else {
      toast.error('An error occurred. Please try again.');
    }
  };

  return handleAuthError;
}

export function useAuthToken() {
  const { getToken } = useAuth();
  const { organization } = useOrganization();

  const getAuthToken = async () => {
    if (!organization) {
      throw new Error('Please select an organization to continue');
    }

    const token = await getToken({
      template: 'org-jwt',
    });

    if (!token) {
      throw new Error('No token available');
    }

    return token;
  };

  return { getAuthToken, organization };
}

// Fixed hook to check if user is an admin
export function useIsAdmin() {
  const { user } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkRole() {
      if (!user) return;
      const memberships = await user.getOrganizationMemberships();
      setIsAdmin(memberships[0]?.role === 'org:admin');
    }
    checkRole();
  }, [user]);

  return isAdmin;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isAuthError(error: any): boolean {
  return (
    error instanceof AuthError || error?.response?.status === 401 || error?.message?.includes('401')
  );
}
