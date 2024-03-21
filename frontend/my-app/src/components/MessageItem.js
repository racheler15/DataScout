import React from 'react';
import { ListItem, ListItemText, ListItemAvatar, Avatar, Box } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import AndroidIcon from '@mui/icons-material/Android';
import DataTable from './DataTable';

function MessageItem({ message }) {
    const isUser = message.sender === 'user';

    // Determine if the message is a table response
    const isTableResponse = message.sender === 'bot' && Array.isArray(message.data);

    return (
        <ListItem sx={{
            flexDirection: 'column',
            alignItems: isUser ? 'flex-end' : 'flex-start',
            paddingY: 0,
        }}>
            <Box sx={{
                maxWidth: '70%',
                minWidth: '10%',
                my: 1,
                py: 1,
                px: 2,
                bgcolor: isUser ? 'primary.light' : 'grey.200',
                borderRadius: '20px',
                borderTopRightRadius: isUser ? 0 : '20px',
                borderTopLeftRadius: isUser ? '20px' : 0,
                display: 'flex',
                flexDirection: isUser ? 'row-reverse' : 'row',
                alignContent: 'flex-end'
            }}>
                <ListItemAvatar>
                    <Avatar sx={{ bgcolor: isUser ? 'primary.dark' : 'grey.600' }}>
                        {isUser ? <PersonIcon /> : <AndroidIcon />}
                    </Avatar>
                </ListItemAvatar>
                <ListItemText primary={message.text} sx={{ textAlign: isUser ? 'right' : 'left' }} />
            </Box>
            {isTableResponse ? (
                <DataTable data={message.data} />
            ) : (
                <ListItemText primary={message.text} />
            )}
        </ListItem>
    );
}

export default MessageItem;
