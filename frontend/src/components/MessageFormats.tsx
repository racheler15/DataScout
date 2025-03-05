import axios from "axios";
import "../styles/MessageItem.css";
import React from "react";
import { useState } from "react";
interface SettingsProps {
  settingsSpecificity: string;
  setSettingsSpecificity: React.Dispatch<React.SetStateAction<string>>;
  settingsGoal: string;
  setSettingsGoal: React.Dispatch<React.SetStateAction<string>>;
  settingsDomain: string;
  setSettingsDomain: React.Dispatch<React.SetStateAction<string>>;
  settingsGenerate: boolean;
  setSettingsGenerate: React.Dispatch<React.SetStateAction<boolean>>;
  onStart: () => void;
  setTaskRec: React.Dispatch<React.SetStateAction<[string, any][]>>;
}

const Settings = ({
  settingsSpecificity,
  setSettingsSpecificity,
  setSettingsGoal,
  settingsGoal,
  settingsDomain,
  setSettingsDomain,
  settingsGenerate,
  setSettingsGenerate,
  onStart,
  setTaskRec,
}: SettingsProps) => {
  const taskOptions = ["I have a specific task", "I am exploring"];
  const [goalOptions, setGoalOptions] = useState([
    "Analyze",
    "Identify",
    "Evaluate",
    "Compare",
    "Build",
    "Investigate",
    "Not sure yet",
    "+ Add other option",
  ]);
  const [showInput, setShowInput] = useState(false);
  const [newGoal, setNewGoal] = useState("");

  const handleTaskTypeChange = (type: string) => {
    setSettingsSpecificity(type);
  };

  const handleGoalSelection = (goal: string) => {
    if (goal === "+ Add other option") {
      setShowInput(true);
    } else {
      setSettingsGoal(goal);
    }
  };

  const handleAddNewGoal = () => {
    if (newGoal.trim()) {
      setGoalOptions([
        ...goalOptions.slice(0, -1),
        newGoal,
        "+ Add other option",
      ]);
      setSettingsGoal(newGoal);
      setNewGoal("");
      setShowInput(false);
    }
  };

  const handleKeywordsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSettingsDomain(e.target.value);
  };

  const fetchTaskSuggestions = async () => {
    const taskSuggestionsURL =
      "http://127.0.0.1:5000/api/initial_task_suggestions";
    console.log(settingsSpecificity);
    console.log(settingsGoal);
    console.log(settingsDomain);
    const searchResponse = await axios.post(taskSuggestionsURL, {
      // thread_id: threadId,
      specificity: settingsSpecificity,
      goal: settingsGoal,
      domain: settingsDomain,
    });
    console.log(searchResponse.data);
    const querySuggestions = searchResponse.data.query_suggestions;
    console.log(querySuggestions);
    const queryObject =
      typeof querySuggestions === "string"
        ? JSON.parse(querySuggestions)
        : querySuggestions;
    const queryArray = Object.entries(queryObject);
    console.log(queryArray);
    setTaskRec(queryArray);
  };

  const handleGenerateChange = () => {
    setSettingsGenerate(true);
    fetchTaskSuggestions();
    onStart();
    console.log(settingsGenerate);
    console.log("Specificity:", settingsSpecificity);
    console.log("Goal:", settingsGoal);
    console.log("Domain:", settingsDomain);
  };

  return (
    <div className="settings-container">
      <div className="settings-title"></div>
      <h4>
        1. Do you have a specific task in mind, or are you exploring available
        options?
      </h4>
      <div className="settings-options">
        {taskOptions.map((option) => (
          <button
            key={option}
            onClick={() => handleTaskTypeChange(option)}
            className="settings-button"
            style={{
              backgroundColor:
                settingsSpecificity === option ? "#007bff" : "#f9f9f9",
              color: settingsSpecificity === option ? "white" : "black",
            }}
          >
            {option}
          </button>
        ))}
      </div>

      <h4>2. What is the primary goal of your task?</h4>
      <div style={{ marginBottom: "12px" }}>
        {goalOptions.map((goal) => (
          <button
            className="settings-button"
            key={goal}
            onClick={() => handleGoalSelection(goal)}
            style={{
              backgroundColor: settingsGoal === goal ? "#007bff" : "#f9f9f9",
              color: settingsGoal === goal ? "white" : "black",
            }}
          >
            {goal}
          </button>
        ))}
        {showInput && (
          <div className="settings-newGoal" style={{ marginTop: "8px" }}>
            <input
              type="text"
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              placeholder="Enter new goal"
              style={{
                padding: "4px 12px",
                width: "50%",
                marginLeft: "5px",
                marginRight: "5px",
                borderRadius: "10px",
                border: "1px solid #ccc",
              }}
            />
            <button
              onClick={handleAddNewGoal}
              style={{
                padding: "5px 10px",
                backgroundColor: "#007bff",
                color: "white",
                borderRadius: "5px",
                border: "none",
                cursor: "pointer",
              }}
            >
              Add
            </button>
          </div>
        )}
      </div>

      <h4>3. What domains/subjects are you interested in? Provide keywords.</h4>
      <div className="settings-interest">
        <textarea
          id="keywords"
          value={settingsDomain}
          onChange={handleKeywordsChange}
          rows={3}
          placeholder="E.g., healthcare, finance, machine learning..."
        />
      </div>

      <button
        style={{
          borderRadius: "12px",
          marginTop: "12px",
          background: "#b2caff",
        }}
        onClick={handleGenerateChange}
      >
        Get Started
      </button>
    </div>
  );
};

export default Settings;
