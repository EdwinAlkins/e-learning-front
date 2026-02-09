'use client';

import { useEffect, useMemo, useState } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { useThemeStore } from '../stores/theme.store';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export default function ThemeProvider({ children }: ThemeProviderProps) {
  const { mode, getEffectiveMode } = useThemeStore();
  const effectiveMode = getEffectiveMode();
  const [, forceUpdate] = useState({});

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: effectiveMode,
        },
      }),
    [effectiveMode]
  );

  // Listen to system theme changes when mode is 'system'
  useEffect(() => {
    if (mode === 'system' && typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        // Force re-render when system theme changes
        forceUpdate({});
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [mode]);

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}
