'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import { VpnKey as KeyIcon, PlayArrow as PlayIcon } from '@mui/icons-material';
import { useAuthStore } from '../../stores/auth.store';
import { apiService } from '../../services/api';

export default function Auth() {
  const [uid, setUid] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setUID, isAuthenticated, checkAuth } = useAuthStore();

  // Check if user is already authenticated on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  const handleGenerateUID = async () => {
    setLoading(true);
    setError(null);
    try {
      const newUid = await apiService.generateUID();
      setUID(newUid);
      router.push('/');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate UID'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    setError(null);
    const trimmedUid = uid.trim();

    // Basic validation: UID should be 64 hex characters
    if (!trimmedUid) {
      setError('UID is required');
      return;
    }

    if (!/^[0-9a-f]{64}$/i.test(trimmedUid)) {
      setError('UID must be 64 hexadecimal characters');
      return;
    }

    setUID(trimmedUid);
    router.push('/');
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paper sx={{ p: 4, width: '100%' }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            Formation Platform
          </Typography>
          <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4 }}>
            Enter your UID or generate a new one
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="UID"
              placeholder="Enter your 64-character UID"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleContinue();
                }
              }}
            />

            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={<PlayIcon />}
              onClick={handleContinue}
              disabled={loading || !uid.trim()}
            >
              Continue
            </Button>

            <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
              <Box sx={{ flex: 1, height: 1, bgcolor: 'divider' }} />
              <Typography sx={{ px: 2, color: 'text.secondary' }}>OR</Typography>
              <Box sx={{ flex: 1, height: 1, bgcolor: 'divider' }} />
            </Box>

            <Button
              fullWidth
              variant="outlined"
              size="large"
              startIcon={<KeyIcon />}
              onClick={handleGenerateUID}
              disabled={loading}
            >
              Generate New UID
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}
