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
  setTaskRec: React.Dispatch<React.SetStateAction<[string, string, string[]][]>>;
  taskRec: [string, string, string[]][];
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
