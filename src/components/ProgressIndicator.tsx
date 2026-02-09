'use client';

import { LinearProgress, Box, Typography } from '@mui/material';
import { usePlayerStore } from '../stores/player.store';
import type { ReactNode } from 'react';

interface ProgressIndicatorProps {
  readonly duration: number;
  readonly rightElement?: ReactNode;
}

export default function ProgressIndicator({ duration, rightElement }: ProgressIndicatorProps) {
  const { currentTime } = usePlayerStore();
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{ width: '100%', mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {formatTime(currentTime)} / {formatTime(duration)}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {rightElement}
          <Typography variant="body2" color="text.secondary">
            {Math.round(progress)}%
          </Typography>
        </Box>
      </Box>
      <LinearProgress variant="determinate" value={progress} />
    </Box>
  );
}
