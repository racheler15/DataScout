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
// import { unique } from "vega-lite";
import { MetadataFilter } from "./ChatContainer";
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
  const [taskRec, setTaskRec] = useState<[string, string][]>([]);
  const [colRec, setColRec] = useState<string[]>([]); // total list of all knn columns
  const [selectedColumns, setSelectedColumns] = useState<boolean[]>( // keeps track of checked/unchecked columns in top 5 list
    Array(5).fill(false)
  );
  const [datasetCount, setDatasetCount] = useState<number>(results.length);
  const [savedDatasets, setSavedDatasets] = useState<string[][]>([]); //current copy of dataset
  const [initialResults, setInitialResults] = useState<ResultProp[]>([]); //original  copy of all dataset results
  const [activeColumns, setActiveColumns] = useState<string[]>([]); // to keep track of active knn columns
  const [colsToRemove, setColsToRemove] = useState<MetadataFilter[]>([]); // to keep track of which cols needed to delete
  const [shouldProcess, setShouldProcess] = useState(false);
  const [shouldRemove, setShouldRemove] = useState(false);
  const [shouldAdd, setShouldAdd] = useState(false);
  const [colsToAdd, setColsToAdd] = useState<MetadataFilter[]>([]);

  // const [mergedDatasets, setMergedDatasets] = useState<string[]>([]);

  // toggles a filter, called when user clicks eye on filter
  const toggleIcon = (index: number) => {
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
    // if (filterToToggle.visible) {
    //   console.log("filter toggle false", filterToToggle);
    //   setShouldRemove(true);
    // } else {
    //   console.log("filter toggle true", filterToToggle);
    //   setShouldAdd(true);
    // }

    // const isKnnFilter = filterToToggle.type === "knn";
    // if (isKnnFilter) {
    //   setActiveColumns((prevActiveColumns) => {
    //     const isIconHidden = !iconVisibility[index];
    //     if (isIconHidden) {
    //       setShouldAdd(true);
    //       return [...prevActiveColumns, ...filterToToggle.value];
    //     } else {
    //       setShouldRemove(true);
    //       return prevActiveColumns.filter(
    //         (col) => !filterToToggle.value.includes(col)
    //       );
    //     }
    //   });
    // } else {
    //   // Ensure safe state updates for `filterToToggle.visible`
    //   setFilters((prevFilters) =>
    //     prevFilters.map((filter) =>
    //       filter === filterToToggle
    //         ? { ...filter, visible: !filter.visible }
    //         : filter
    //     )
    //   );

    //   if (filterToToggle.visible) {
    //     console.log("filter toggle false", filterToToggle);
    //     setShouldRemove(true);
    //   } else {
    //     console.log("filter toggle true", filterToToggle);
    //     setShouldAdd(true);
    //   }
    // }
  };

  const toggleFilteredDatasets = async () => {
    const filteredSavedDatasets = getNormalFilteredDatasets();
    const normalFilters = filters.filter(
      (filter) => filter.type === "normal" && filter.visible
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

      // Update datasetCount based on the filtered results
      setDatasetCount(searchResponse.data.filtered_results.length);
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

      // Check if the filter contains "column group" (KNN filter)
      const isKnnFilter = filterToRemove.type;

      // Store the removed filter separately
      setColsToRemove((prev) => [...prev, filterToRemove]);

      const updatedFilters = prevFilters.filter((_, i) => i !== index); // Remove the filter

      // Update activeColumns
      if (isKnnFilter === "knn") {
        const valueToRemove = filterToRemove.value;
        setActiveColumns((prevActiveColumns) =>
          prevActiveColumns.filter(
            (col) => col.toLowerCase() !== valueToRemove.toLowerCase()
          )
        );
      }

      return updatedFilters;
    });

    setIconVisibility((prev) => prev.filter((_, i) => i !== index)); // Update visibility state
    setShouldRemove(true);
  };

  const removeFilteredDatasets = async () => {
    const isKnnFilter = colsToRemove.some((col) => col.type === "knn"); // check if removed filter is a knnfilter

    const filteredSavedDatasets = isKnnFilter
      ? getKnnFilteredDatasets()
      : getNormalFilteredDatasets();

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

      // Update datasetCount based on the filtered results
      setDatasetCount(searchResponse.data.filtered_results.length);
      setResults(searchResponse.data.filtered_results);
    } catch (error) {
      console.error("Error fetching filtered datasets:", error);
    }
  };

  const getNormalFilteredDatasets = () => {
    if (
      activeColumns.length === 0 ||
      filters.every((filter) => filter.visible === false) ||
      filters.length === 0
    ) {
      console.log("NO ACTIVE COLUMNS LEFT");
      const uniqueDatasets = [...savedDatasets.flat()];
      return uniqueDatasets;
    } else {
      // Step 1: Find the original indices of activeColumns
      const filteredColRec = Object.entries(colRec)
        .map(([key, value], originalIndex) => ({ key, value, originalIndex }))
        .filter(
          ({ value }) =>
            activeColumns.includes(value) &&
            filters.some(
              (filter) => filter.value === value && filter.visible === true
            )
        );

      console.log(filteredColRec);
      // Step 2: Extract the corresponding datasets from savedDatasets
      const filteredDatasets = filteredColRec.map(
        ({ originalIndex }) => savedDatasets[originalIndex]
      );

      const uniqueDatasets = filteredDatasets.reduce(
        (acc, curr) => acc.filter((dataset) => curr.includes(dataset)),
        filteredDatasets[0] || []
      );
      console.log("FILTERED", filteredDatasets);
      console.log("UNIQUE", uniqueDatasets);
      return uniqueDatasets;
    }
  };

  const getKnnFilteredDatasets = () => {
    // If no active columns are selected, return all datasets
    if (
      activeColumns.length === 0 ||
      filters.every((filter) => filter.visible === false) ||
      filters.length === 0
    ) {
      console.log("NO ACTIVE COLUMNS LEFT");
      const uniqueDatasets = [...savedDatasets.flat()];
      return uniqueDatasets;
    } else {
      // Step 1: Find the original indices of activeColumns, excluding colStoreRemove
      const filteredColRec = Object.entries(colRec)
        .map(([key, value], originalIndex) => ({ key, value, originalIndex }))
        .filter(
          ({ value }) =>
            activeColumns.includes(value) &&
            filters.some(
              (filter) => filter.value === value && filter.visible === true
            ) &&
            !colsToRemove.some((filter) => filter.value.includes(value))
        ); // Exclude colStoreRemove items

      // Step 2: Extract the corresponding datasets from savedDatasets
      const filteredDatasets = filteredColRec.map(
        ({ originalIndex }) => savedDatasets[originalIndex]
      );

      const uniqueDatasets = filteredDatasets.reduce(
        (acc, curr) => acc.filter((dataset) => curr.includes(dataset)),
        filteredDatasets[0] || []
      );

      console.log("FILTERED", filteredDatasets);
      console.log("UNIQUE", uniqueDatasets);

      return uniqueDatasets;
    }
  };

  const handleClick = () => {
    setIsModalOpen(true); // Open the modal when "+" is clicked
  };

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
      console.log(queryArray);
      setTaskRec(queryArray.map(([key, value]) => [key, String(value)]));
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
    // knn clustering recommendation
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

  // used for toggling checkboxes, will set values to true, calls processfiltereddatasets to update remaining results
  const updateSelectedColumns = (index: number, isChecked: boolean) => {
    setSelectedColumns((prev) => {
      // set selected indice to true
      const updatedColumns = prev.map((val, i) =>
        i === index ? isChecked : val
      );
      return updatedColumns;
    });
    setShouldProcess(true);
  };

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
      // Compute intersection of datasets
      // uniqueDatasets = filteredDatasets.reduce((acc, curr) =>
      //   acc.filter((dataset) => curr.includes(dataset))
      // );
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

      // Update datasetCount based on the filtered results
      setDatasetCount(searchResponse.data.filtered_results.length);
    } catch (error) {
      console.error("Error fetching filtered datasets:", error);
    }
  };

  // called when try button is clicked for the metadata block
  const updateFilteredDatasets = async () => {
    // Get the original indices of the selected columns
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
    // const uniqueDatasets =
    //   filteredDatasets.length > 0
    //     ? filteredDatasets.reduce((acc, curr) =>
    //         acc.filter((dataset) => curr.includes(dataset))
    //       )
    //     : [];
    const uniqueDatasets = filteredDatasets.reduce(
      (acc, curr) => acc.filter((dataset) => curr.includes(dataset)),
      filteredDatasets[0] || []
    );

    console.log(uniqueDatasets);

    // Get the column names of the selected columns
    const columnContent = selectedIndices.map((index) => colRec[index]);
    console.log("COLUMN CONTENT", columnContent);

    // Update active columns with the selected columns name
    setActiveColumns((prevSelectedColumns) => [
      ...prevSelectedColumns,
      ...columnContent,
    ]);

    console.log("ACTIVE COLUMNS", activeColumns);

    // Create a new filter based on the selected columns
    const newFilterObjects: MetadataFilter[] =
      columnContent.length > 0
        ? columnContent.map((content) => ({
            type: "knn",
            filter: `column group include ${content}`,
            value: content,
            operand: "include",
            subject: "column group",
            visible: true,
          }))
        : [];

    setFilters((prev) => [...prev, ...newFilterObjects]);
    setIconVisibility((prev) => [...prev, ...newFilterObjects.map(() => true)]);

    try {
      const colFilteredURL = "http://127.0.0.1:5000/api/and_dataset_filter";
      console.log("SENDING AND COLUMNS API");

      const searchResponse = await axios.post(colFilteredURL, {
        task: task,
        results: results,
        uniqueDatasets: uniqueDatasets,
      });
      console.log(searchResponse.data);
      setResults(searchResponse.data.filtered_results);
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

  useEffect(() => {
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
      setInitialResults(results); // keep copy of original results
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
              <div>({filters.filter((filter) => filter.visible).length})</div>
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
    <div className={`filter-prompt ${isVisible ? "" : "hidden"}`}>
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
