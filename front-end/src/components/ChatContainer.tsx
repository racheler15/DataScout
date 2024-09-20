import ChatBot from "./ChatBot";
import QueryBlocks from "./QueryBlocks";
import "../styles/ChatContainer.css";
import { ArrowRightToLine, ArrowLeftFromLine } from "lucide-react";
import { ResultProp } from "./ResultsTable";
import axios from "axios";
import { useEffect, useState } from "react";
import { MessageModel } from "@chatscope/chat-ui-kit-react";

interface ChatContainerProps {
  chatOpen: boolean;
  setChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setResults: (a: ResultProp[]) => unknown;
}

const ChatContainer: React.FC<ChatContainerProps> = ({
  chatOpen,
  setChatOpen,
  setResults,
}) => {
  useEffect(() => {
    // Fetch most popular datasets when the component mounts
    const fetchMostPopularDatasets = async () => {
      try {
        const response = await axios.get(
          "http://127.0.0.1:5000/api/most_popular_datasets"
        );
        console.log("Fetched datasets:", response);
        setResults(response.data); // Set results with the fetched data
      } catch (error) {
        console.error("Error fetching top 10 popular datasets:", error);
      }
    };
    fetchMostPopularDatasets();
  }, [setResults]); // Dependency array includes setResults

  const [messages, setMessages] = useState<MessageModel[]>([
    {
      id: 0,
      message:
        "Hello, I am ChatGPT! Please start your dataset search with a task.",
      sender: "system",
      direction: "incoming",
      position: "single",
    },
  ]);

  const [task, setTask] = useState<string>("");
  const [filter, setFilter] = useState<string>("");

  return (
    <div className={`container ${chatOpen ? "" : "closed"}`}>
      <div
        className="arrow-container"
        onClick={() => {
          setChatOpen(!chatOpen);
        }}
      >
        {chatOpen ? <ArrowRightToLine />: <ArrowLeftFromLine />}
      </div>
      {chatOpen && (
        <>
          <QueryBlocks
            task={task}
            setTask={setTask}
            filter={filter}
            setFilter={setFilter}
          />
          <ChatBot
            setResults={setResults}
            setTask={setTask}
            setFilter={setFilter}
            messages={messages}
            setMessages={setMessages}
          />
        </>
      )}
    </div>
  );
};

export default ChatContainer;
