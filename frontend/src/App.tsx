import "./App.css";
import ResultsTable, { ResultProp } from "./components/ResultsTable";
import { useState,  } from "react";
import LandingPage from "./components/LandingPage";
import ChatContainer from "./components/ChatContainer";

export interface MetadataFilter {
  type: "knn" | "normal"; // Add other types as needed
  filter: string; // The whole filter
  value: string;
  operand: string;
  subject: string;
  visible: boolean;
  active: boolean; // for active knn filters when new task
}

function App() {
  const [chatOpen, setChatOpen] = useState(true);
  const [results, setResults] = useState<ResultProp[]>([]);
  const [showLanding, setShowLanding] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [task, setTask] = useState<string>("");
  const [settingsSpecificity, setSettingsSpecificity] = useState<string>("");
  const [settingsGoal, setSettingsGoal] = useState<string>("");
  const [settingsDomain, setSettingsDomain] = useState<string>("");
  const [settingsGenerate, setSettingsGenerate] = useState(false);
  const [taskRec, setTaskRec] = useState<[string, string][]>([]);
  const [filters, setFilters] = useState<MetadataFilter[]>([]);
  // prevent back refresh

  return showLanding ? (
    <LandingPage
      task={task}
      setTask={setTask}
      results={results}
      setResults={setResults}
      settingsSpecificity={settingsSpecificity}
      setSettingsSpecificity={setSettingsSpecificity}
      settingsGoal={settingsGoal}
      setSettingsGoal={setSettingsGoal}
      settingsDomain={settingsDomain}
      setSettingsDomain={setSettingsDomain}
      settingsGenerate={settingsGenerate}
      setSettingsGenerate={setSettingsGenerate}
      onStart={() => setShowLanding(false)}
      setTaskRec={setTaskRec}
      taskRec={taskRec}
    />
  ) : (
    <div className={`app-container ${chatOpen ? "" : "chat-close"}`}>
      <ChatContainer
        chatOpen={chatOpen}
        setChatOpen={setChatOpen}
        results={results}
        setResults={setResults}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        task={task}
        setTask={setTask}
        settingsSpecificity={settingsSpecificity}
        setSettingsSpecificity={setSettingsSpecificity}
        settingsGoal={settingsGoal}
        setSettingsGoal={setSettingsGoal}
        settingsDomain={settingsDomain}
        setSettingsDomain={setSettingsDomain}
        settingsGenerate={settingsGenerate}
        setSettingsGenerate={setSettingsGenerate}
        setTaskRec={setTaskRec}
        taskRec={taskRec}
        filters={filters}
        setFilters={setFilters}
      />
      <ResultsTable
        results={results}
        open={chatOpen}
        onResetSearch={async () => {}}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        task={task}
        filters={filters}
      />
    </div>
  );
}

export default App;
