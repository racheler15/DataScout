import React, { useEffect, useRef } from 'react';
import List from '@mui/material/List';
import MessageItem from './MessageItem';

function MessageList({ messages }) {
    const bottomListRef = useRef(null);

    // Keep the latest message in view
    useEffect(() => {
        bottomListRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    return (
        <List sx={{
            maxHeight: '100%',
            overflow: 'auto',
            bgcolor: 'background.paper',
        }}>
            {messages.map((message) => (
                <MessageItem key={message.id} message={message} />
            ))}
            <div ref={bottomListRef} />
        </List>
    );
}

export default MessageList;
