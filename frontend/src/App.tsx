import "./App.css";
import ResultsTable, { ResultProp } from "./components/ResultsTable";
import { useState, useEffect } from "react";
import LandingPage from "./components/LandingPage";
import ChatContainer from "./components/ChatContainer";
import axios from "axios";

export interface MetadataFilter {
  type: "knn" | "normal"; // Add other types as needed
  filter: string; // The whole filter
  value: string;
  operand: string;
  subject: string;
  visible: boolean;
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
  const [threadId, setThreadId] = useState("");
  const [taskRec, setTaskRec] = useState<[string, string][]>([]);
  const [filters, setFilters] = useState<MetadataFilter[]>([]);


  // useEffect(() => {
  //   if (task) {
  //     console.log("Task bar updated:", task);
  //     fetchData();
  //     // taskSuggestions();
  //     // metadataSuggestions();
  //   }
  // }, [task]); // Dependency array includes only taskBar

  // called when component mounts
  const startNewThread = async () => {
    try {
      const response = await axios.post("http://127.0.0.1:5000/api/start_chat");
      const { thread_id } = response.data;
      sessionStorage.setItem("threadId", thread_id); // Data stored in sessionStorage is available only for the current session
      setThreadId(thread_id);
    } catch (error) {
      console.error("Error starting a new thread:", error);
    }
  };

  useEffect(() => {
    startNewThread();
    // Empty dependency array means this effect runs once when the component mounts
  }, []);


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
      threadId={threadId}
      setTaskRec={setTaskRec}
      taskRec = {taskRec}

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
        taskRec = {taskRec}
        filters = {filters}
        setFilters = {setFilters}
      />
      <ResultsTable
        results={results}
        open={chatOpen}
        onResetSearch={async () => {}}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        task = {task}
        filters = {filters}
      />
    </div>
  );
}

export default App;
