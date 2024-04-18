import React, { useState } from 'react';
import { Paper, InputBase, IconButton } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

function InputArea({ onSendMessage }) {
    const [message, setMessage] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onSendMessage(message);
        setMessage('');
    };

    return (
        <Paper component="form" onSubmit={handleSubmit} sx={{
            position: 'fixed',
            bottom: 0,
            left: '10%', // Match the ChatContainer's side margins
            right: '10%', // Match the ChatContainer's side margins
            display: 'flex',
            alignItems: 'center',
            padding: '2px 4px',
            zIndex: 1000,
            maxWidth: '80%', // Ensure it does not exceed the ChatContainer's width
            width: 'calc(100% - 20%)', // Adjust width to align with the ChatContainer
            marginBottom: '16px', // Adds space to the bottom
            backgroundColor: '#272A3F'
        }}>
            <InputBase
                sx={{ ml: 1, flex: 1, padding: '10px 4px', color: '#ABADC6' }}
                placeholder="Start Searching Datasets..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                fullWidth
            />
            <IconButton type="submit" sx={{ p: '10px', color: '#ABADC6' }} aria-label="send">
                <SendIcon />
            </IconButton>
        </Paper>
    );
}

export default InputArea;
