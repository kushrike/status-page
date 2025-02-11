import { SignIn } from '@clerk/clerk-react';
import { Container, Paper } from '@mui/material';

function Login() {
  return (
    <Container maxWidth="sm" sx={{ mt: 8, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <SignIn signUpUrl={undefined} routing="path" path="/login" />
      </Paper>
    </Container>
  );
}

export default Login;
