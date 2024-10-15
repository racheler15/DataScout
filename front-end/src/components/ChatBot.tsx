import "../styles/ChatBot.css";
import { Search } from "lucide-react";
import { TypingIndicator } from "@chatscope/chat-ui-kit-react";
import React, { useState, useEffect } from "react";
import axios from "axios";
import { ResultProp } from "./ResultsTable";

// https://www.youtube.com/watch?v=Lag9Pj_33hM

export interface MessageProps {
  id: number;
  text: String | JSX.Element;
  sender: "user" | "system";
  show: boolean;
}
interface ChatBotProps {
  setResults: (a: ResultProp[]) => unknown;
  setTask: (task: string) => void;
  setFilters: React.Dispatch<React.SetStateAction<string[]>>;
  setIconVisibility: React.Dispatch<React.SetStateAction<boolean[]>>;
  messages: MessageProps[];
  setMessages: React.Dispatch<React.SetStateAction<MessageProps[]>>;
}
interface MessageItemProps {
  message: MessageProps;
}
interface SqlClause {
  field: string;
  clause: string;
}
export const SYSTEM_UPDATES = [
  "SYSTEM UPDATED TASK BLOCK",
  "SYSTEM CREATED FILTER BLOCK",
  "USER CREATED FILTER BLOCK",
];

const MessageItem = ({ message }: MessageItemProps) => {
  const senderStyle = {
    color: message.sender === "user" ? "#3D5D9F" : "#A02A2A",
  };
  return (
    <div className={`message-container ${message.show ? "" : "show"}`}>
      {message.show && (
        <div className="user" style={senderStyle}>
          {message.sender === "user" ? "User:" : "System:"}{" "}
        </div>
      )}
      <div className="text">{message.text}</div>
    </div>
  );
};

const ChatBot = ({
  setResults,
  setTask,
  setFilters,
  setIconVisibility,
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
  const [inputText, setInputText] = useState("");
  const [typing, setTyping] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Prevent form from refreshing the page
    if (inputText.trim()) {
      sendMessage(inputText); // Pass the message text to sendMessage function
      setInputText(""); // Clear the input after submitting
    }
  };

  const prunePrompt = async (message: string) => {
    try {
      const response = await axios.post(
        "http://127.0.0.1:5000/api/prune_prompt",
        { query: message }
      );
      setTask(response.data["pruned_query"]);
    } catch (error) {
      console.error("Error sending: " + message);
    }
  };

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

        const newMessage: MessageProps = {
          id: messages.length + 1,
          text: messageText,
          sender: "user",
          show: true,
        };

        let additionalInfo: string = "";
        if (!isInitialMessage) {
          searchResponse.data.filter_prompts.sql_clauses.forEach(
            (item: SqlClause) => {
              setFilters((prev) => [...prev, `${item.field} ${item.clause}`]);
              setIconVisibility((prev) => [...prev, true]);
            }
          );

          additionalInfo += `Inferred Action: ${searchResponse.data.inferred_action}\n`;
          additionalInfo += `Mentioned Semantic Fields: ${searchResponse.data.mention_semantic_fields.join(
            ", "
          )}\n`;
          additionalInfo += `Mentioned Raw Fields: ${searchResponse.data.mention_raw_fields.join(
            ", "
          )}\n`;
        } else {
          // is initial message, update query block
          prunePrompt(messageText);
        }

        // Update the current search space
        const reply: MessageProps = {
          id: messages.length + 2,
          text: (
            <>
              {isInitialMessage &&
              searchResponse.data.complete_results &&
              searchResponse.data.complete_results.length > 0 ? (
                <div className="system-update-response">
                  {SYSTEM_UPDATES[0]}
                </div>
              ) : (
                <div className="system-update-response">
                  {SYSTEM_UPDATES[1]}
                </div>
              )}
              {/* {additionalInfo ? <div>{additionalInfo}</div> : null} */}
            </>
          ),
          sender: "system",
          show: false,
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
      <div className="chat-messages-container">
        <div className="chat-messages">
          {messages.map((message, index) => (
            <div>
              <MessageItem key={index} message={message}/>
            </div>
          ))}
        </div>
      </div>
      <div className="typing">
        {typing ? <TypingIndicator content="ChatGPT is typing . . ." /> : null}
      </div>
      <div className="chatbox">
        <div className="search-icon">
          <Search />
        </div>
        <form className="input-container" onSubmit={handleSubmit}>
          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            placeholder="Type a message..."
          />
        </form>
      </div>
    </div>
  );
};

export default ChatBot;
