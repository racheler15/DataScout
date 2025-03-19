import React, { useState } from "react";
import "../styles/LandingPage.css";
import Settings from "./MessageFormats";
import { ResultProp } from "./ResultsTable";
import axios from "axios";

interface LandingPageProps {
  onStart: () => void;
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
  results: ResultProp[];
  setResults: (a: ResultProp[]) => unknown;
  threadId: string;
  setTaskRec: React.Dispatch<React.SetStateAction<[string, string][]>>;
  taskRec: [string, string][];

}

const LandingPage: React.FC<LandingPageProps> = ({
  task,
  setTask,
  onStart,
  settingsSpecificity,
  setSettingsSpecificity,
  setSettingsGoal,
  settingsGoal,
  settingsDomain,
  setSettingsDomain,
  settingsGenerate,
  setSettingsGenerate,
  results,
  setResults,
  threadId,
  setTaskRec,
  taskRec
}) => {
  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempTask(e.target.value);
  };

  const fetchData = async () => {
    console.log("hyse search");
    try {
      const searchResponse = await axios.post(
        "http://127.0.0.1:5000/api/hyse_search",
        {
          query: tempTask,
        }
      );
      console.log("FETCHED DATA FROM HYSE:", searchResponse);
      console.log("SETTING RESULTS");
      setResults(searchResponse.data.complete_results);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault(); // Prevents form from reloading the page
      setTask(tempTask);
      fetchData();
      onStart();
      setTempTask("");
    }
  };

  const [tempTask, setTempTask] = useState("");
  return (
    <div className="landing-container">
      <div className="search-path">
        {" "}
        <h1 style={{ fontSize: "50px" }}>Dataset Search</h1>
        <p>Finding datasets dynamically with ease.</p>
        <form className="search-form">
          <input
            type="text"
            value={tempTask}
            onChange={handleSearchChange}
            onKeyDown={handleKeyPress}
            placeholder="Search for datasets..."
            className="search-input"
          />
        </form>
      </div>

      <div className="system-path">
        <h2>Getting started?</h2>
        <p>
          Answer a few questions to help you get started and brainstorm ideas
          for your task.
        </p>
        <div className="settings-block">
          <Settings
            settingsSpecificity={settingsSpecificity}
            setSettingsSpecificity={setSettingsSpecificity}
            settingsGoal={settingsGoal}
            setSettingsGoal={setSettingsGoal}
            settingsDomain={settingsDomain}
            setSettingsDomain={setSettingsDomain}
            settingsGenerate={settingsGenerate}
            setSettingsGenerate={setSettingsGenerate}
            onStart={onStart}
            taskRec={taskRec}
            setTaskRec={setTaskRec}
            setTask = {setTask}
            setResults={setResults}
          />
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
