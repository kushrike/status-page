import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Typography, TextField, Button, Box, Paper, Stack } from '@mui/material';

export default function Landing() {
  const navigate = useNavigate();
  const [orgSlug, setOrgSlug] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!orgSlug) {
      setError('Organization slug is required');
      return;
    }

    if (orgSlug.length > 10) {
      setError('Organization slug must be 10 characters or less');
      return;
    }

    setError('');
    navigate(`/org/${orgSlug}`);
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
        >
          <Typography variant="h4" component="h1" align="center" gutterBottom>
            Status Page
          </Typography>

          <Typography variant="body1" color="text.secondary" align="center" paragraph>
            Enter your organization slug to view its status page
          </Typography>

          <TextField
            label="Organization Slug"
            value={orgSlug}
            onChange={(e) => {
              setOrgSlug(e.target.value.toLowerCase().trim());
              setError(''); // Clear error when user types
            }}
            error={!!error}
            helperText={error || 'Maximum 10 characters'}
            fullWidth
            variant="outlined"
            placeholder="your-org-slug"
            inputProps={{ maxLength: 10 }}
            autoFocus
          />

          <Stack spacing={2}>
            <Button type="submit" variant="contained" size="large" fullWidth>
              View Status Page
            </Button>
            <Button
              onClick={() => navigate('/login')}
              variant="outlined"
              size="large"
              fullWidth
            >
              Login to Dashboard
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Container>
  );
}
