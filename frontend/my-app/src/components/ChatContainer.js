import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MessageList from './MessageList';
import InputArea from './InputArea';
import { Box } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

function ChatContainer() {
    const [messages, setMessages] = useState([]);
    const [isInitialMessage, setIsInitialMessage] = useState(true);
    const [threadId, setThreadId] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        startNewThread();

        // const savedThreadId = sessionStorage.getItem('threadId');
        // if (savedThreadId) {
        //     setThreadId(savedThreadId);
        // } else {
        //     startNewThread();
        // }
    }, []);

    const startNewThread = async () => {
        setIsLoading(true);

        try {
            const response = await axios.post('http://127.0.0.1:5000/api/start_chat');
            const { thread_id } = response.data;
            sessionStorage.setItem('threadId', thread_id);
            setThreadId(thread_id);
        } catch (error) {
            console.error('Error starting a new thread:', error);
            setError('Could not start a new chat thread. Please try again.');
        }

        setIsLoading(false);
    };

    const formatSearchResults = (results) => {
        if (Array.isArray(results)) {
            return results.map((result, index) =>
                `${index + 1}. ${result.table_name} (Similarity: ${result.cosine_similarity.toFixed(2)})`
            ).join('\n');
        } else {
            console.error('Expected results to be an array, but received:', results);
            return 'There was an error retrieving the results.';
        }
    };


    const sendMessage = async (messageText) => {
        if (!threadId) {
            setError('There is no active chat thread. Please start a new chat.');
            return;
        }

        const chatHistoryUrl = 'http://127.0.0.1:5000/api/update_chat_history'

        const searchUrl = isInitialMessage
            ? 'http://127.0.0.1:5000/api/hyse_search'
            : 'http://127.0.0.1:5000/api/refine_search_space';

        setIsLoading(true);

        try {
            // Update the chat history
            const chatHistoryResponse = await axios.post(chatHistoryUrl, {
                thread_id: threadId,
                query: messageText,
            });

            console.log(chatHistoryResponse)

            // Check if chat history update was successful before proceeding
            if (chatHistoryResponse.data.success) {
                // Perform the hyse search or refinement based on the initial message status
                const searchResponse = await axios.post(searchUrl, {
                    thread_id: threadId,
                    query: messageText,
                });

                const newMessage = { id: messages.length + 1, text: messageText, sender: 'user' };

                let additionalInfo = '';
                if (!isInitialMessage) {
                    additionalInfo += `Inferred Action: ${searchResponse.data.inferred_action}\n`;
                    additionalInfo += `Mentioned Semantic Fields: ${searchResponse.data.mention_semantic_fields}\n`;
                    additionalInfo += `Mentioned Raw Fields: ${searchResponse.data.mention_raw_fields}\n`;
                }

                let replyText = searchResponse.data.top_results
                    ? `${additionalInfo}${formatSearchResults(searchResponse.data.top_results)}`
                    : `${additionalInfo}No results found or an error occurred.`;

                const reply = {
                    id: messages.length + 2,
                    text: replyText,
                    sender: 'bot',
                };

                setMessages(prevMessages => [...prevMessages, newMessage, reply]);
                setIsInitialMessage(false);
            } else {
                // Handle failure to update chat history
                console.error('Failed to update chat history:', chatHistoryResponse.data.error);
                setError('Could not update chat history. Please try again.');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            setError('Could not send the message. Please try again.');
        }

        setIsLoading(false);
    };

    const handleCloseSnackbar = () => {
        setError('');
    };

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            maxWidth: '80%',
            height: '100vh',
            margin: 'auto',
            paddingBottom: '56px'
        }}>
            <Box sx={{
                width: '100%',
                overflow: 'auto',
                flexGrow: 1,
                marginBottom: '8px'
            }}>
                <MessageList messages={messages} />
                {isLoading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                        <CircularProgress />
                    </Box>
                )}
            </Box>
            <InputArea onSendMessage={sendMessage} />
            <Snackbar open={!!error} autoHideDuration={6000} onClose={handleCloseSnackbar}>
                <Alert onClose={handleCloseSnackbar} severity="error" sx={{ width: '100%' }}>
                    {error}
                </Alert>
            </Snackbar>
        </Box>
    );
}

export default ChatContainer;
