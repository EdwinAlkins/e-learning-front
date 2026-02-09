'use client';

import { useState, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import {
  List,
  ListItem,
  IconButton,
  Paper,
  Typography,
  Box,
  Collapse,
  useTheme,
} from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon, Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import type { Note } from '../types';
import { apiService } from '../services/api';
import { formatTimecode } from '../utils/time';
import { useThemeStore } from '../stores/theme.store';

interface NotesListProps {
  readonly videoId: string;
  readonly onSeekTo: (time: number) => void;
}

export interface NotesListRef {
  refresh: () => void;
}

const NotesList = forwardRef<NotesListRef, NotesListProps>(
  ({ videoId, onSeekTo }, ref) => {
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
    const [editContent, setEditContent] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const theme = useTheme();
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

    const loadNotes = useCallback(async () => {
      setLoading(true);
      try {
        const fetchedNotes = await apiService.getNotes(videoId);
        // Sort by timecode ascending
        const sortedNotes = [...fetchedNotes].sort(
          (a, b) => a.timecode - b.timecode
        );
        setNotes(sortedNotes);
      } catch (error) {
        console.error('Failed to load notes:', error);
      } finally {
        setLoading(false);
      }
    }, [videoId]);

    useImperativeHandle(ref, () => ({
      refresh: loadNotes,
    }));

    useEffect(() => {
      loadNotes();
    }, [loadNotes]);

    const handleDeleteNote = async (noteId: number) => {
      if (!confirm('Are you sure you want to delete this note?')) {
        return;
      }
      try {
        await apiService.deleteNote(noteId);
        loadNotes();
      } catch (error) {
        console.error('Failed to delete note:', error);
        alert('Failed to delete note. Please try again.');
      }
    };

    const handleEditNote = (note: Note) => {
      setEditingNoteId(note.id);
      setEditContent(note.content);
    };

    const handleSaveNote = async (noteId: number) => {
      if (!editContent.trim()) {
        alert('Note content cannot be empty');
        return;
      }

      setSaving(true);
      try {
        await apiService.updateNote(noteId, editContent.trim());
        setEditingNoteId(null);
        setEditContent('');
        loadNotes();
      } catch (error) {
        console.error('Failed to update note:', error);
        alert('Failed to update note. Please try again.');
      } finally {
        setSaving(false);
      }
    };

    const handleCancelEdit = () => {
      setEditingNoteId(null);
      setEditContent('');
    };

    const handleNoteClick = (timecode: number) => {
      if (editingNoteId === null) {
        onSeekTo(timecode);
      }
    };

  if (loading) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography>Loading notes...</Typography>
      </Paper>
    );
  }

  if (notes.length === 0) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography color="text.secondary">No notes yet.</Typography>
      </Paper>
    );
  }

  return (
    <Paper 
      sx={{ 
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        height: { xs: '60vh', md: '70vh' },
        maxHeight: { xs: '60vh', md: '70vh' },
        overflow: 'hidden',
      }}
    >
      <Typography variant="h6" gutterBottom sx={{ flexShrink: 0 }}>
        Notes ({notes.length})
      </Typography>
      <Box
        sx={{
          overflowY: 'auto',
          overflowX: 'hidden',
          flex: 1,
          minHeight: 0,
          pr: 1,
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '4px',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
            },
          },
        }}
      >
        <List>
          {notes.map((note) => (
            <ListItem
              key={note.id}
            sx={{
              borderBottom: '1px solid',
              borderColor: 'divider',
              flexDirection: 'column',
              alignItems: 'stretch',
              cursor: editingNoteId === note.id ? 'default' : 'pointer',
              '&:hover': {
                backgroundColor: editingNoteId === note.id ? 'transparent' : 'action.hover',
              },
            }}
            onClick={() => handleNoteClick(note.timecode)}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="body2"
                  color="primary"
                  sx={{ fontWeight: 'bold' }}
                >
                  {formatTimecode(note.timecode)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {new Date(note.created_at).toLocaleDateString()}
                </Typography>
              </Box>
              <Box>
                {editingNoteId === note.id ? (
                  <>
                    <IconButton
                      size="small"
                      aria-label="save"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveNote(note.id);
                      }}
                      disabled={saving}
                      color="primary"
                    >
                      <SaveIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label="cancel"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelEdit();
                      }}
                      disabled={saving}
                    >
                      <CancelIcon />
                    </IconButton>
                  </>
                ) : (
                  <>
                    <IconButton
                      size="small"
                      edge="end"
                      aria-label="edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditNote(note);
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      edge="end"
                      aria-label="delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNote(note.id);
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </>
                )}
              </Box>
            </Box>
            <Collapse in={editingNoteId === note.id}>
              <Box sx={{ width: '100%', mb: 2 }}>
                <MDEditor
                  value={editContent}
                  onChange={(value) => setEditContent(value || '')}
                  preview="edit"
                  hideToolbar={false}
                  visibleDragbar={false}
                  data-color-mode={colorMode}
                  height={250}
                />
              </Box>
            </Collapse>
            {editingNoteId !== note.id && (
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
                <MDEditor.Markdown source={note.content} />
              </Box>
            )}
          </ListItem>
        ))}
        </List>
      </Box>
    </Paper>
  );
  }
);

NotesList.displayName = 'NotesList';

export default NotesList;
