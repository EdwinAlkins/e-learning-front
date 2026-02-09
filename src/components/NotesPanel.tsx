'use client';

import { useState, useEffect } from 'react';
import {
  Button,
  Box,
  Paper,
  Typography,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import { usePlayerStore } from '../stores/player.store';
import { apiService } from '../services/api';
import { useThemeStore } from '../stores/theme.store';

interface NotesPanelProps {
  readonly videoId: string;
  readonly onNoteCreated: () => void;
}

export default function NotesPanel({
  videoId,
  onNoteCreated,
}: NotesPanelProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const { currentTime } = usePlayerStore();
  const { mode } = useThemeStore();
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });
  
  // Calculate effective color mode
  const colorMode = mode === 'system' ? systemTheme : mode;
  
  // Listen to system theme changes when mode is 'system'
  useEffect(() => {
    if (mode === 'system' && typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        setSystemTheme(e.matches ? 'dark' : 'light');
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [mode]);

  const handleCreateNote = async () => {
    if (!content.trim()) {
      return;
    }

    setLoading(true);
    try {
      await apiService.createNote(videoId, currentTime, content.trim());
      setContent('');
      onNoteCreated();
    } catch (error) {
      console.error('Failed to create note:', error);
      alert('Failed to create note. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        Add Note
      </Typography>
      <Box sx={{ mb: 2 }}>
        <MDEditor
          value={content}
          onChange={(value) => setContent(value || '')}
          preview="edit"
          hideToolbar={false}
          visibleDragbar={false}
          data-color-mode={colorMode}
          height={300}
        />
      </Box>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary">
          Current time: {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(0).padStart(2, '0')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateNote}
          disabled={loading || !content.trim()}
          sx={{ minWidth: 180 }}
        >
          Link to Current Time
        </Button>
      </Box>
    </Paper>
  );
}
