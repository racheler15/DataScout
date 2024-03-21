import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        primary: {
            main: '#5e92f3',
        },
        secondary: {
            main: '#f50057',
        },
        background: {
            default: '#f4f6f8',
            paper: '#ffffff',
        },
        text: {
            primary: '#2e3131',
            secondary: '#727272',
        },
    },
});

export default theme;
