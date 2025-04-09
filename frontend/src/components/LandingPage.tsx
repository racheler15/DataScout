import React, { useState } from "react";
import "../styles/LandingPage.css";
import Settings from "./MessageFormats";
import { ResultProp } from "./ResultsTable";
import axios from "axios";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";

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
  setTaskRec: React.Dispatch<React.SetStateAction<[string, string, string[]][]>>;
  taskRec: [string, string, string[]][];
}

const LandingPage: React.FC<LandingPageProps> = ({
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
  setResults,
  setTaskRec,
  taskRec,
}) => {
  const [tempTask, setTempTask] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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
      setResults(searchResponse.data.complete_results);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setTask(tempTask);
      fetchData();
      onStart();
      setTempTask("");
    }
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  return (
    <div className="landing-container">
      <div className="search-path">
        <h1 style={{ fontSize: "50px" }}>DataScout</h1>
        <form className="search-form">
          <input
            type="text"
            value={tempTask}
            onChange={handleSearchChange}
            onKeyDown={handleKeyPress}
            placeholder="Elaborate your task query in detail, or enter phrases and keywords..."
            className="search-input"
          />
        </form>
      </div>

      <div className="system-path">
        <div
          className="dropdown-header"
          onClick={toggleDropdown}
          style={{ cursor: "pointer", display: "flex", alignItems: "center" }}
        >
          <h2>Getting started?</h2>
          <span style={{ marginLeft: "10px" }}>
            {isDropdownOpen ? (
              <ArrowDropUpIcon style={{ height: "40px", width: "40px" }} />
            ) : (
              <ArrowDropDownIcon style={{ height: "40px", width: "40px" }} />
            )}
          </span>
        </div>

        {isDropdownOpen && (
          <>
            <p>
              Answer a few questions to help you get started and brainstorm
              ideas for your task.
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
                setTask={setTask}
                setResults={setResults}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LandingPage;
