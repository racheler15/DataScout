import React from 'react';
import { ListItem, ListItemText, ListItemAvatar, Avatar, Box } from '@mui/material';
import DataTable from './DataTable';

function MessageItem({ message }) {
    const isUser = message.sender === 'user';

    // Choose the avatar letter and color based on the sender
    const avatarLetter = isUser ? "You" : "HITS";
    const avatarColor = isUser ? '#2363EB' : '#4D45DF';

    // Determine if the message is a table response
    const isTableResponse = message.sender === 'bot' && Array.isArray(message.data);

    return (
        <ListItem sx={{
            flexDirection: 'column',
            alignItems: isUser ? 'flex-end' : 'flex-start',
            paddingY: 0,
            bgcolor: 'transparent',
        }}>
            <Box sx={{
                maxWidth: '70%',
                minWidth: '10%',
                my: 1,
                py: 1,
                px: 2,
                bgcolor: 'transparent',
                color: '#ABADC6',
                display: 'flex',
                flexDirection: isUser ? 'row-reverse' : 'row',
                alignContent: 'flex-end'
            }}>
                <ListItemAvatar sx={{
                    minWidth: 0,
                    mr: isUser ? 2 : 0, // Margin right when it is a user message
                    ml: isUser ? 0 : 2, // Margin left when it is a system message
                }}>
                    <Avatar sx={{
                        bgcolor: avatarColor,
                        width: 40,
                        height: 40,
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        color: 'white'
                    }}>
                        {avatarLetter}
                    </Avatar>
                </ListItemAvatar>
                <ListItemText primary={message.text} sx={{
                    textAlign: isUser ? 'right' : 'left',
                    px: 2, // Padding left and right
                }} />
            </Box>
        </ListItem>
    );
}

export default MessageItem;
