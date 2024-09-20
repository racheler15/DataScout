import "../styles/ChatBot.css";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import {
  MainContainer,
  ChatContainer as Chat,
  MessageList,
  Message,
  MessageInput,
  TypingIndicator,
  MessageModel,
} from "@chatscope/chat-ui-kit-react";
import React, { useState, useEffect } from "react";
import axios from "axios";
import { ResultProp } from "./ResultsTable";
import ResultsTable from "./ResultsTable";
import { MessageDirection } from "@chatscope/chat-ui-kit-react/src/types/unions";

// https://www.youtube.com/watch?v=Lag9Pj_33hM

interface MessageProps {
  id: number;
  message: String | React.ReactNode;
  sender: "user" | "system";
  direction: MessageDirection;
  position: "single" | "normal";
}

interface ChatBotProps {
  setResults: (a: ResultProp[]) => unknown;
  setTask: (task: string) => void;
  setFilter: (filter: string) => void;
  messages: MessageModel[];
  setMessages: React.Dispatch<React.SetStateAction<MessageModel[]>>;
}

const ChatBot = ({
  setResults,
  setTask,
  setFilter,
  messages,
  setMessages,
}: ChatBotProps) => {
  const [isInitialMessage, setIsInitialMessage] = useState(true);
  const [threadId, setThreadId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [currentSearchSpace, setCurrentSearchSpace] = useState<ResultProp[]>(
    []
  );

  const [typing, setTyping] = useState(false);

  useEffect(() => {
    startNewThread();
    // Empty dependency array means this effect runs once when the component mounts
  }, []);

  // called when component mounts
  const startNewThread = async () => {
    setIsLoading(true);
    try {
      const response = await axios.post("http://127.0.0.1:5000/api/start_chat");
      const { thread_id } = response.data;
      sessionStorage.setItem("threadId", thread_id); // Data stored in sessionStorage is available only for the current session
      setThreadId(thread_id);
    } catch (error) {
      console.error("Error starting a new thread:", error);
      setError("Could not start a new chat thread. Please try again.");
    }
    setIsLoading(false);
  };

  // called when user clicks send in input area
  const sendMessage = async (messageText: string) => {
    setTyping(true); // set typing indicator (Chatgpt is typing)
    if (!threadId) {
      setError("There is no active chat thread. Please start a new chat.");
      return;
    }

    const chatHistoryUrl = "http://127.0.0.1:5000/api/update_chat_history";

    const searchUrl = isInitialMessage
      ? "http://127.0.0.1:5000/api/hyse_search"
      : "http://127.0.0.1:5000/api/refine_search_space";

    setIsLoading(true);

    try {
      // Update the chat history
      const chatHistoryResponse = await axios.post(chatHistoryUrl, {
        thread_id: threadId,
        query: messageText,
      });

      console.log(chatHistoryResponse);

      // Check if chat history update was successful before proceeding
      if (chatHistoryResponse.data.success) {
        // Perform the hyse search or refinement based on the initial message status
        const searchResponse = await axios.post(searchUrl, {
          thread_id: threadId,
          query: messageText,
        });
        console.log(searchResponse);

        const newMessage: MessageModel = {
          id: messages.length + 1,
          message: messageText,
          sender: "user",
          direction: "outgoing" as MessageDirection,
          position: "normal",
        };
        console.log(newMessage.id, messageText);
        console.log(messages.length);
        if (messages.length === 3) {
          console.log("true");
          setFilter(messageText);
        }
        let additionalInfo: string = "";
        if (!isInitialMessage) {
          additionalInfo += `Inferred Action: ${searchResponse.data.inferred_action}\n`;
          additionalInfo += `Mentioned Semantic Fields: ${searchResponse.data.mention_semantic_fields.join(
            ", "
          )}\n`;
          additionalInfo += `Mentioned Raw Fields: ${searchResponse.data.mention_raw_fields.join(
            ", "
          )}\n`;
        } else {
          // is initial message, update query block
          setTask(messageText.replace(/\n/g, " "));
        }

        // Update the current search space
        const reply: MessageModel = {
          id: messages.length + 2,
          message: `${
            searchResponse.data.complete_results &&
            searchResponse.data.complete_results.length > 0
              ? `Conducted search for "${messageText}".`
              : "No results found or an error occurred."
          } ${additionalInfo ? `\n${additionalInfo}` : ""}`,

          sender: "system",
          direction: "incoming" as MessageDirection,
          position: "single",
        };

        setMessages((prevMessages) => [...prevMessages, newMessage, reply]);
        setIsInitialMessage(false);
        setTyping(false);
        setResults(searchResponse.data.complete_results);
      } else {
        // Handle failure to update chat history
        console.error(
          "Failed to update chat history:",
          chatHistoryResponse.data.error
        );
        setError("Could not update chat history. Please try again.");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setError("Could not send the message. Please try again.");
    }

    setIsLoading(false);
  };

  const handleResetSearch = async (completeResults: ResultProp[]) => {
    try {
      const response = await axios.post(
        "http://127.0.0.1:5000/api/reset_search_space",
        {
          thread_id: threadId,
          results: completeResults,
        }
      );

      // Set success message
      alert("This is a notification alert!");
      setSuccessMessage("Search space has been successfully reset.");
      // Update the current search space
      setCurrentSearchSpace(completeResults);
    } catch (error) {
      console.error("Error resetting search space:", error);
      setError("Could not reset search space. Please try again.");
    }
  };

  return (
    <div className="chatbot-container">
      <MainContainer style={{ border: "none" }}>
        <Chat>
          <MessageList
            scrollBehavior="smooth"
            typingIndicator={
              // if typing is true show TypingIndicator else null
              typing ? <TypingIndicator content="ChatGPT is typing" /> : null
            }
          >
            {messages.map((message, i) => {
              return <Message key={i} model={message} />;
            })}
          </MessageList>
          <MessageInput placeholder="Type message here" onSend={sendMessage} />
        </Chat>
      </MainContainer>
    </div>
  );
};

export default ChatBot;
