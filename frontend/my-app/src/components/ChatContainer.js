import React, { useState } from 'react';
import axios from 'axios';
import MessageList from './MessageList';
import InputArea from './InputArea';
import { Box } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';


function ChatContainer() {
    const [messages, setMessages] = useState([]);
    const [isInitialMessage, setIsInitialMessage] = useState(true);
    const [threadId, setThreadId] = useState(null);
    const [isLoading, setIsLoading] = useState(false);


    // Start a new thread (call this when initiating a new conversation)
    // TODO: add a start new thread UI
    const startNewThread = async () => {
        try {
            const response = await axios.post('http://localhost:5000/api/start_chat');

            const { thread_id } = response.data;
            setThreadId(thread_id);
        } catch (error) {
            console.error('Error starting a new thread:', error);
        }
    };

    const formatSearchResults = (results) => {
        return results.map((result, index) => `${index + 1}. ${result.table_name} (Similarity: ${result.cosine_similarity.toFixed(2)})`).join('\n');
    };

    const sendMessage = async (messageText) => {
        const apiUrl = isInitialMessage ? 'http://127.0.0.1:5000/api/hyse_search' : 'http://127.0.0.1:5000/api/your_chat_endpoint';

        setIsLoading(true); // Start loading

        try {
            const response = await axios.post(apiUrl, {
                query: messageText,
            });

            let replyText;
            if (isInitialMessage) {
                // Format the search results for display
                replyText = formatSearchResults(response.data);
            } else {
                // Handle subsequent messages differently
                replyText = response.data.reply;
            }

            const newMessage = { id: messages.length + 1, text: messageText, sender: 'user' };
            const reply = {
                id: messages.length + 2,
                data: response.data,
                sender: 'bot'
            };

            setMessages([...messages, newMessage, reply]);
            setIsInitialMessage(false); // Set to false after the first message
        } catch (error) {
            console.error('Error sending message:', error);
        }

        setIsLoading(false); // End loading
    };


    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%', // Take up 100% of the container width
            maxWidth: '80%', // Max width set for large screens
            height: '100vh', // Full height of the viewport
            margin: 'auto', // Center the box
            paddingBottom: '56px' // Padding at the bottom for the input area
        }}>
            <Box sx={{
                width: '100%', // Ensure that MessageList takes full width
                overflow: 'auto',
                flexGrow: 1,
                marginBottom: '8px' // Match bottom margin to InputArea top margin
            }}>
                <MessageList messages={messages} />
                {/* Show the CircularProgress component when isLoading is true */}
                {isLoading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                        <CircularProgress />
                    </Box>
                )}
            </Box>
            <InputArea onSendMessage={sendMessage} />
        </Box>
    );
}

export default ChatContainer;
