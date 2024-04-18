import React from 'react';
import ChatContainer from './components/ChatContainer';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const theme = createTheme({
  palette: {
    background: {
      default: '#1A1D2D'
    }
  },
  text: {
    primary: '#ABADC6',
  }
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ChatContainer />
    </ThemeProvider>
  );
}

export default App;
