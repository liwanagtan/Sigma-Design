import { ThemeProvider, Button, Card, CardContent, Typography } from '@mui/material';
import { lightTheme } from './theme.js';

export default function App() {
  return (
    <ThemeProvider theme={lightTheme}>
      <Card sx={{ m: 2 }}>
        <CardContent>
          <Typography variant="h1">Acme</Typography>
          <Typography variant="body1">Tokens live in the MUI theme (src/theme.js).</Typography>
          <Button variant="contained">Continue</Button>
        </CardContent>
      </Card>
    </ThemeProvider>
  );
}
