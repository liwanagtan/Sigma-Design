// The app's MUI themes. Colors, spacing, shape and type are the design tokens; Sigma keeps them in
// .sigma/tokens/mui.sigma.json (see sigma.config.json).
import { createTheme } from '@mui/material/styles';

const shared = {
  spacing: 8,
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    fontSize: 14,
    h1: { fontSize: '6rem', fontWeight: 300, lineHeight: 1.167 },
    body1: { fontSize: '1rem', fontWeight: 400, lineHeight: 1.6 },
  },
};

export const lightTheme = createTheme({
  ...shared,
  palette: {
    mode: 'light',
    primary: { main: '#2e5bff', dark: '#1565c0', contrastText: '#ffffff' },
    error: { main: '#d32f2f' },
    background: { default: '#fafafa', paper: '#ffffff' },
    text: { primary: 'rgba(0, 0, 0, 0.87)', secondary: 'rgba(0, 0, 0, 0.6)' },
  },
});

export const darkTheme = createTheme({
  ...shared,
  palette: {
    mode: 'dark',
    primary: { main: '#90caf9', dark: '#42a5f5', contrastText: 'rgba(0, 0, 0, 0.87)' },
    error: { main: '#f44336' },
    background: { default: '#121212', paper: '#1e1e1e' },
    text: { primary: '#ffffff', secondary: 'rgba(255, 255, 255, 0.7)' },
  },
});
