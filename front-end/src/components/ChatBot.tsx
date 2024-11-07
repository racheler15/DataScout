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
  task: string;
  setTask: (task: string) => void;
  filters: string[];
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
  "USER UPDATED TASK BLOCK",
  "SYSTEM CREATED FILTER BLOCK",
  "USER CREATED FILTER BLOCK",
];
const MessageItem = ({ message }: MessageItemProps) => {
  const senderStyle = {
    color: message.sender === "user" ? "#3D5D9F" : "#A02A2A",
    paddingRight: message.sender === "user" ? "20px" : "0px",
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
  task,
  setTask,
  filters,
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
  const [chatStatus, setChatStatus] = useState('ended');
  const [activeAgent, setActiveAgent] = useState("");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    console.log("handling submit")
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
  const fetchMessages = async() =>{
    try {
      const response = await fetch("http://127.0.0.1:5000/api/get_message");
      const data = await response.json();
      console.log(data)
      if (data.message && data.message !=='') {
        const newMessage: MessageProps = {
          id: messages.length + 1,
          text: data.message.message,
          sender: data.message.user,
          show: true,
        };
        setMessages(prevMessages => [...prevMessages, newMessage]);

      }
      setChatStatus(data.status)
    } catch (error) {
      console.error('Error fetching messages: ', error)
    }
    
  }

  useEffect(() => {
    startNewThread();
    // Empty dependency array means this effect runs once when the component mounts
  }, []);

  useEffect(() => {
    // Empty dependency array means this effect runs once when the component mounts
  }, [task]);

  useEffect(()=> {
    const intervalId = setInterval(fetchMessages, 3000); // changed from 1000
    return () => clearInterval(intervalId);
  }, [messages])

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
    const newMessage: MessageProps = {
          id: messages.length + 1,
          text: messageText,
          sender: "user",
          show: true,
        };
    setMessages((prevMessages) => [...prevMessages, newMessage])

    const chatHistoryUrl = "http://127.0.0.1:5000/api/update_chat_history";
    const searchUrl = "http://127.0.0.1:5000/api/agent_chooser";

    // const searchUrl = isInitialMessage
    //   ? "http://127.0.0.1:5000/api/autogen_agent"
    //   : "http://127.0.0.1:5000/api/refine_search_space";

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
        // const searchResponse = await axios.post(searchUrl, {
        //   thread_id: threadId,
        //   query: messageText,
        //   task: task,
        //   filters: filters
        // });
        // console.log(searchResponse);
        // let chosen_agent = searchResponse.data.agent_chosen
        // let replyUrl = '';
        // if (chosen_agent === 'query_refiner') {
        //   replyUrl = "http://127.0.0.1:5000/api/query_refiner"
        // } else if (chosen_agent === 'graph_agent') {
        //   replyUrl = "http://127.0.0.1:5000/api/graph_agent"
        
        let apiEndpoint, requestBody;
        if (chatStatus === 'chat ongoing' || chatStatus === 'inputting') {
          // send message request
          apiEndpoint = "http://127.0.0.1:5000/api/send_message";
          console.log("APIENDPOINT", chatStatus)
          requestBody = {query: messageText}
        } else {
          // start chat request
          console.log("starting agent_chooser")
          apiEndpoint = "http://127.0.0.1:5000/api/agent_chooser"
          requestBody = {
            thread_id: threadId,
            query: messageText,
            task: task,
            filters: filters
          }
        }
        try {
          const searchResponse = await fetch(apiEndpoint, {
            method: "POST",
            headers: {'Content-Type': "application/json"},
            body: JSON.stringify(requestBody)
          })
          console.log(searchResponse)
        } catch (error) {
          console.error("Error sending request: ", error)
        }
        

        // const newMessage: MessageProps = {
        //   id: messages.length + 1,
        //   text: messageText,
        //   sender: "user",
        //   show: true,
        // };

        // let additionalInfo: string = "";
        // if (!isInitialMessage) {
        //   searchResponse.data.filter_prompts.sql_clauses.forEach(
        //     (item: SqlClause) => {
        //       setFilters((prev) => [...prev, `${item.field} ${item.clause}`]);
        //       setIconVisibility((prev) => [...prev, true]);
        //     }
        //   );

        //   additionalInfo += `Inferred Action: ${searchResponse.data.inferred_action}\n`;
        //   additionalInfo += `Mentioned Semantic Fields: ${searchResponse.data.mention_semantic_fields.join(
        //     ", "
        //   )}\n`;
        //   additionalInfo += `Mentioned Raw Fields: ${searchResponse.data.mention_raw_fields.join(
        //     ", "
        //   )}\n`;
        // } else {
        //   // is initial message, update query block
        //   prunePrompt(messageText);
        // }

        // // Update the current search space
        // const reply: MessageProps = {
        //   id: messages.length + 2,
        //   text: (
        //     <>
        //       {isInitialMessage &&
        //       searchResponse.data.complete_results &&
        //       searchResponse.data.complete_results.length > 0 ? (
        //         <div className="system-update-response">
        //           {SYSTEM_UPDATES[0]}
        //         </div>
        //       ) : (
        //         <div className="system-update-response">
        //           {SYSTEM_UPDATES[1]}
        //         </div>
        //       )}
        //     </>
        //   ),
        //   sender: "system",
        //   show: false,
        // };

        // setMessages((prevMessages) => [...prevMessages, newMessage, reply]);
        setIsInitialMessage(false);
        setTyping(false);
        // setResults(searchResponse.data.complete_results);
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
