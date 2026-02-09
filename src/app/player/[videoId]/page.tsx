'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Container,
  Typography,
  Box,
  Paper,
  IconButton,
  CircularProgress,
  Alert,
  Button,
  Collapse,
  useTheme,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Edit as EditIcon, Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import VideoPlayer from '../../../components/VideoPlayer';
import type { VideoPlayerRef } from '../../../components/VideoPlayer';
import NotesPanel from '../../../components/NotesPanel';
import NotesList, { type NotesListRef } from '../../../components/NotesList';
import ProgressIndicator from '../../../components/ProgressIndicator';
import { usePlayerStore } from '../../../stores/player.store';
import { useCatalogStore } from '../../../stores/catalog.store';
import { useThemeStore } from '../../../stores/theme.store';
import { apiService } from '../../../services/api';
import type { Video } from '../../../types';
import AuthGuard from '../../../components/AuthGuard';

export default function Player() {
  const params = useParams();
  const videoId = params.videoId as string;
  const router = useRouter();
  const videoPlayerRef = useRef<VideoPlayerRef>(null);
  const notesListRef = useRef<NotesListRef>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editSummaryContent, setEditSummaryContent] = useState<string>('');
  const [savingSummary, setSavingSummary] = useState(false);
  const { setVideo: setPlayerVideo, setCurrentTime } = usePlayerStore();
  const { formations } = useCatalogStore();
  const theme = useTheme();
  const { mode } = useThemeStore();
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => {
    if (globalThis?.window?.matchMedia) {
      return globalThis.window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });
  
  // Calculate effective color mode
  const colorMode = mode === 'system' ? systemTheme : mode;
  
  // Listen to system theme changes when mode is 'system'
  useEffect(() => {
    if (mode === 'system' && globalThis?.window?.matchMedia) {
      const mediaQuery = globalThis.window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        setSystemTheme(e.matches ? 'dark' : 'light');
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [mode]);

  // Find video in catalog
  useEffect(() => {
    if (!videoId) {
      setError('Video ID is missing');
      setLoading(false);
      return;
    }

    // Search for video in formations
    let foundVideo: Video | null = null;
    for (const formation of formations) {
      for (const chapter of formation.chapters) {
        const video = chapter.videos.find((v) => v.id === videoId);
        if (video) {
          foundVideo = video;
          break;
        }
      }
      if (foundVideo) break;
    }

    if (foundVideo) {
      setVideo(foundVideo);
      setPlayerVideo(videoId);
    } else {
      setError('Video not found');
    }
    setLoading(false);
  }, [videoId, formations, setPlayerVideo]);

  // Load progress and set video time
  useEffect(() => {
    if (!videoId) return;

    const loadProgress = async () => {
      try {
        const lastPosition = await apiService.getProgress(videoId);
        if (lastPosition !== null && videoPlayerRef.current) {
          // Small delay to ensure video is loaded
          setTimeout(() => {
            videoPlayerRef.current?.seekTo(lastPosition);
            setCurrentTime(lastPosition);
          }, 500);
        }
      } catch (error) {
        console.error('Failed to load progress:', error);
      }
    };

    loadProgress();
  }, [videoId, setCurrentTime]);

  const handleSeekTo = (time: number) => {
    if (videoPlayerRef.current) {
      videoPlayerRef.current.seekTo(time);
    }
  };

  const handleNoteCreated = () => {
    // Refresh the notes list when a new note is created
    notesListRef.current?.refresh();
  };

  const handleGetSummary = async () => {
    if (!videoId) return;

    // If summary is already loaded, just toggle visibility
    if (summary !== null) {
      setShowSummary(!showSummary);
      return;
    }

    // Otherwise, fetch the summary
    setSummaryLoading(true);
    setSummaryError(null);
    setShowSummary(true);

    try {
      const summaryText = await apiService.getVideoSummary(videoId);
      setSummary(summaryText);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load summary';
      setSummaryError(errorMessage);
      setShowSummary(false);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleEditSummary = () => {
    if (summary) {
      setIsEditingSummary(true);
      setEditSummaryContent(summary);
    }
  };

  const handleSaveSummary = async () => {
    if (!videoId || !editSummaryContent.trim()) {
      alert('Summary content cannot be empty');
      return;
    }

    setSavingSummary(true);
    try {
      const updatedSummary = await apiService.updateVideoSummary(videoId, editSummaryContent.trim());
      setSummary(updatedSummary);
      setIsEditingSummary(false);
      setEditSummaryContent('');
    } catch (error) {
      console.error('Failed to update summary:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update summary';
      alert(errorMessage);
    } finally {
      setSavingSummary(false);
    }
  };

  const handleCancelEditSummary = () => {
    setIsEditingSummary(false);
    setEditSummaryContent('');
  };

  if (loading) {
    return (
      <AuthGuard>
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
            <CircularProgress />
          </Box>
        </Container>
      </AuthGuard>
    );
  }

  if (error || !video) {
    return (
      <AuthGuard>
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Alert severity="error">{error || 'Video not found'}</Alert>
          <Box sx={{ mt: 2 }}>
            <IconButton onClick={() => router.push('/')}>
              <ArrowBackIcon /> Back to Dashboard
            </IconButton>
          </Box>
        </Container>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => router.push('/')} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            {video.title}
          </Typography>
        </Box>

        <Paper sx={{ p: 2, mb: 3 }}>
          <VideoPlayer ref={videoPlayerRef} videoId={videoId!} />
          <Box sx={{ mt: 2 }}>
            <ProgressIndicator 
              duration={video.duration}
              rightElement={
                <Button
                  variant="outlined"
                  onClick={handleGetSummary}
                  disabled={summaryLoading}
                  size="small"
                  sx={{ minWidth: 'auto', px: 1.5 }}
                >
                  {summaryLoading ? 'Loading...' : 'Summary'}
                </Button>
              }
            />
          </Box>
        </Paper>
        {summaryError && (
          <Box sx={{ mb: 3 }}>
            <Alert severity="error">{summaryError}</Alert>
          </Box>
        )}
        <Collapse in={showSummary && !summaryLoading && !summaryError}>
          <Box sx={{ mb: 3 }}>
            {summary && (
              <Paper sx={{ p: 2, backgroundColor: 'background.default' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Summary</Typography>
                  <Box>
                    {isEditingSummary ? (
                      <>
                        <IconButton
                          size="small"
                          aria-label="save"
                          onClick={handleSaveSummary}
                          disabled={savingSummary}
                          color="primary"
                        >
                          <SaveIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          aria-label="cancel"
                          onClick={handleCancelEditSummary}
                          disabled={savingSummary}
                        >
                          <CancelIcon />
                        </IconButton>
                      </>
                    ) : (
                      <IconButton
                        size="small"
                        aria-label="edit"
                        onClick={handleEditSummary}
                      >
                        <EditIcon />
                      </IconButton>
                    )}
                  </Box>
                </Box>
                <Collapse in={isEditingSummary}>
                  <Box sx={{ mb: 2 }}>
                    <MDEditor
                      value={editSummaryContent}
                      onChange={(value) => setEditSummaryContent(value || '')}
                      preview="edit"
                      hideToolbar={false}
                      visibleDragbar={false}
                      data-color-mode={colorMode}
                      height={400}
                    />
                  </Box>
                </Collapse>
                {!isEditingSummary && (
                  <Box
                    data-color-mode={colorMode}
                    sx={{
                      width: '100%',
                      '& .w-md-editor-preview': {
                        padding: '8px 12px',
                        backgroundColor: 'transparent !important',
                        color: `${theme.palette.text.primary} !important`,
                      },
                      '& .wmde-markdown': {
                        backgroundColor: 'transparent !important',
                        color: `${theme.palette.text.primary} !important`,
                      },
                      '& .wmde-markdown p': {
                        color: `${theme.palette.text.primary} !important`,
                      },
                      '& .wmde-markdown h1, & .wmde-markdown h2, & .wmde-markdown h3, & .wmde-markdown h4, & .wmde-markdown h5, & .wmde-markdown h6': {
                        color: `${theme.palette.text.primary} !important`,
                      },
                      '& .wmde-markdown pre': {
                        backgroundColor: `${theme.palette.mode === 'dark' 
                          ? 'rgba(255, 255, 255, 0.1)' 
                          : 'rgba(0, 0, 0, 0.05)'} !important`,
                        color: `${theme.palette.text.primary} !important`,
                      },
                      '& .wmde-markdown code': {
                        backgroundColor: `${theme.palette.mode === 'dark' 
                          ? 'rgba(255, 255, 255, 0.1)' 
                          : 'rgba(0, 0, 0, 0.05)'} !important`,
                        color: `${theme.palette.text.primary} !important`,
                      },
                      '& .wmde-markdown blockquote': {
                        borderLeftColor: `${theme.palette.divider} !important`,
                        color: `${theme.palette.text.secondary} !important`,
                      },
                      '& .wmde-markdown a': {
                        color: `${theme.palette.primary.main} !important`,
                      },
                      '& .wmde-markdown table': {
                        color: `${theme.palette.text.primary} !important`,
                      },
                      '& .wmde-markdown table th, & .wmde-markdown table td': {
                        borderColor: `${theme.palette.divider} !important`,
                      },
                    }}
                  >
                    <MDEditor.Markdown source={summary} />
                  </Box>
                )}
              </Paper>
            )}
          </Box>
        </Collapse>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
          <Box>
            <NotesPanel videoId={videoId!} onNoteCreated={handleNoteCreated} />
          </Box>
          <Box>
            <NotesList ref={notesListRef} videoId={videoId!} onSeekTo={handleSeekTo} />
          </Box>
        </Box>
      </Container>
    </AuthGuard>
  );
}
