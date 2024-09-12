import ChatBot, { MessageProps } from "./ChatBot";
import QueryBlocks from "./QueryBlocks";
import "../styles/ChatContainer.css";
import { ArrowRightToLine, ArrowLeftFromLine } from "lucide-react";
import { ResultProp } from "./ResultsTable";
import axios from "axios";
import { useEffect, useState } from "react";

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
        // console.log(response);
        setResults(response.data); // Set results with the fetched data
      } catch (error) {
        console.error("Error fetching top 10 popular datasets:", error);
      }
    };
    fetchMostPopularDatasets();
  }, [setResults]); // Dependency array includes setResults

  const [messages, setMessages] = useState<MessageProps[]>([
    {
      id: 1,
      text: "Hello, I am ChatGPT! Please start your dataset search with a task.",
      sender: "system",
      show: true
    },
  ]);

  const [task, setTask] = useState<string>("");
  const [filters, setFilters] = useState<string[]>([]);
  const [iconVisibility, setIconVisibility] = useState<boolean[]>(
    new Array(filters.length).fill(true)
  );

  return (
    <div className={`chat-container ${chatOpen ? "" : "closed"}`}>
      <div
        className="arrow-container"
        onClick={() => {
          setChatOpen(!chatOpen);
        }}
      >
        {chatOpen ? <ArrowRightToLine /> : <ArrowLeftFromLine />}
      </div>
      {/* <div className="chat-button">Chat Open</div> */}
      {chatOpen && (
        <>
          <QueryBlocks
            task={task}
            setTask={setTask}
            filters={filters}
            setFilters={setFilters}
            iconVisibility={iconVisibility}
            setIconVisibility={setIconVisibility}
            messages={messages}
            setMessages={setMessages}
          />
          <ChatBot
            setResults={setResults}
            setTask={setTask}
            setFilters={setFilters}
            setIconVisibility={setIconVisibility}
            messages={messages}
            setMessages={setMessages}
          />
        </>
      )}
    </div>
  );
};

export default ChatContainer;
