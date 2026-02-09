'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Typography,
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ExpandMore as ExpandMoreIcon, PlayArrow as PlayIcon } from '@mui/icons-material';
import { useCatalogStore } from '../stores/catalog.store';
import { apiService } from '../services/api';
import type { Video, FormationProgress, Chapter } from '../types';
import AuthGuard from '../components/AuthGuard';

// Helper function to get chip color based on progress percentage
const getChipColor = (percentage: number): 'primary' | 'default' => {
  return percentage >= 99 ? 'primary' : 'default';
};

// Helper function to get chip background color based on progress percentage
const getChipBackgroundColor = (percentage: number): string | undefined => {
  if (percentage >= 99) return 'primary.main'; // Blue background when completed
  if (percentage === 0) return 'white';
  return 'grey.300';
};


// Helper function to get chip border color for outlined variant
const getChipBorderColor = (percentage: number): string | undefined => {
  if (percentage >= 99) return 'primary.main'; // Blue border when completed
  if (percentage === 0) return 'grey.300';
  return 'grey.400';
};

// Helper function to extract number from video title (format: "<number>. <titre>")
const getVideoNumber = (title: string): number => {
  const regex = /^(\d+)\.\s/;
  const match = regex.exec(title);
  if (match) {
    return Number.parseInt(match[1], 10);
  }
  // If format doesn't match, return a large number to put it at the end
  return Infinity;
};

// Helper function to sort videos by their number
const sortVideosByNumber = (videos: Video[]): Video[] => {
  return [...videos].sort((a, b) => {
    const numA = getVideoNumber(a.title);
    const numB = getVideoNumber(b.title);
    return numA - numB;
  });
};

// Helper function to sort chapters by their number
const sortChaptersByNumber = (chapters: Chapter[]): Chapter[] => {
  return [...chapters].sort((a, b) => {
    const numA = getVideoNumber(a.name);
    const numB = getVideoNumber(b.name);
    return numA - numB;
  });
};

// Helper function to calculate total duration of a chapter in seconds
const calculateChapterTotalDuration = (chapter: Chapter): number => {
  return chapter.videos.reduce((total, video) => {
    return total + video.duration;
  }, 0);
};

// Helper function to calculate total duration of a formation in seconds
const calculateFormationTotalDuration = (formation: { chapters: Chapter[] }): number => {
  return formation.chapters.reduce((total, chapter) => {
    return total + calculateChapterTotalDuration(chapter);
  }, 0);
};

// Helper function to format duration in seconds to hours:minutes:seconds format
const formatDurationInHoursMinutes = (totalSeconds: number): string => {
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${minutes.toString().padStart(2, '0')} heures`;
};

// Helper functions for localStorage management
const STORAGE_KEY_FORMATION = 'dashboard_accordion_formation_';
const STORAGE_KEY_CHAPTER = 'dashboard_accordion_chapter_';

const getFormationExpandedKey = (formationName: string): string => {
  return `${STORAGE_KEY_FORMATION}${formationName}`;
};

const getChapterExpandedKey = (formationName: string, chapterName: string): string => {
  return `${STORAGE_KEY_CHAPTER}${formationName}_${chapterName}`;
};

const saveFormationExpanded = (formationName: string, expanded: boolean): void => {
  if (typeof window === 'undefined') return;
  const key = getFormationExpandedKey(formationName);
  localStorage.setItem(key, String(expanded));
};

const saveChapterExpanded = (formationName: string, chapterName: string, expanded: boolean): void => {
  if (typeof window === 'undefined') return;
  const key = getChapterExpandedKey(formationName, chapterName);
  localStorage.setItem(key, String(expanded));
};

export default function Dashboard() {
  const { formations, loading, error, fetchFormations } = useCatalogStore();
  const router = useRouter();
  const theme = useTheme();
  const [progressData, setProgressData] = useState<Record<string, FormationProgress>>({});
  const [progressLoading, setProgressLoading] = useState<Record<string, boolean>>({});
  const [progressError, setProgressError] = useState<Record<string, string>>({});
  const [expandedFormations, setExpandedFormations] = useState<Record<string, boolean>>({});
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});

  // Helper function to get chip text color based on progress percentage
  const getChipTextColor = (percentage: number): string => {
    if (percentage >= 99) {
      // Black text on blue background when dark theme, white when light theme
      return theme.palette.mode === 'dark' ? 'black' : 'white';
    }
    return theme.palette.mode === 'dark' ? 'black' : 'text.primary';
  };

  useEffect(() => {
    fetchFormations();
  }, [fetchFormations]);

  // Load accordion expanded states from localStorage
  useEffect(() => {
    const safeFormations = Array.isArray(formations) ? formations : [];
    if (safeFormations.length === 0) return;

    const loadedFormations: Record<string, boolean> = {};
    const loadedChapters: Record<string, boolean> = {};

    safeFormations.forEach((formation, formationIndex) => {
      // Load formation expanded state
      const formationKey = formation.name;
      const savedFormationExpanded = typeof window !== 'undefined' 
        ? localStorage.getItem(getFormationExpandedKey(formationKey))
        : null;
      
      if (savedFormationExpanded === null) {
        // Default: first formation expanded on first visit
        loadedFormations[formationKey] = formationIndex === 0;
      } else {
        loadedFormations[formationKey] = savedFormationExpanded === 'true';
      }

      // Load chapter expanded states
      formation.chapters.forEach((chapter, chapterIndex) => {
        const chapterKey = `${formation.name}_${chapter.name}`;
        const savedChapterExpanded = typeof window !== 'undefined'
          ? localStorage.getItem(getChapterExpandedKey(formation.name, chapter.name))
          : null;
        
        if (savedChapterExpanded === null) {
          // Default: first chapter of first formation expanded on first visit
          loadedChapters[chapterKey] = formationIndex === 0 && chapterIndex === 0;
        } else {
          loadedChapters[chapterKey] = savedChapterExpanded === 'true';
        }
      });
    });

    setExpandedFormations(loadedFormations);
    setExpandedChapters(loadedChapters);
  }, [formations]);

  // Load progress for each formation
  useEffect(() => {
    const loadProgress = async () => {
      const safeFormations = Array.isArray(formations) ? formations : [];
      const newProgressData: Record<string, FormationProgress> = {};
      const newProgressLoading: Record<string, boolean> = {};
      const newProgressError: Record<string, string> = {};

      for (const formation of safeFormations) {
        newProgressLoading[formation.name] = true;
        try {
          const progress = await apiService.getFormationProgress(formation.name);
          newProgressData[formation.name] = progress;
        } catch (err) {
          newProgressError[formation.name] = err instanceof Error ? err.message : 'Failed to load progress';
        } finally {
          newProgressLoading[formation.name] = false;
        }
      }

      setProgressData(newProgressData);
      setProgressLoading(newProgressLoading);
      setProgressError(newProgressError);
    };

    if (formations && formations.length > 0) {
      loadProgress();
    }
  }, [formations]);

  const handleVideoClick = (video: Video) => {
    router.push(`/player/${video.id}`);
  };

  const handleFormationChange = (formationName: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedFormations((prev) => {
      const newState = { ...prev, [formationName]: isExpanded };
      saveFormationExpanded(formationName, isExpanded);
      return newState;
    });
  };

  const handleChapterChange = (formationName: string, chapterName: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    const chapterKey = `${formationName}_${chapterName}`;
    setExpandedChapters((prev) => {
      const newState = { ...prev, [chapterKey]: isExpanded };
      saveChapterExpanded(formationName, chapterName, isExpanded);
      return newState;
    });
  };

  // Safety check: ensure formations is always an array
  const safeFormations = Array.isArray(formations) ? formations : [];
  
  // Debug logging
  // useEffect(() => {
  //   console.log('Dashboard - formations:', formations);
  //   console.log('Dashboard - safeFormations:', safeFormations);
  //   console.log('Dashboard - loading:', loading);
  //   console.log('Dashboard - error:', error);
  // }, [formations, safeFormations, loading, error]);

  return (
    <AuthGuard>
      {loading ? (
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
            <CircularProgress />
          </Box>
        </Container>
      ) : error ? (
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Alert severity="error">{error}</Alert>
        </Container>
      ) : safeFormations.length === 0 ? (
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Typography variant="h5" gutterBottom>
            Formations
          </Typography>
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">No formations available.</Typography>
          </Paper>
        </Container>
      ) : (
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Formations
          </Typography>

          <Box sx={{ mt: 3 }}>
            {safeFormations.map((formation) => {
              const formationProgress = progressData[formation.name];
              const isLoadingProgress = progressLoading[formation.name];
              const progressErr = progressError[formation.name];

              return (
                <Accordion 
                  key={formation.name} 
                  expanded={expandedFormations[formation.name] ?? false}
                  onChange={handleFormationChange(formation.name)}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2 }}>
                      <Typography variant="h6">{formation.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatDurationInHoursMinutes(calculateFormationTotalDuration(formation))}
                      </Typography>
                      {isLoadingProgress && <CircularProgress size={20} />}
                      {formationProgress && !isLoadingProgress && (
                        <Chip
                          label={`${formationProgress.progress_percentage.toFixed(1)}%`}
                          color={getChipColor(formationProgress.progress_percentage)}
                          sx={{
                            backgroundColor: getChipBackgroundColor(formationProgress.progress_percentage),
                            color: getChipTextColor(formationProgress.progress_percentage),
                          }}
                          size="small"
                        />
                      )}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    {formationProgress && (
                      <Box sx={{ mb: 2 }}>
                        <LinearProgress
                          variant="determinate"
                          value={formationProgress.progress_percentage}
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Box>
                    )}
                    {progressErr && (
                      <Alert severity="warning" sx={{ mb: 2 }}>
                        {progressErr}
                      </Alert>
                    )}
                    {sortChaptersByNumber(formation.chapters).map((chapter) => {
                      const chapterProgress = formationProgress?.chapters.find(
                        (ch) => ch.name === chapter.name
                      );

                      const chapterKey = `${formation.name}_${chapter.name}`;
                      return (
                        <Accordion 
                          key={`${formation.name}-${chapter.name}`} 
                          expanded={expandedChapters[chapterKey] ?? false}
                          onChange={handleChapterChange(formation.name, chapter.name)}
                          sx={{ mb: 1 }}
                        >
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2 }}>
                              <Typography variant="h6" sx={{ color: 'text.secondary' }}>
                                {chapter.name}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {formatDurationInHoursMinutes(calculateChapterTotalDuration(chapter))}
                              </Typography>
                              {chapterProgress && (
                                <Chip
                                  label={`${chapterProgress.progress_percentage.toFixed(1)}%`}
                                  color={getChipColor(chapterProgress.progress_percentage)}
                                  sx={{
                                    backgroundColor: getChipBackgroundColor(chapterProgress.progress_percentage),
                                    borderColor: getChipBorderColor(chapterProgress.progress_percentage),
                                    color: getChipTextColor(chapterProgress.progress_percentage),
                                  }}
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          </AccordionSummary>
                          <AccordionDetails>
                            {chapterProgress && (
                              <Box sx={{ mb: 2 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={chapterProgress.progress_percentage}
                                  sx={{ height: 6, borderRadius: 3 }}
                                />
                              </Box>
                            )}
                            <List>
                              {sortVideosByNumber(chapter.videos).map((video) => {
                                const videoProgress = chapterProgress?.videos.find(
                                  (v) => v.id === video.id
                                );

                                return (
                                  <Paper key={video.id} sx={{ mb: 1 }}>
                                    <ListItem disablePadding>
                                      <ListItemButton onClick={() => handleVideoClick(video)}>
                                        <PlayIcon sx={{ mr: 2, color: 'primary.main' }} />
                                        <ListItemText
                                          primary={video.title}
                                          secondary={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                              <Typography variant="caption" color="text.secondary">
                                                Duration: {Math.floor(video.duration / 60)}:{(video.duration % 60).toFixed(0).padStart(2, '0')}
                                              </Typography>
                                              {videoProgress && (
                                                <>
                                                  <Typography variant="caption" color="text.secondary">
                                                    •
                                                  </Typography>
                                                  <Chip
                                                    label={`${videoProgress.progress_percentage.toFixed(0)}%`}
                                                    color={getChipColor(videoProgress.progress_percentage)}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{
                                                      height: 18,
                                                      fontSize: '0.7rem',
                                                      backgroundColor: getChipBackgroundColor(videoProgress.progress_percentage),
                                                      borderColor: getChipBorderColor(videoProgress.progress_percentage),
                                                      color: getChipTextColor(videoProgress.progress_percentage),
                                                    }}
                                                  />
                                                </>
                                              )}
                                            </Box>
                                          }
                                        />
                                      </ListItemButton>
                                    </ListItem>
                                    {videoProgress && (
                                      <Box sx={{ px: 2, pb: 1 }}>
                                        <LinearProgress
                                          variant="determinate"
                                          value={videoProgress.progress_percentage}
                                          sx={{ height: 4, borderRadius: 2 }}
                                        />
                                      </Box>
                                    )}
                                  </Paper>
                                );
                              })}
                            </List>
                          </AccordionDetails>
                        </Accordion>
                      );
                    })}
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
        </Container>
      )}
    </AuthGuard>
  );
}
