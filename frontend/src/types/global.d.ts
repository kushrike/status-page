import React from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }

  interface TokenOptions {
    template?: string;
  }

  interface ClerkOrganization {
    id: string;
    name: string;
    slug: string;
    role: string;
  }

  interface ClerkSession {
    id: string;
    getToken(options?: TokenOptions): Promise<string>;
  }

  interface Window {
    Clerk: {
      session: ClerkSession | null;
      organization: Promise<ClerkOrganization | null>;
    };
  }
}

declare module 'axios' {
  export interface AxiosRequestConfig {
    _retry?: boolean;
  }
}
