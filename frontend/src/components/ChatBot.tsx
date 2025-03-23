import "../styles/ChatBot.css";
import { Search } from "lucide-react";
import { TypingIndicator } from "@chatscope/chat-ui-kit-react";
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { ResultProp } from "./ResultsTable";
import MessageItem, { MessageProps } from "./MessageItem";
import { VegaLite } from "react-vega";

// https://www.youtube.com/watch?v=Lag9Pj_33hM

interface ChatBotProps {
  setResults: (a: ResultProp[]) => unknown;
  results: ResultProp[];

  task: string;
  setTask: (task: string) => void;
  filters: string[];
  setFilters: React.Dispatch<React.SetStateAction<string[]>>;
  setIconVisibility: React.Dispatch<React.SetStateAction<boolean[]>>;
  messages: MessageProps[];
  setMessages: React.Dispatch<React.SetStateAction<MessageProps[]>>;
  settingsSpecificity: string;
  setSettingsSpecificity: React.Dispatch<React.SetStateAction<string>>;
  settingsGoal: string;
  setSettingsGoal: React.Dispatch<React.SetStateAction<string>>;
  settingsDomain: string;
  setSettingsDomain: React.Dispatch<React.SetStateAction<string>>;
  pendingFilter: string | null;
  setPendingFilter: React.Dispatch<React.SetStateAction<string | null>>;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
}

const ChatBot = ({
  results,
  setResults,
  task,
  setTask,
  filters,
  setFilters,
  setIconVisibility,
  messages,
  setMessages,
  settingsSpecificity,
  setSettingsSpecificity,
  setSettingsGoal,
  settingsGoal,
  settingsDomain,
  setSettingsDomain,
  pendingFilter,
  setPendingFilter,
  currentPage,
  setCurrentPage,
}: ChatBotProps) => {
  const [isInitialMessage, setIsInitialMessage] = useState(true);
  const [threadId, setThreadId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [settingsGenerate, setSettingsGenerate] = useState(false);
  const [currentSearchSpace, setCurrentSearchSpace] = useState<ResultProp[]>(
    []
  );
  const [inputText, setInputText] = useState("");
  const [typing, setTyping] = useState(false);
  const [chatStatus, setChatStatus] = useState("ended");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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


  const fetchMessages = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5000/api/get_message");
      const data = await response.json();
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
      taskSuggestions();
      // metadataSuggestions();
    }
  }, [task]); // Dependency array includes only taskBar

  useEffect(() => {
    const fetchTaskSuggestions = async () => {
      try {
        const taskSuggestionsURL =
          "http://127.0.0.1:5000/api/initial_task_suggestions";
        const searchResponse = await axios.post(taskSuggestionsURL, {
          thread_id: threadId,
          specificity: settingsSpecificity,
          goal: settingsGoal,
          domain: settingsDomain,
        });
        console.log(searchResponse.data);
        const querySuggestions = searchResponse.data.query_suggestions;

        // Send system message
        setMessages((prevMessages) => [
          ...prevMessages,
          {
            id: prevMessages.length + 1,
            text: "Here are some suggestions to start your task query.",
            sender: "system",
            show: true,
            type: "general",
          },
        ]);

        // Add the actual query suggestions
        setMessages((prevMessages) => [
          ...prevMessages,
          {
            id: prevMessages.length + 1,
            text: querySuggestions,
            sender: "system",
            show: true,
            type: "task_agent",
          },
        ]);
      } catch (error) {
        console.error("Error fetching task suggestions:", error);
      } finally {
        // Reset settingsGenerate to false
        setSettingsGenerate(false);
        setTyping(false);
      }
    };

    if (settingsGenerate) {
      setTyping(true);
      fetchTaskSuggestions();
    }
  }, [settingsGenerate]); // handle generate submit

  const fetchData = async () => {
    console.log("hyse search");
    try {
      const searchResponse = await axios.post(
        "http://127.0.0.1:5000/api/hyse_search",
        {
          query: task,
        }
      );
      console.log("FETCHED DATA FROM HYSE:", searchResponse);
      setResults(searchResponse.data.complete_results);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };
  //
  const taskSuggestions = async () => {
    console.log("task generation");
    setTyping(true);
    const task_suggestions = "http://127.0.0.1:5000/api/task_suggestions";
    const searchResponse = await axios.post(task_suggestions, {
      thread_id: threadId,
      task: task,
      filters: filters,
    });
    const querySuggestions = searchResponse.data.query_suggestions;

    const newMessage: MessageProps = {
      id: messages.length + 1,
      text: "Here are some suggestions to refine your task query.",
      sender: "system",
      show: true,
      type: "general",
    };
    setMessages((prevMessages) => [...prevMessages, newMessage]);

    const queryMessage: MessageProps = {
      id: messages.length + 1,
      text: querySuggestions,
      sender: "system",
      show: true,
      type: "task_agent",
    };
    setMessages((prevMessages) => [...prevMessages, queryMessage]);
    setTyping(false);
    metadataSuggestions();
  }; // Generates task suggestions

  const metadataSuggestions = async () => {
    console.log("metadata generation");
    setTyping(true);
    console.log("starting start_autogen_chat");

    const metadataResponse = await axios.post(
      "http://127.0.0.1:5000/api/suggest_metadata",
      {
        thread_id: threadId,
        query: `What metadata attributes are the most helpful given my task: ${task}`,
        task: task,
        filters: filters,
      }
    );
    console.log("RESULT SEARCH RESPONSE", metadataResponse);
    console.log(metadataResponse.data.metadata_suggestions);
    const metadataSuggestions = metadataResponse.data.metadata_suggestions;

    handleMetadataProcessing(metadataSuggestions);
  };

  const handleMetadataProcessing = async (metadataSuggestions: string) => {
    console.log("META PROCESSING:", metadataSuggestions);
    const metadataDict = JSON.parse(metadataSuggestions);
    const keys = Object.keys(metadataDict);
    type MetadataEntry = [string, string, string, number, string, number];
    const metadataText: Record<string, MetadataEntry> = {};

    for (const key of keys) {
      console.log("Key:", key);
      console.log("Value:", metadataDict[key]);
      try {
        const response = await axios.post(
          "http://127.0.0.1:5000/api/vega_testing",
          {
            thread_id: threadId,
            task: task,
            attribute: key,
            datasets: results,
          }
        );

        const data = await response.data;
        console.log("SUGGEST AND GENERATE :", data);
        console.log(data.vegaLiteSpec);

        if (data.error) {
          console.error(data.error);
        } else {
          metadataText[key] = [
            key,
            JSON.stringify(data.vegaLiteSpec),
            metadataDict[key],
            data.value,
            data.attribute_type,
            data.outliers,
          ];
        }
      } catch (error) {
        console.error("API request failed:", error);
      }
    }
    //   try {
    //     const response = await axios.post(
    //       "http://127.0.0.1:5000/api/suggest_and_generate",
    //       {
    //         thread_id: threadId,
    //         query: "Generate a histogram for dataset attributes",
    //         task: task,
    //         filters: filters,
    //         attribute: key,
    //       }
    //     );

    //     const data = await response.data;
    //     console.log("SUGGEST AND GENERATE :", data);
    //     console.log(data.vegaLiteSpec);
    //     console.log(JSON.parse(data.vegaLiteSpec));

    //     if (data.error) {
    //       console.error(data.error);
    //     } else {
    //       metadataText[key] = [
    //         key,
    //         data.vegaLiteSpec,
    //         metadataDict[key],
    //       ];
    //     }
    //   } catch (error) {
    //     console.error("API request failed:", error);
    //   }
    // }
    console.log("STRING JSON", JSON.stringify(metadataText));
    const metadataMessage: MessageProps = {
      id: messages.length + 1,
      text: JSON.stringify(metadataText),
      sender: "system",
      show: true,
      type: "metadata_agent",
    };
    console.log(metadataMessage);
    setMessages((prevMessages) => [...prevMessages, metadataMessage]);
    setTyping(false);
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

        const chatResponse = await axios.post(
          "http://127.0.0.1:5000/api/process_message",
          {
            thread_id: threadId,
            message: messageText,
            task: task,
            filters: filters,
          }
        );
        console.log("Message Search Response", chatResponse.data);
        if (
          !chatResponse.data.reset &&
          !chatResponse.data.refine &&
          !chatResponse.data.system
        ) {
          const taskSuggestionsURL =
            "http://127.0.0.1:5000/api/task_suggestions";
          const searchResponse = await axios.post(taskSuggestionsURL, {
            thread_id: threadId,
            task: messageText,
            filters: filters,
          });
          console.log(searchResponse.data);
          const querySuggestions = searchResponse.data.query_suggestions;

          // Send system message
          setMessages((prevMessages) => [
            ...prevMessages,
            {
              id: prevMessages.length + 1,
              text: "Here are some suggestions to start your task query.",
              sender: "system",
              show: true,
              type: "general",
            },
          ]);
          // Add the actual query suggestions
          setMessages((prevMessages) => [
            ...prevMessages,
            {
              id: prevMessages.length + 1,
              text: querySuggestions,
              sender: "system",
              show: true,
              type: "task_agent",
            },
          ]);
        } else if (chatResponse.data.reset) {
          const newMessage: MessageProps = {
            id: messages.length + 1,
            text: "Search intent indicates shift in task query subjet. Action inferred: RESET.",
            sender: "system",
            show: true,
            type: "system_agent",
          };
          setMessages((prevMessages) => [...prevMessages, newMessage]);
          const newTask: MessageProps = {
            id: messages.length + 1,
            text: chatResponse.data.result,
            sender: "system",
            show: true,
            type: "task_agent",
          };
          setMessages((prevMessages) => [...prevMessages, newTask]);
        } else if (chatHistoryResponse.data.refine) {
          const newMessage: MessageProps = {
            id: messages.length + 1,
            text: "Search intent indicates refinement of task query subjet. Action inferred: REFINE.",
            sender: "system",
            show: true,
            type: "general",
          };
          setMessages((prevMessages) => [...prevMessages, newMessage]);
          const newTask: MessageProps = {
            id: messages.length + 1,
            text: chatResponse.data.result,
            sender: "system",
            show: true,
            type: "task_agent",
          };
          setMessages((prevMessages) => [...prevMessages, newTask]);
        } else {
          const newMessage: MessageProps = {
            id: messages.length + 1,
            text: chatResponse.data.result,
            sender: "system",
            show: true,
            type: "general",
          };
          setMessages((prevMessages) => [...prevMessages, newMessage]);
        }

        // let apiEndpoint, requestBody;
        // if (!isInitialMessage) {
        //   console.log("continuing chat");
        //   setTask(messageText);
        //   apiEndpoint = "http://127.0.0.1:5000/api/vega_testing";
        //   const metadataResponse = await axios.post(apiEndpoint, {
        //     thread_id: threadId,
        //     query: `Generate a helpful diagram for my task: ${task}`,
        //     task: task,
        //     filters: filters,
        //   });
        //   console.log("RESULT SEARCH RESPONSE", metadataResponse);
        //   console.log(metadataResponse.data.attribute);
        //   console.log(metadataResponse.data.vegaLiteSpec);

        //   console.log("SENDING TO MESSAGES FOR VEGA CHART");

        //   const newMessage: MessageProps = {
        //     id: messages.length + 1,
        //     text: metadataResponse.data.vegaLiteSpec,
        //     sender: "system",
        //     show: true,
        //     type: "vega-test",
        //   };
        //   setMessages((prevMessages) => [...prevMessages, newMessage]);

        // send message request
        // apiEndpoint = "http://127.0.0.1:5000/api/send_message";
        // console.log("APIENDPOINT", chatStatus);
        // requestBody = { query: messageText };
        // } else {
        //   // start chat request
        //   console.log("starting chat request");
        //   setIsInitialMessage(false);
        //   const messageResponse = await axios.post(
        //     "http://127.0.0.1:5000/api/process_message",
        //     { message: messageText, task: task, filters: filters }
        //   );
        //   console.log("INITIAL MESSAGE", messageResponse)
        // }
        setTyping(false);
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
    // setTyping(false);
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
                messages={messages}
                message={message}
                task={task}
                setTask={setTask}
                filters={filters}
                setFilters={setFilters}
                settingsSpecificity={settingsSpecificity}
                setSettingsSpecificity={setSettingsSpecificity}
                settingsGoal={settingsGoal}
                setSettingsGoal={setSettingsGoal}
                settingsDomain={settingsDomain}
                setSettingsDomain={setSettingsDomain}
                settingsGenerate={settingsGenerate}
                setSettingsGenerate={setSettingsGenerate}
                pendingFilter={pendingFilter}
                setPendingFilter={setPendingFilter}
              />
            </div>
          ))}
        </div>
        <div ref={messagesEndRef} />
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
