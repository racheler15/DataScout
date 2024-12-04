import "../styles/ChatBot.css";
import { Search } from "lucide-react";
import { TypingIndicator } from "@chatscope/chat-ui-kit-react";
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { ResultProp } from "./ResultsTable";
import Plot from "react-plotly.js";
import MessageItem, { MessageProps, MessageItemProps } from "./MessageItem";
import { VegaLite } from "react-vega";

// https://www.youtube.com/watch?v=Lag9Pj_33hM

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
interface PlotlyFigure {
  data: any[]; // You can use 'any' or more specific Plotly types if needed
  layout: any;
  config: any;
}

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
  const [chatStatus, setChatStatus] = useState("ended");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [plotData, setPlotData] = useState<PlotlyFigure | null>(null);
  const [vegaSpec, setVegaSpec] = useState(null);
  const [attribute, setAttribute] = useState("");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    console.log("handling submit");
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

  const fetchMessages = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5000/api/get_message");
      const data = await response.json();
      console.log(data);
      if (data.message && data.message !== "") {
        const newMessage: MessageProps = {
          id: messages.length + 1,
          text: data.message.message,
          sender: data.message.user,
          show: true,
          type: data.message.user,
        };
        setMessages((prevMessages) => [...prevMessages, newMessage]);
        console.log("NEWMESSAGE: ", newMessage);
      }
      setChatStatus(data.status);
    } catch (error) {
      console.error("Error fetching messages: ", error);
    }
  };

  useEffect(() => {
    startNewThread();
    // Empty dependency array means this effect runs once when the component mounts
  }, []);

  useEffect(() => {
    const intervalId = setInterval(fetchMessages, 3000); // changed from 1000
    return () => clearInterval(intervalId);
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (task) {
      console.log("Task bar updated:", task);
      fetchData();
    }
  }, [task]); // Dependency array includes only taskBar


  const fetchGraph = async () => {
    const response = await fetch(
      "http://127.0.0.1:5000/api/suggest_and_generate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "Generate a histogram for dataset attributes",
        }),
      }
    );
    const data = await response.json();

    if (data.error) {
      console.error(data.error);
    } else {
      setAttribute(data.attribute);
      setVegaSpec(data.vegaLiteSpec);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  const fetchData = async () => {
    try {
      const searchResponse = await axios.post(
        "http://127.0.0.1:5000/api/hyse_search",
        {
          query: task,
          thread_id: threadId,
        }
      );
      console.log("FETCHED DATA:", searchResponse);
      setResults(searchResponse.data.complete_results);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

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

  const handleMetadataProcessing = async (metadataSuggestions: string) => {
    console.log("MEATA:", metadataSuggestions);
    const metadataDict = JSON.parse(metadataSuggestions);
    const keys = Object.keys(metadataDict);

    for (const key of keys) {
      console.log("Key:", key);
      console.log("Value:", metadataDict[key]);

      try {
        const response = await fetch(
          "http://127.0.0.1:5000/api/suggest_and_generate",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              attribute: key,
              query: "Generate a histogram for dataset attributes",
            }),
          }
        );

        const data = await response.json();
        console.log("DATA:", data);
        console.log(data.vegaLiteSpec);
        console.log(JSON.parse(data.vegaLiteSpec));

        if (data.error) {
          console.error(data.error);
        } else {
          // setAttribute(data.attribute); // Assuming setAttribute is defined
          // setVegaSpec(data.vegaLiteSpec); // Assuming setVegaSpec is defined
          const metadataMessage: MessageProps = {
            id: messages.length + 1,
            text: (
              <>
                <div>
                  Distribution for <b>{key}</b>
                </div>
                <div>Reason: {metadataDict[key]}</div>
                <VegaLite spec={JSON.parse(data.vegaLiteSpec)} />
              </>
            ),
            sender: "system",
            show: true,
            type: "metadata_agent",
          };
          setMessages((prevMessages) => [...prevMessages, metadataMessage]);
          setTyping(false);
        }
      } catch (error) {
        console.error("API request failed:", error);
      }
    }
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
      type: "general",
    };
    setMessages((prevMessages) => [...prevMessages, newMessage]);
    if (isInitialMessage) {
      setTask(messageText);
    }


    const chatHistoryUrl = "http://127.0.0.1:5000/api/update_chat_history";
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

        let apiEndpoint, requestBody;
        // if (chatStatus === "chat ongoing" || chatStatus === "inputting") {
        if (!isInitialMessage) {
          console.log("continuing chat");
          // send message request
          apiEndpoint = "http://127.0.0.1:5000/api/send_message";
          console.log("APIENDPOINT", chatStatus);
          requestBody = { query: messageText };
        } else {
          // start chat request
          console.log("starting chat request");
          setIsInitialMessage(false);
          const start_refinement = "http://127.0.0.1:5000/api/start_refinement";
          const searchResponse = await axios.post(start_refinement, {
            thread_id: threadId,
            query: messageText,
            task: task,
            filters: filters,
          });
          const querySuggestions = searchResponse.data.query_suggestions;
          console.log("query suggestions: ", querySuggestions);

          const newMessage: MessageProps = {
            id: messages.length + 1,
            text: "Here are some suggestions to refine your task query: ",
            sender: "system",
            show: true,
            type: "general",
          };
          setMessages((prevMessages) => [...prevMessages, newMessage]);

          for (let i = 0; i < querySuggestions.length; i++) {
            const newMessage: MessageProps = {
              id: messages.length + 1,
              text: querySuggestions[i],
              sender: "system",
              show: true,
              type: "task_agent",
            };
            setMessages((prevMessages) => [...prevMessages, newMessage]);
          }

          console.log("starting start_autogen_chat");
          apiEndpoint = "http://127.0.0.1:5000/api/suggest_metadata";
          const metadataMessage: MessageProps = {
            id: messages.length + 1,
            text: "Here are some suggestions on refinements for metadata: ",
            sender: "system",
            show: true,
            type: "general",
          };
          setMessages((prevMessages) => [...prevMessages, metadataMessage]);

          const metadataResponse = await axios.post(apiEndpoint, {
            thread_id: threadId,
            query: `What metadata attributes are the most helpful given my task: ${task}`,
            task: task,
            filters: filters,
          });
          console.log("RESULT SEARCH RESPONSE", metadataResponse);
          console.log(metadataResponse.data.metadata_suggestions);
          const metadataSuggestions =
            metadataResponse.data.metadata_suggestions;

          handleMetadataProcessing(metadataSuggestions);
        }

        try {
          // const searchResponse = await fetch(apiEndpoint, {
          //   method: "POST",
          //   headers: { "Content-Type": "application/json" },
          //   body: JSON.stringify(requestBody),
          // });
        } catch (error) {
          console.error("Error sending request: ", error);
        }

        // setTyping(false);
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
              <MessageItem
                key={index}
                message={message}
                task={task}
                setTask={setTask}
                filters={filters}
                setFilters={setFilters}
              />
            </div>
          ))}
        </div>
        <div ref={messagesEndRef} />
      </div>
      {/* <div>
        {plotData ? (
          <Plot
            data={plotData.data}
            layout={plotData.layout}
            config={{responsive: true }}
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          <p>Loading plot...</p>
        )}
      </div> */}
      {/* {vegaSpec ? (
        <div>
          <h3>Histogram for Attribute: {attribute}</h3>
          <VegaLite spec={vegaSpec} />
        </div>
      ) : (
        <p>Loading...</p>
      )} */}
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
