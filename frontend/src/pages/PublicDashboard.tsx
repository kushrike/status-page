import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Container, Grid, Typography } from '@mui/material';
import { useAuth } from '@clerk/clerk-react';
import { ServiceList } from '../components/ServiceList';
import { IncidentList } from '../components/IncidentList';
import { usePublicWebSocket } from '../utils/websocket';

export default function PublicDashboard() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const { orgSlug } = useParams<{ orgSlug: string }>();

  // Redirect to dashboard if user is signed in
  useEffect(() => {
    if (isSignedIn) {
      navigate('/dashboard');
    }
  }, [isSignedIn, navigate]);

  // Redirect to home if no orgSlug
  useEffect(() => {
    if (!orgSlug) {
      navigate('/');
    }
  }, [orgSlug, navigate]);

  // Initialize WebSocket connection only if we have a valid orgSlug
  usePublicWebSocket(orgSlug || '');

  if (!orgSlug) {
    return null;
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h4" component="h1" gutterBottom>
            System Status
          </Typography>
        </Grid>
        <Grid item xs={12}>
          <ServiceList isPublic />
        </Grid>
        <Grid item xs={12}>
          <IncidentList isPublic />
        </Grid>
      </Grid>
    </Container>
  );
}
