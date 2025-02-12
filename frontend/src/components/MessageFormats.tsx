import axios from "axios";
import "../styles/MessageItem.css";
import React from "react";
import SettingsIcon from "@mui/icons-material/Settings";
import { useState } from "react";


interface SettingsProps {
  settingsSpecificity: string;
  setSettingsSpecificity: React.Dispatch<React.SetStateAction<string>>;
  settingsGoal: string;
  setSettingsGoal: React.Dispatch<React.SetStateAction<string>>;
  settingsDomain: string;
  setSettingsDomain: React.Dispatch<React.SetStateAction<string>>;
  settingsGenerate: boolean;
  setSettingsGenerate:  React.Dispatch<React.SetStateAction<boolean>>;
}

const Settings = ({
  settingsSpecificity,
  setSettingsSpecificity,
  setSettingsGoal,
  settingsGoal,
  settingsDomain,
  setSettingsDomain,
  settingsGenerate,
  setSettingsGenerate
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

  const handleGenerateChange = () => {
    setSettingsGenerate(true);
    console.log(settingsGenerate)
    console.log("Specificity:", settingsSpecificity);
    console.log("Goal:", settingsGoal);
    console.log("Domain:", settingsDomain);
  };

  return (
    <div className="settings-container">
      <div className="settings-title">
        <h4>Task Brainstorming</h4>
        <SettingsIcon
          style={{
            fontSize: 40,
            color: "gray",
            position: "absolute",
            right: "0px",
            bottom: "0",
          }}
        />
      </div>
      <h6>
        Do you have a specific task in mind, or are you exploring available
        options?
      </h6>
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

      <h6>What is the primary goal of your task?</h6>
      <div style={{ marginBottom: "20px" }}>
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
          <div className = "settings-newGoal" style={{ marginTop: "10px" }}>
            <input
              type="text"
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              placeholder="Enter new goal"
              style={{
                padding: "4px 12px",
                width: "50%",
                marginLeft:"5px",
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

      <h6>What domains/subjects are you interested in? Provide keywords.</h6>
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
        Generate
      </button>
    </div>
  );
};

export default Settings;


