import "../styles/QueryBlocks.css";
import { useEffect, useState, useRef } from "react";
import { Icon } from "@iconify/react";
import eyeIcon from "@iconify-icons/fluent/eye-20-regular";
import eyeOffIcon from "@iconify-icons/fluent/eye-off-20-regular";
import { X } from "lucide-react";
import FilterPrompt from "./FilterPrompt";
import { MessageProps } from "./MessageItem";
import axios from "axios";
import { ResultProp } from "./ResultsTable";
import "../styles/MessageItem.css";

interface QueryBlocksProps {
  task: string;
  setTask: React.Dispatch<React.SetStateAction<string>>;
  filters: string[];
  setFilters: React.Dispatch<React.SetStateAction<string[]>>;
  iconVisibility: boolean[];
  setIconVisibility: React.Dispatch<React.SetStateAction<boolean[]>>;
  messages: MessageProps[];
  setMessages: React.Dispatch<React.SetStateAction<MessageProps[]>>;
  pendingFilter: string | null;
  setPendingFilter: React.Dispatch<React.SetStateAction<string | null>>;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  results: ResultProp[];
  setResults: (a: ResultProp[]) => unknown;
}

interface FilterItemProps {
  filter: string;
  isVisible: boolean;
  onToggle: () => void;
  onRemove: () => void;
}

const QueryBlocks = ({
  task,
  setTask,
  filters,
  setFilters,
  iconVisibility,
  setIconVisibility,
  messages,
  setMessages,
  pendingFilter,
  setPendingFilter,
  results,
  setResults,
  currentPage,
  setCurrentPage,
}: QueryBlocksProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [input, setInput] = useState(""); // State to track user input
  const [taskRec, setTaskRec] = useState<string[]>([]);
  const [colRec, setColRec] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<boolean[]>(
    Array(5).fill(false)
  );
  const [datasetCount, setDatasetCount] = useState<number>(results.length);
  const [savedDatasets, setSavedDatasets] = useState<string[][]>([]);
  const [initialResults, setInitialResults] = useState<ResultProp[]>([]);
  const [activeColumns, setActiveColumns] = useState<string[]>([]);
  const [colsToRemove, setColsToRemove] = useState<string[]>([]);
  const [shouldProcess, setShouldProcess] = useState(false);
  const [shouldRemove, setShouldRemove] = useState(false);

  // const [mergedDatasets, setMergedDatasets] = useState<string[]>([]);

  const FilterItem: React.FC<FilterItemProps> = ({
    filter,
    isVisible,
    onToggle,
    onRemove,
  }) => {
    return (
      <div className={`filter-prompt ${isVisible ? "" : "hidden"}`}>
        <div style={{ flex: "0.95" }}>{filter}</div>
        <Icon
          icon={isVisible ? eyeIcon : eyeOffIcon}
          style={{ width: "24px", height: "24px", cursor: "pointer" }}
          onClick={onToggle}
        />
        <X size={24} style={{ cursor: "pointer" }} onClick={onRemove} />
      </div>
    );
  };

  const toggleIcon = (index: number) => {
    setIconVisibility((prev) => {
      const newVisibility = [...prev];
      newVisibility[index] = !newVisibility[index];
      return newVisibility;
    });
    setActiveColumns((prevActiveColumns) => {
      const filterToToggle = filters[index]; // Get the corresponding filter
      console.log(filterToToggle);

      if (!iconVisibility[index]) {
        // If the icon was previously hidden (false), add the filter back to activeColumns
        return [...prevActiveColumns, ...filterToToggle];
      } else {
        // If the icon was visible (true), remove the filter from activeColumns
        return prevActiveColumns.filter((col) => !filterToToggle.includes(col));
      }
    });
    setShouldRemove(true);
  };

  const removeFilter = (index: number) => {
    setFilters((prevFilters) => {
      const filterToRemove = prevFilters[index]; // Get the filter at the given index

      // Store the removed filter separately
      setColsToRemove((prev) => [...prev, filterToRemove]);

      const updatedFilters = prevFilters.filter((_, i) => i !== index); // Remove the filter
      setActiveColumns((prevActiveColumns) =>
        prevActiveColumns.filter((col) => !filterToRemove.includes(col))
      ); // Remove words from activeColumns

      return updatedFilters;
    });

    setIconVisibility((prev) => prev.filter((_, i) => i !== index)); // Update visibility state
    setShouldRemove(true);
  };

  useEffect(() => {
    if (colsToRemove.length > 0 && shouldRemove) {
      removeFilteredDatasets();
      setColsToRemove([]); // Reset after running
      setShouldRemove(false);
    }
  }, [colsToRemove, shouldRemove, activeColumns]);

  const removeFilteredDatasets = async () => {
    const filteredSavedDatasets = getFilteredSavedDatasets();
    console.log("FILTERED", filteredSavedDatasets);

    console.log("Final unique datasets REMOVE:", filteredSavedDatasets);

    const colFilteredURL = "http://127.0.0.1:5000/api/and_dataset_filter";
    try {
      const searchResponse = await axios.post(colFilteredURL, {
        task: task,
        results: initialResults,
        uniqueDatasets: filteredSavedDatasets,
      });
      console.log(searchResponse.data);

      // Update datasetCount based on the filtered results
      setDatasetCount(searchResponse.data.filtered_results.length);
      setResults(searchResponse.data.filtered_results);
    } catch (error) {
      console.error("Error fetching filtered datasets:", error);
    }
  };

  const getFilteredSavedDatasets = () => {
    // If no active columns are selected, return all datasets
    if (activeColumns.length === 0) {
      console.log("NO ACTIVE COLUMNS LEFT");
      console.log(savedDatasets);
      const uniqueDatasets = [...new Set(savedDatasets.flat())];
      return uniqueDatasets;
    }

    // Step 1: Find the original indices of activeColumns, excluding colStoreRemove
    const filteredColRec = Object.entries(colRec)
      .map(([key, value], originalIndex) => ({ key, value, originalIndex })) // Track original indices
      .filter(
        ({ value }) =>
          activeColumns.includes(value) && !colsToRemove.includes(value)
      ); // Exclude colStoreRemove items

    console.log("FILTEREDCOLREC", filteredColRec);

    // Step 2: Extract the corresponding datasets from savedDatasets
    const filteredSavedDatasets = filteredColRec.map(
      ({ originalIndex }) => savedDatasets[originalIndex]
    );

    const uniqueDatasets = filteredSavedDatasets.reduce((acc, curr) =>
      acc.filter((dataset) => curr.includes(dataset))
    );

    console.log("FILTERED", filteredSavedDatasets);
    console.log("UNIQUE", uniqueDatasets);

    return uniqueDatasets;
  };

  const handleClick = () => {
    setIsModalOpen(true); // Open the modal when "+" is clicked
  };

  useEffect(() => {
    if (pendingFilter) {
      // handleNewFilterSubmit(pendingFilter);
      setPendingFilter(null); // Reset after processing
    }
  }, [pendingFilter]);

  const generateTaskRec = async (task: string) => {
    try {
      const taskSuggestionsURL = "http://127.0.0.1:5000/api/task_suggestions";
      const searchResponse = await axios.post(taskSuggestionsURL, {
        task: task,
        filters: filters,
      });
      console.log("TASK REC", searchResponse.data);
      const querySuggestions = searchResponse.data.query_suggestions;
      const queryObject =
        typeof querySuggestions === "string"
          ? JSON.parse(querySuggestions)
          : querySuggestions;
      const queryArray = Object.entries(queryObject);
      setTaskRec(queryArray);
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error updating task rec:", error.message);
        alert(`Failed to update task rec: ${error.message}`);
      } else {
        console.error("Unexpected error:", error);
        alert("An unexpected error occurred.");
      }
    }
  };

  const generateColRec = async (task: string) => {
    try {
      const colSuggestionsURL =
        "http://127.0.0.1:5000/api/suggest_relevant_cols";
      console.log("SENDING COL SUGGESTION API");
      const searchResponse = await axios.post(colSuggestionsURL, {
        task: task,
        results: results,
      });
      console.log(searchResponse.data);
      console.log(searchResponse.data.columns_in_clusters);
      console.log(searchResponse.data.consolidated_results);
      console.log(searchResponse.data.datasets_in_clusters);

      setColRec(searchResponse.data.consolidated_results);
      setSavedDatasets(searchResponse.data.datasets_in_clusters);
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error updating col rec:", error.message);
        alert(`Failed to update col rec: ${error.message}`);
      } else {
        console.error("Unexpected error:", error);
        alert("An unexpected error occurred.");
      }
    }
  };
  // Filter colRec to exclude activeColumns and get the next top 5 cols
  const filteredColRecWithIndices = Object.entries(colRec)
    .map(([key, value], originalIndex) => ({ key, value, originalIndex })) // Track original indices
    .filter(({ value }) => !activeColumns.includes(value)) // Exclude active columns
    .slice(0, 5); // Get only the first 5

  const updateSelectedColumns = (index: number, isChecked: boolean) => {
    setSelectedColumns((prev) => {
      const updatedColumns = prev.map((val, i) =>
        i === index ? isChecked : val
      );
      return updatedColumns;
    });
    setShouldProcess(true);
  };

  useEffect(() => {
    if (shouldProcess) {
      processFilteredDatasets();
      setShouldProcess(false); // Reset the flag after processing
    }
  }, [selectedColumns, shouldProcess]);

  const processFilteredDatasets = async () => {
    console.log("SELECTED COLUMNS UPDATED");
    // Get the original indices of the current selected columns
    const selectedIndices = selectedColumns
      .map((isSelected, filteredIndex) =>
        isSelected
          ? filteredColRecWithIndices[filteredIndex].originalIndex
          : null
      )
      .filter((index) => index !== null) as number[];

    // Map these indices back to the original savedDatasets array
    const filteredDatasets = selectedIndices.map(
      (index) => savedDatasets[index]
    );

    console.log(
      "Filtered datasets before applying intersection:",
      filteredDatasets
    );

    let uniqueDatasets;
    if (filteredDatasets.length === 0) {
      uniqueDatasets = results.map((item) => item.table_name);
    } else {
      // Compute intersection of datasets
      uniqueDatasets = filteredDatasets.reduce((acc, curr) =>
        acc.filter((dataset) => curr.includes(dataset))
      );
    }

    console.log("Final unique datasets:", uniqueDatasets);

    const colFilteredURL = "http://127.0.0.1:5000/api/and_dataset_filter";
    try {
      // include only results that appear in uniqueDatasets
      const searchResponse = await axios.post(colFilteredURL, {
        task: task,
        results: results,
        uniqueDatasets: uniqueDatasets,
      });
      console.log(searchResponse.data);

      // Update datasetCount based on the filtered results
      setDatasetCount(searchResponse.data.filtered_results.length);
    } catch (error) {
      console.error("Error fetching filtered datasets:", error);
    }
  };

  const updateFilteredDatasets = async () => {
    // Get the indices of the selected columns
    const selectedIndices = selectedColumns
      .map((isSelected, filteredIndex) =>
        isSelected
          ? filteredColRecWithIndices[filteredIndex].originalIndex
          : null
      )
      .filter((index) => index !== null) as number[];

    // Map these indices back to the original savedDatasets array
    const filteredDatasets = selectedIndices.map(
      (index) => savedDatasets[index]
    );

    // Find unique datasets across all selected columns
    const uniqueDatasets =
      filteredDatasets.length > 0
        ? filteredDatasets.reduce((acc, curr) =>
            acc.filter((dataset) => curr.includes(dataset))
          )
        : [];

    console.log(uniqueDatasets);

    // Get the column names of the selected columns
    const columnContent = selectedIndices.map((index) => colRec[index]);

    // Update active columns
    setActiveColumns((prevSelectedColumns) => [
      ...prevSelectedColumns,
      ...columnContent,
    ]);

    console.log(activeColumns);

    // Create a new filter based on the selected columns
    const newFilters =
      columnContent.length > 0
        ? columnContent.map((content) => `Column Content = ${content}`)
        : [];

    setFilters((prev) => [...prev, ...newFilters]);
    setIconVisibility((prev) => [...prev, ...newFilters.map(() => true)]);

    try {
      const colFilteredURL = "http://127.0.0.1:5000/api/and_dataset_filter";
      console.log("SENDING AND COLUMNS API");
      console.log(results);
      const searchResponse = await axios.post(colFilteredURL, {
        task: task,
        results: results,
        uniqueDatasets: uniqueDatasets,
      });
      console.log(searchResponse.data);
      setResults(searchResponse.data.filtered_results);

      setSelectedColumns(Array(5).fill(false));
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error updating filtered datasets:", error.message);
        alert(`Failed to update filtered datasets: ${error.message}`);
      } else {
        console.error("Unexpected error:", error);
        alert("An unexpected error occurred.");
      }
    }
  };

  // generate task recommendations
  useEffect(() => {
    setInput(task);
    generateTaskRec(task);
  }, [task]);

  const hasInitialized = useRef(false);
  useEffect(() => {
    // generate col rec on first render, keep a local copy of initial results
    if (!hasInitialized.current && results.length > 0) {
      hasInitialized.current = true; // Mark as executed
      setInitialResults(results);
      generateColRec(task);
    }
    setSelectedColumns(Array(5).fill(false));
    setDatasetCount(results.length);
  }, [results]);

  return (
    <div className="query-container">
      <div style={{ display: "flex", alignItems: "center" }}>
        <span
          style={{
            fontWeight: "bold",
            marginRight: "0.5rem",
            fontSize: "24px",
            marginBottom: "12px",
          }}
        >
          Query Decomposition
        </span>
        <img
          src="/lego-block.png"
          alt="Blocks Icon"
          style={{ width: "40px", height: "40px" }}
        />
      </div>{" "}
      <div className="blocks-container">
        <div className="task-block-container">
          <span>
            <b>Task Specifications</b>
          </span>
          <div className="task-block">
            <span className="label">task</span>
            <div className="task-prompt">
              <textarea
                style={{
                  flex: "0.95",
                  border: "none",
                  outline: "none",
                  resize: "none",
                  height: "auto",
                  minHeight: "80px",
                  maxHeight: "200px",
                }}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault(); // Prevent new line on Enter
                    setTask(input);
                  }
                }}
                placeholder="Enter your task here..."
              />{" "}
              <X
                size={24}
                style={{ marginLeft: "auto", cursor: "pointer" }}
                onClick={() => setTask("")}
              />
            </div>
          </div>
          {taskRec?.length > 0 && (
            <div className="task-message-container" style={{ width: "100%" }}>
              {taskRec.map(([key, value], index) => (
                <TaskSuggestionBlock
                  key={`${key}-${index}`}
                  recommendation={key}
                  reason={String(value)}
                  setTask={setTask}
                />
              ))}
            </div>
          )}
        </div>

        <div className="filter-block-container">
          <span>
            <b>Filters</b>
          </span>
          <div className="filter-block">
            <span className="label">
              <div style={{ display: "flex" }}>metadata</div>
              <div>({filters.length})</div>
              <button className="metadata-btn" onClick={handleClick}>
                +
              </button>
            </span>
            <div className="filter-tags">
              {filters.length === 0 ? (
                <div
                  className="filter-prompt"
                  style={{ color: "grey", paddingLeft: "8px" }}
                >
                  No metadata filters added.
                </div>
              ) : (
                filters
                  .slice(0, Math.min(filters.length, iconVisibility.length))
                  .map((filter, index) => (
                    <FilterItem
                      key={index}
                      filter={filter}
                      isVisible={iconVisibility[index]}
                      onToggle={() => toggleIcon(index)}
                      onRemove={() => removeFilter(index)}
                    />
                  ))
              )}
            </div>
          </div>

          {colRec?.length > 0 && (
            <div className="col-rec-container" style={{ marginTop: "12px" }}>
              <span>
                <b>Include columns that contain: </b>
              </span>
      
              {filteredColRecWithIndices.map(
                ({ key, value, originalIndex }, filteredIndex) => (
                  <div key={key}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginLeft: "8px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedColumns[filteredIndex] || false} // set false if undefined
                        onChange={(e) =>
                          updateSelectedColumns(filteredIndex, e.target.checked)
                        }
                      />
                      {value}
                    </label>
                  </div>
                )
              )}
                <div>
                <u>Number of datasets</u> in search result: {datasetCount}
              </div>

              <button
                onClick={() => {
                  console.log("Selected Columns:", selectedColumns);
                  updateFilteredDatasets();
                }}
                className="metadata-button"
              >
                try
              </button>
            </div>
          )}
        </div>
        <FilterPrompt
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)} // Close modal
          // onSubmit={handleNewFilterSubmit} // Handle new filter submission
          onSubmit={() => {}} // Handle new filter submission
          messages={messages}
          setMessages={setMessages}
          activeFilters={activeFilters}
          results={results}
          setResults={setResults}
          setFilters={setFilters}
          setIconVisibility={setIconVisibility}
        />
      </div>
    </div>
  );
};

export default QueryBlocks;

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
