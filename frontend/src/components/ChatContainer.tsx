import { MessageProps } from "./MessageItem";
import QueryBlocks from "./QueryBlocks";
import "../styles/ChatContainer.css";
import { ResultProp } from "./ResultsTable";
import {  useState } from "react";
import { MetadataFilter } from "../App";

interface ChatContainerProps {
  chatOpen: boolean;
  setChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setResults: (a: ResultProp[]) => unknown;
  results: ResultProp[];
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  task: string;
  setTask: React.Dispatch<React.SetStateAction<string>>;
  settingsSpecificity: string;
  setSettingsSpecificity: React.Dispatch<React.SetStateAction<string>>;
  settingsGoal: string;
  setSettingsGoal: React.Dispatch<React.SetStateAction<string>>;
  settingsDomain: string;
  setSettingsDomain: React.Dispatch<React.SetStateAction<string>>;
  settingsGenerate: boolean;
  setSettingsGenerate: React.Dispatch<React.SetStateAction<boolean>>;
  setTaskRec: React.Dispatch<React.SetStateAction<[string, string][]>>;
  taskRec: [string, string][];
  filters: MetadataFilter[];
  setFilters: React.Dispatch<React.SetStateAction<MetadataFilter[]>>;
}

const ChatContainer: React.FC<ChatContainerProps> = ({
  chatOpen,
  setResults,
  results,
  currentPage,
  setCurrentPage,
  task,
  setTask,
  settingsGenerate,
  setSettingsGenerate,
  setTaskRec,
  taskRec,
  setFilters,
  filters
}) => {

 
  const [messages, setMessages] = useState<MessageProps[]>([
    {
      id: 1,
      text: "Hello, I am ChatGPT! To start off, let’s try to construct an initial descriptive task for better search results.",
      sender: "system",
      show: true,
      type: "general",
    },
    {
      id: 2,
      text: "",
      sender: "system",
      show: true,
      type: "system_agent",
    },
    // {
    //   id: 3,
    //   text: JSON.stringify(suggested_tasks),
    //   sender: "system",
    //   show: true,
    //   type: "task_agent",
    // },
    // {
    //   id: 4,
    //   text: JSON.stringify(suggested_metadata),
    //   sender: "system",
    //   show: true,
    //   type: "metadata_agent",
    // },
  ]);

  const [iconVisibility, setIconVisibility] = useState<boolean[]>(
    new Array(filters.length).fill(true)
  );

  const [pendingFilter, setPendingFilter] = useState<string | null>(null);

  return (
    <div className={`chat-container ${chatOpen ? "" : "closed"}`}>
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
            pendingFilter={pendingFilter}
            setPendingFilter={setPendingFilter}
            results={results}
            setResults={setResults}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            settingsGenerate={settingsGenerate}
            setSettingsGenerate={setSettingsGenerate}
            setTaskRec={setTaskRec}
            taskRec={taskRec}
          />
        </>
      )}
    </div>
  );
};

export default ChatContainer;
