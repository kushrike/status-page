import { useAuth, useOrganization } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isAuthError(error: any): boolean {
  return (
    error instanceof AuthError || error?.response?.status === 401 || error?.message?.includes('401')
  );
}
