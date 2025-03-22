import "../styles/MessageItem.css";
import React, { useState, useEffect } from "react";
import { VegaLite } from "react-vega";
import Settings from "./MessageFormats";
import RangeSlider from "./RangeSlider";

export interface MessageProps {
  id: number;
  text: string | React.ReactNode;
  sender: "user" | "system";
  show: boolean;
  type:
    | "task_agent"
    | "metadata_agent"
    | "system_agent"
    | "general"
    | "vega-test";
}

export interface MessageItemProps {
  message: MessageProps;
  messages: MessageProps[];
  task: string;
  setTask: (task: string) => void;
  filters: string[];
  setFilters: React.Dispatch<React.SetStateAction<string[]>>;
  settingsSpecificity: string;
  setSettingsSpecificity: React.Dispatch<React.SetStateAction<string>>;
  settingsGoal: string;
  setSettingsGoal: React.Dispatch<React.SetStateAction<string>>;
  settingsDomain: string;
  setSettingsDomain: React.Dispatch<React.SetStateAction<string>>;
  settingsGenerate: boolean;
  setSettingsGenerate: React.Dispatch<React.SetStateAction<boolean>>;
  pendingFilter: string | null;
  setPendingFilter: React.Dispatch<React.SetStateAction<string | null>>;
}

const MessageItem = ({
  message,
  messages,
  task,
  setTask,
  filters,
  setFilters,
  settingsSpecificity,
  setSettingsSpecificity,
  setSettingsGoal,
  settingsGoal,
  settingsDomain,
  setSettingsDomain,
  settingsGenerate,
  setSettingsGenerate,
  pendingFilter,
  setPendingFilter,
}: MessageItemProps) => {
  const senderStyle = {
    color: message.sender === "user" ? "#3D5D9F" : "#A02A2A",
    paddingRight: message.sender === "user" ? "20px" : "0px",
  };
  const [selectedTask, setSelectedTask] = useState<string[]>([]);
  const [range, setRange] = useState<number[]>([]);
  const [firstMetadata, setFirstMetadata] = useState(true);
  const [selectedOperator, setSelectedOperator] = useState<string>("<");
  const [value, setValue] = useState<number>(0); // Convert to number
  const [attributeType, setAttributeType] = useState("");
  const [outliers, setOutliers] = useState([]);
  const [minValue, setMinValue] = useState(0);
  const [maxValue, setMaxValue] = useState(Infinity);

  // format: [displayed text, vegalite graph, reasons...]

  useEffect(() => {
    if (
      firstMetadata &&
      message.text &&
      typeof message.text === "string" &&
      message.type === "metadata_agent"
    ) {
      try {
        const parsedText = JSON.parse(message.text);
        console.log("RECEIVED MESSAGEITEM: ", parsedText);
        const firstTask = Object.entries(parsedText)[0];

        if (firstTask) {
          const values = firstTask[1] as string[];
          const valueArray = Array.isArray(values) ? values : [values];
          setSelectedTask(valueArray); // Set the first option as the default

          const numValue = Number(values[3]);
          if (!isNaN(numValue)) {
            setValue(numValue);
          } else {
            console.log("Invalid number at values[3]. Setting to default.");
            setValue(0);
          }
          setAttributeType(values[4]);
        }

        setFirstMetadata(false);
      } catch (error) {
        console.error("Error parsing message.text:", error);
      }
    }
  }, [firstMetadata]);

  const handleMetadataClick = () => {
    const newFilter = `${minValue} <= ${selectedTask[0]} <= ${maxValue}`;
    console.log("SUBMITTED NEW FILTER:", newFilter);
    setPendingFilter(newFilter);
  };

  const changeMetadata = (value: string) => {
    console.log("Selected Value:", value);
    try {
      const selectedTaskValue = JSON.parse(value); // ✅ Safely parse JSON
      const type = selectedTaskValue[4];
      if (type !== "TEXT") {
        console.log("UPDATING RANGE");
        const data = JSON.parse(selectedTaskValue[1]);
        const sortedData = [...data].sort((a, b) => a - b);
        const range: [number, number] = [
          sortedData[0],
          sortedData[sortedData.length - 1],
        ];
        setRange(range);
        console.log("NEW RANGE", range);
      }
      setSelectedTask(selectedTaskValue); // ✅ Update state
    } catch (error) {
      console.error("Error parsing metadata:", error);
    }
  };

  return (
    <div className="message-container">
      {/* <div className={`message-container ${message.show ? "" : "show"}`}> */}

      {message.show && (
        <>
          {message.type === "task_agent" ? (
            // Case 1: Task, input "{rec: reason}""
            <div className="task-message-container" style={{ width: "100%" }}>
              <div style={{ marginBottom: "4px" }}>
                <b>I. Task Recommendations:</b>
              </div>
              {message.text && typeof message.text === "string"
                ? (() => {
                    const parsedText = JSON.parse(message.text);
                    return Object.entries(parsedText).map(
                      ([key, value], index) => {
                        return (
                          <TaskSuggestionBlock
                            key={key}
                            recommendation={key}
                            reason={String(value)}
                            setTask={setTask}
                          />
                        );
                      }
                    );
                  })()
                : null}
            </div>
          ) : message.type === "metadata_agent" ? (
            // Case 2: Metadata
            <div
              className="metadata-message-container"
              style={{ width: "100%" }}
            >
              <div className="metadata-dropdown-container">
                <b>II. Metadata Recommendations:</b>
                <div style={{ display: "flex", gap: "12px" }}>
                  <select
                    className="metadata-dropdown"
                    onChange={(e) => changeMetadata(e.target.value)}
                  >
                    {message.text && typeof message.text === "string"
                      ? (() => {
                          const parsedText = JSON.parse(message.text);
                          return Object.entries(parsedText).map(
                            ([preview, values], index) => {
                              // Ensure values is an array
                              const valueArray = Array.isArray(values)
                                ? values
                                : [values];

                              return (
                                <option
                                  key={index}
                                  value={JSON.stringify(valueArray)}
                                >
                                  {preview}
                                </option>
                              );
                            }
                          );
                        })()
                      : null}
                  </select>
                  <button
                    onClick={() => handleMetadataClick()}
                    className="metadata-button"
                  >
                    try
                  </button>
                </div>
              </div>
              {selectedTask.length > 0 && (
                <MetadataSuggestionBlock
                  selectedTask={selectedTask}
                  recommendation={selectedTask[0]}
                  schema={selectedTask[1]}
                  reason={selectedTask[2]}
                  selectedOperator={selectedOperator}
                  setSelectedOperator={setSelectedOperator}
                  suggestedValue={Number(selectedTask[3])}
                  filters={filters}
                  setFilters={setFilters}
                  setValue={setValue}
                  value={value}
                  pendingFilter={pendingFilter}
                  setPendingFilter={setPendingFilter}
                  attributeType={selectedTask[4]}
                  outliers={selectedTask[5]}
                  setMaxValue={setMaxValue}
                  setMinValue={setMinValue}
                  minValue={minValue}
                  maxValue={maxValue}
                />
              )}
            </div>
          ) : message.type === "vega-test" ? (
            (() => {
              try {
                if (typeof message.text === "string") {
                  const spec = JSON.parse(message.text);
                  return <VegaLite spec={spec} />;
                } else {
                  throw new Error(
                    "VegaLite specification is not a valid string."
                  );
                }
              } catch (error) {
                console.error("Error parsing VegaLite spec:", error);
                return <div>Error rendering VegaLite chart.</div>;
              }
            })()
          ) : message.type === "system_agent" ? (
            // Case 3: Settings
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
              }}
            >
              <Settings
                settingsSpecificity={settingsSpecificity}
                setSettingsSpecificity={setSettingsSpecificity}
                settingsGoal={settingsGoal}
                setSettingsGoal={setSettingsGoal}
                settingsDomain={settingsDomain}
                setSettingsDomain={setSettingsDomain}
                settingsGenerate={settingsGenerate}
                setSettingsGenerate={setSettingsGenerate}
              />
            </div>
          ) : (
            // Case 4: General type (default)
            <div className="general-message">
              <div className="user" style={senderStyle}>
                {message.sender === "user" ? "User:" : "System:"}{" "}
              </div>
              <div className="text">{message.text}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
export default MessageItem;

interface TaskSuggestionBlockProps {
  recommendation: string;
  reason: string;
  setTask: (task: string) => void;
}

const TaskSuggestionBlock = ({
  recommendation,
  reason,
  setTask,
}: TaskSuggestionBlockProps) => {
  return (
    <div className="task-suggestion-block-container">
      <div
        className="task-suggestion"
        style={{ position: "relative", width: "95%" }}
      >
        <ul style={{ margin: 0 }}>
          <li>
            {recommendation}
            <div className="tooltip" style={{ fontSize: "12px" }}>
              {reason}
            </div>
          </li>
        </ul>
      </div>

      <button
        onClick={() => setTask(recommendation)}
        className="task-suggestion-button"
      >
        try
      </button>
    </div>
  );
};

interface MetadataSuggestionBlockProps {
  selectedTask: string[];
  recommendation: string;
  schema: string;
  reason: string;
  selectedOperator: string;
  setSelectedOperator: (selectedOperator: string) => void;
  suggestedValue: number;
  filters: string[];
  setFilters: React.Dispatch<React.SetStateAction<string[]>>;
  value: number;
  setValue: React.Dispatch<React.SetStateAction<number>>;
  pendingFilter: string | null;
  setPendingFilter: React.Dispatch<React.SetStateAction<string | null>>;
  attributeType: string;
  outliers: string;
  minValue: number;
  setMinValue: React.Dispatch<React.SetStateAction<number>>;
  maxValue: number;
  setMaxValue: React.Dispatch<React.SetStateAction<number>>;
}

const MetadataSuggestionBlock = ({
  selectedTask,
  recommendation,
  schema,
  reason,
  selectedOperator,
  setSelectedOperator,
  suggestedValue,
  filters,
  setFilters,
  value,
  setValue,
  pendingFilter,
  attributeType,
  setPendingFilter,
  outliers,
  minValue,
  maxValue,
  setMaxValue,
  setMinValue,
}: MetadataSuggestionBlockProps) => {
  const [sliderValue, setSliderValue] = useState(suggestedValue);

  console.log("DATA", schema);
  return (
    <div>
      <div className="task-reason">
        <ul>
          <li>
            <i>Why?</i> {reason}
          </li>
          <li>Median value: {suggestedValue}</li>
          <li>{outliers} outliers in 100 datasets</li>
        </ul>
      </div>
      {attributeType === "TEXT" ? (
        <VegaLite spec={JSON.parse(schema)} style={{ width: "100%" }} />
      ) : (
        <>
          <RangeSlider
            data={JSON.parse(schema)}
            minValue={minValue}
            setMinValue={setMinValue}
            maxValue={maxValue}
            setMaxValue={setMaxValue}
          />
        </>
      )}

      {/* <div className="suggestions-display">
        {selectedTask.length > 0 && (
          <>
            <div className="metadata-message-prompt-container">
              <div className="metadata-message-prompt">{recommendation}</div> */}
      {/* <select
                value={selectedOperator}
                onChange={(e) => setSelectedOperator(e.target.value)}
                className="metadata-dropdown"
              >
                <option value="<">{"<"}</option>
                <option value=">">{">"}</option>
                <option value="<=">{"<="}</option>
                <option value=">=">{">="}</option>
              </select>
              <div className="metadata-message-prompt">{sliderValue}</div> */}
      {/* </div>

            {selectedTask.length > 1 && (
              <div className="task-reason">
                <div style={{ padding: "8px", display: "flex" }}>
                  <RangeSlider data={prices} />

                  <VegaLite
                    spec={JSON.parse(schema)}
                    style={{ width: "100%" }}
                    // signalListeners={{ highlightBin: handleSignalUpdate }}
                  />
                </div>

                <i>Why?</i>
                <ul>
                  <li>{reason}</li>
                </ul>
              </div>
            )}
          </>
        )}
        <div style={{ marginBottom: "40px" }}></div> */}

      {/* <button onClick={() => handleClick()} className="metadata-button">
          try
        </button>
      </div> */}
    </div>
  );
};
