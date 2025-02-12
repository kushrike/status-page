import { SignIn } from '@clerk/clerk-react';
import { Container, Paper } from '@mui/material';

function Login() {
  return (
    <Container maxWidth="sm" sx={{ mt: 8, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <SignIn 
          signUpUrl="/sign-up"
          routing="path"
          path="/login"
          redirectUrl="/dashboard"
          afterSignInUrl="/dashboard"
          appearance={{
            layout: {
              socialButtonsPlacement: 'bottom',
              socialButtonsVariant: 'iconButton',
              termsPageUrl: 'terms',
              privacyPageUrl: 'privacy'
            },
            elements: {
              rootBox: {
                width: '100%'
              }
            }
          }}
        />
      </Paper>
    </Container>
  );
}

export default Login;

