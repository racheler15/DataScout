import axios from "axios";
import "../styles/MessageItem.css";
import React from "react";
import { useState } from "react";
import { ResultProp } from "./ResultsTable";

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
  setTaskRec: React.Dispatch<React.SetStateAction<[string, string,string[]][]>>;
  setResults: (a: ResultProp[]) => unknown;
  setTask: React.Dispatch<React.SetStateAction<string>>;
  taskRec: [string, string,string[]][];
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
  setResults,
  setTask,
}: SettingsProps) => {
  const taskOptions = ["I have a specific task", "I am exploring"];
  const [goalOptions, setGoalOptions] = useState([
    "Train a classifier",
    "Train a regression model",
    "Supervised learning",
    "Unsupervised learning",
    "Visualization",
    "LLM pretraining",
    "LLM finetuning",
    "Question-Answering",
    "Analyze",
    "Not sure yet",
    // "+ Add option",
  ]);
  const [showInput, setShowInput] = useState(false);
  const [newGoal, setNewGoal] = useState("");

  const handleTaskTypeChange = (type: string) => {
    setSettingsSpecificity(type);
    if (type === "I am exploring") {
      setSettingsGoal(""); // Reset goal if exploring
    }
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
    console.log("FETCH TASK SUGGESTIONS");
    const taskSuggestionsURL =
      "http://127.0.0.1:5000/api/initial_task_suggestions";
    console.log(settingsSpecificity);
    console.log(settingsGoal);
    console.log(settingsDomain);
    const searchResponse = await axios.post(taskSuggestionsURL, {
      specificity: settingsSpecificity,
      goal: settingsGoal,
      domain: settingsDomain,
    });
    console.log(searchResponse.data);
    const querySuggestions = searchResponse.data.query_suggestions;
    const queryObject =
      typeof querySuggestions === "string"
        ? JSON.parse(querySuggestions)
        : querySuggestions;
    const queryArray = Object.entries(queryObject);
    console.log("QUERY ARRAY", queryArray);
    setTaskRec(queryArray.map(([key, value]) => [key, String(value), []])); // FIX: TODO 
  };

  const handleGenerateChange = () => {
    console.log("HANDLEGENERATECHANGE");
    setSettingsGenerate(true);
    fetchTaskSuggestions();
    setTask(settingsDomain);
    fetchData();
    onStart();
    console.log(settingsGenerate);
    console.log("Specificity:", settingsSpecificity);
    console.log("Goal:", settingsGoal);
    console.log("Domain:", settingsDomain);
  };

  const fetchData = async () => {
    console.log("hyse search");
    try {
      const searchResponse = await axios.post(
        "http://127.0.0.1:5000/api/hyse_search",
        {
          query: settingsDomain,
        }
      );
      console.log("FETCHED DATA FROM HYSE:", searchResponse);
      console.log("SETTING RESULTS");
      setResults(searchResponse.data.complete_results);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
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

      {/* Conditionally render the goal section */}
      {settingsSpecificity === "I have a specific task" && (
        <>
          <h4>What is the primary goal of your task?</h4>
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
        </>
      )}

      <h4>2. What do you specifically want to do? Provide keywords or a sentence on the task you're interested in. </h4>
      <div className="settings-interest">
        <textarea
          id="keywords"
          value={settingsDomain}
          onChange={handleKeywordsChange}
          rows={3}
          placeholder="E.g., 'finance', 'predicting stock prices', 'I would like to build a machine learning model to predict stock prices'"
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