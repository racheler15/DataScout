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
import { MetadataFilter } from "../App";

interface QueryBlocksProps {
  task: string;
  setTask: React.Dispatch<React.SetStateAction<string>>;
  filters: MetadataFilter[];
  setFilters: React.Dispatch<React.SetStateAction<MetadataFilter[]>>;
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
  settingsGenerate: boolean;
  setSettingsGenerate: React.Dispatch<React.SetStateAction<boolean>>;
  setTaskRec: React.Dispatch<React.SetStateAction<[string, string][]>>;
  taskRec: [string, string][];
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
  results,
  setResults,
  setTaskRec,
}: QueryBlocksProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [input, setInput] = useState(""); // State to track user input
  const [colRec, setColRec] = useState<string[]>([]); // total list of all knn columns
  const [selectedColumns, setSelectedColumns] = useState<boolean[]>( // keeps track of checked/unchecked columns in top 5 list
    Array(5).fill(false)
  );
  const [savedDatasets, setSavedDatasets] = useState<string[][]>([]); //current copy of dataset
  const [initialResults, setInitialResults] = useState<ResultProp[]>([]); //original  copy of all dataset results
  const [activeColumns, setActiveColumns] = useState<string[]>([]); // to keep track of active knn columns
  const [colsToRemove, setColsToRemove] = useState<MetadataFilter[]>([]); // to keep track of which cols needed to delete
  const [shouldProcess, setShouldProcess] = useState(false); // for the dataset check list toggling
  const [shouldRemove, setShouldRemove] = useState(false);
  const [shouldAdd, setShouldAdd] = useState(false);
  const [colsToAdd, setColsToAdd] = useState<MetadataFilter[]>([]);

  const [newTask, setNewTask] = useState(false);
  const [toggle, setToggle] = useState(false);

  // toggles a filter, called when user clicks eye on filter
  const toggleIcon = (index: number) => {
    console.log("TOGGLING FILTER");
    setIconVisibility((prev) => {
      const newVisibility = [...prev];
      newVisibility[index] = !newVisibility[index];
      return newVisibility;
    });
    const filterToToggle = filters[index]; // Get the corresponding filter

    setColsToAdd((prev) => [...prev, filterToToggle]);
    console.log(filterToToggle);
    setFilters((prevFilters) =>
      prevFilters.map((filter) =>
        filter === filterToToggle
          ? { ...filter, visible: !filter.visible } // make filter visible = false/true
          : filter
      )
    );
    setShouldAdd(true);
  };

  const toggleFilteredDatasets = async () => {
    console.log("TOGGLE", filters);
    console.log("SAVED", savedDatasets);
    console.log("INITIAL", initialResults);
    const filteredSavedDatasets = [...initialResults.flat()];
    const normalFilters = filters.filter(
      (filter) => filter.type === "normal" && filter.visible && filter.active
    );

    console.log("NORMAL FILTERS", normalFilters);

    const colFilteredURL = "http://127.0.0.1:5000/api/remove_metadata_update";
    try {
      const searchResponse = await axios.post(colFilteredURL, {
        filters: normalFilters,
        results: initialResults,
        uniqueDatasets: filteredSavedDatasets,
      });
      console.log("ADD SEARCH DATSETS", searchResponse.data);

      setResults(searchResponse.data.filtered_results);
    } catch (error) {
      console.error("Error fetching filtered datasets:", error);
    }
  };
 
  // remove a filter, called when user clicks x on filter
  const removeFilter = (index: number) => {
    setFilters((prevFilters) => {
      const filterToRemove = prevFilters[index]; // Get the filter at the given index
      console.log("REMOVE", filterToRemove);

      // Store the removed filter separately
      setColsToRemove((prev) => [...prev, filterToRemove]);

      const updatedFilters = prevFilters.filter((_, i) => i !== index); // Remove the filter

      return updatedFilters;
    });

    setIconVisibility((prev) => prev.filter((_, i) => i !== index)); // Update visibility state
    setShouldRemove(true);
  };

  const removeFilteredDatasets = async () => {
    const filteredSavedDatasets = [...initialResults.flat()];

    console.log("REMOVE FILTERED", filteredSavedDatasets);

    const normalFilters = filters.filter(
      (filter) =>
        filter.type === "normal" &&
        filter.visible &&
        !colsToRemove.some((removeFilter) =>
          removeFilter.value.includes(filter.value)
        )
    );

    console.log("NORMAL FILTERS", normalFilters);

    const colFilteredURL = "http://127.0.0.1:5000/api/remove_metadata_update";
    try {
      const searchResponse = await axios.post(colFilteredURL, {
        filters: normalFilters,
        results: initialResults,
        uniqueDatasets: filteredSavedDatasets,
      });
      console.log("REMOVE SEARCH DATSETS", searchResponse.data);

      setResults(searchResponse.data.filtered_results);
    } catch (error) {
      console.error("Error fetching filtered datasets:", error);
    }
  };


  const handleClick = () => {
    setIsModalOpen(true); // Open the modal when "+" is clicked
  };

 
  // Filter colRec to exclude activeColumns and get the next top 5 cols
  const filteredColRecWithIndices = Object.entries(colRec)
    .map(([key, value], originalIndex) => ({ key, value, originalIndex })) // Track original indices
    .filter(({ value }) => !activeColumns.includes(value)) // Exclude active columns
    .slice(0, 5); // Get only the first 5


  // for toggling the checkboxes and processing remaining datasets in list
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
    // list of lists where each child is datasets associated with it
    const filteredDatasets = selectedIndices.map(
      (index) => savedDatasets[index]
    );

    console.log(
      "Filtered datasets before applying intersection:",
      filteredDatasets
    );

    let uniqueDatasets;
    if (filteredDatasets.length === 0) {
      //base case where nothing is checked, should display total count of total results
      uniqueDatasets = results.map((item) => item.table_name);
    } else {
      uniqueDatasets = filteredDatasets.reduce(
        (acc, curr) => acc.filter((dataset) => curr.includes(dataset)),
        filteredDatasets[0] || []
      ); // Use the first dataset as the initial accumulator
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
    } catch (error) {
      console.error("Error fetching filtered datasets:", error);
    }
  };

  const fetchData = async () => {
    console.log("hyse search");
    try {
      const searchResponse = await axios.post(
        "http://127.0.0.1:5000/api/hyse_search",
        {
          query: task,
        }
      );
      console.log("FETCHED DATA FROM HYSE:", searchResponse);

      setResults(searchResponse.data.complete_results);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };
  useEffect(() => {
    if (newTask) {
      console.log("Task bar updated:", task);
      fetchData();
    }
  }, [newTask, task]); // Dependency array includes only taskBar

  useEffect(() => {
    console.log("USE EFFECT UPDATED FILTERS", filters);
  }, [filters]);


  useEffect(() => {
    console.log("ACTIVE COLUMNS UPDATED", activeColumns);
    if (shouldRemove) {
      removeFilteredDatasets();
      setColsToRemove([]); // Reset after running
      setShouldRemove(false);
    }
  }, [activeColumns, shouldRemove, colsToRemove]);

  useEffect(() => {
    if (shouldAdd) {
      toggleFilteredDatasets();
      setColsToAdd([]);
      setShouldAdd(false);
    }
  }, [shouldAdd, colsToAdd]);

  useEffect(() => {
    // for toggling to see how many datasets in search results
    if (shouldProcess) {
      processFilteredDatasets();
      setShouldProcess(false); // Reset the flag after processing
    }
  }, [selectedColumns, shouldProcess]);

  // generate task recommendations for helper block start
  useEffect(() => {
    setInput(task);
  }, [task]);

  const hasInitialized = useRef(false);
  useEffect(() => {
    const handleResults = async () => {
      console.log("RESULTS UPDATED, GENERATE COL REC");

      if (!hasInitialized.current && results.length > 0) {
        hasInitialized.current = true; // Mark as executed
        setInitialResults(results); // keep copy of original results
        console.log("NEW COL REC");
      }

      if (newTask) {
        console.log("NEW TASK invalidate nonexisting knn");
        console.log("RESET INITAL RESULTS");
        setInitialResults(results);

        setToggle(true);
        console.log("SET NEW TASK FALSE");
        setNewTask(false);
      }
    };

    handleResults(); // Call the async function
  }, [results]); // Add dependencies as needed

  useEffect(() => {
    const handleToggle = async () => {
      if (toggle) {
        console.log("RUNNING TOGGLE");
        // Call toggleDatasets with the updated filters and activeColumns
        toggleFilteredDatasets();
        // Reset the toggle state
        setToggle(false);
      }
    };

    handleToggle(); // Call the async function
  }, [toggle]); // Dependency array includes toggle

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
          style={{ width: "40px", height: "40px", marginTop: "-12px" }}
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
                  minHeight: "100px",
                }}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault(); // Prevent new line on Enter
                    console.log("ENTER");
                    setTask(input);
                    setNewTask(true);
                  }
                }}
                placeholder="Enter your task here..."
              />{" "}
              <X
                size={20}
                style={{ marginLeft: "auto", cursor: "pointer" }}
                onClick={() => setTask("")}
              />
            </div>
          </div>
          <div></div>
        </div>

        <div className="filter-block-container">
          <span>
            <b>Filters ({filters.filter((filter) => filter.visible).length})</b>
          </span>
          <div className="filter-block">
            <span className="label">
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


interface FilterItemProps {
  filter: MetadataFilter;
  isVisible: boolean;
  onToggle: () => void;
  onRemove: () => void;
}

const FilterItem: React.FC<FilterItemProps> = ({
  filter,
  isVisible,
  onToggle,
  onRemove,
}) => {
  return (
    <div
      className={`filter-prompt ${isVisible ? "" : "hidden"} ${
        !filter.active ? "inactive" : ""
      }`}
    >
      <div style={{ flex: "0.95" }}>{filter.filter}</div>
      <Icon
        icon={isVisible ? eyeIcon : eyeOffIcon}
        style={{ width: "24px", height: "24px", cursor: "pointer" }}
        onClick={onToggle}
      />
      <X size={24} style={{ cursor: "pointer" }} onClick={onRemove} />
    </div>
  );
};
