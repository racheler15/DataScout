import "../styles/QueryBlocks.css";
import { useEffect, useState, useRef } from "react";
import { Icon } from "@iconify/react";
import eyeIcon from "@iconify-icons/fluent/eye-20-regular";
import eyeOffIcon from "@iconify-icons/fluent/eye-off-20-regular";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { X } from "lucide-react";
import FilterPrompt from "./FilterPrompt";
import { MessageProps } from "./MessageItem";
import axios from "axios";
import { ResultProp } from "./ResultsTable";
import "../styles/MessageItem.css";
import { MetadataFilter } from "../App";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import { flushSync } from "react-dom";

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
  pendingFilter,
  setPendingFilter,
  results,
  setResults,
  currentPage,
  setCurrentPage,
  settingsGenerate,
  setSettingsGenerate,
  taskRec,
  setTaskRec,
}: QueryBlocksProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [input, setInput] = useState(""); // State to track user input
  const [colRec, setColRec] = useState<string[]>([]); // total list of all knn columns
  const [selectedColumns, setSelectedColumns] = useState<boolean[]>( // keeps track of checked/unchecked columns in top 5 list
    Array(5).fill(false)
  );
  const [datasetCount, setDatasetCount] = useState<number>(results.length);
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
    const filteredSavedDatasets = getNormalFilteredDatasets();
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

      // Update datasetCount based on the filtered results
      setDatasetCount(searchResponse.data.filtered_results.length);
      setResults(searchResponse.data.filtered_results);
    } catch (error) {
      console.error("Error fetching filtered datasets:", error);
    }
  };
  type toggleDatasetsProps = (
    activeColumns: string[],
    filters: MetadataFilter[]
  ) =>  Promise<string[] | undefined>; // Use Promise<void> if the function doesn't return anything

  const toggleDatasets: toggleDatasetsProps = async (
    activeColumns,
    filters
  ) => {
    console.log("TOGGLE", filters);

    // If no active columns or filters are visible, return all datasets
    if (
      activeColumns.length === 0 ||
      filters.every((filter) => filter.visible === false) ||
      filters.length === 0
    ) {
      console.log("NO ACTIVE COLUMNS LEFT");
      const uniqueDatasets = [...savedDatasets.flat()];
      return uniqueDatasets;
    }

    // Step 1: Find the original indices of activeColumns
    console.log("ACTIVE COLUMNS", activeColumns);
    const filteredColRec = Object.entries(colRec)
      .map(([key, value], originalIndex) => ({ key, value, originalIndex }))
      .filter(
        ({ value }) =>
          activeColumns.includes(value) &&
          filters.some(
            (filter) =>
              filter.value === value &&
              filter.visible === true &&
              filter.active === true
          )
      );

    console.log("FILTERED COL REC", filteredColRec);

    // Step 2: Extract the corresponding datasets from savedDatasets
    const filteredDatasets = filteredColRec.map(
      ({ originalIndex }) => savedDatasets[originalIndex]
    );

    // Step 3: Compute the intersection of datasets
    const uniqueDatasets = filteredDatasets.reduce(
      (acc, curr) =>
        acc.length > 0 ? acc.filter((dataset) => curr.includes(dataset)) : curr,
      filteredDatasets[0] || []
    );

    console.log("FILTERED DATASETS", filteredDatasets);
    console.log("UNIQUE DATASETS", uniqueDatasets);

    // Step 4: Filter normal filters
    const normalFilters = filters.filter(
      (filter) => filter.type === "normal" && filter.visible && filter.active
    );

    console.log("NORMAL FILTERS", normalFilters);

    // Step 5: Send request to backend to update results
    const colFilteredURL = "http://127.0.0.1:5000/api/remove_metadata_update";
    try {
      const searchResponse = await axios.post(colFilteredURL, {
        filters: normalFilters,
        results: initialResults,
        uniqueDatasets: uniqueDatasets,
      });
      console.log("ADD SEARCH DATASETS", searchResponse.data);

      // Update datasetCount based on the filtered results
      setDatasetCount(searchResponse.data.filtered_results.length);
      setResults(searchResponse.data.filtered_results);

      // Return the unique datasets for further processing if needed
      return uniqueDatasets;
    } catch (error) {
      console.error("Error fetching filtered datasets:", error);
      throw error; // Propagate the error to the caller
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
      console.log("ACTIVE COLUMNS", activeColumns);
      const filteredColRec = Object.entries(colRec)
        .map(([key, value], originalIndex) => ({ key, value, originalIndex }))
        .filter(
          ({ value }) =>
            activeColumns.includes(value) &&
            filters.some(
              (filter) =>
                filter.value === value &&
                filter.visible === true &&
                filter.active === true
            )
        );

      console.log("FILTERED COL REC", filteredColRec);
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
              (filter) =>
                filter.value === value &&
                filter.visible === true &&
                filter.active === true
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
      console.log("SENDING COL SUGGESTION API for", task);
      const searchResponse = await axios.post(colSuggestionsURL, {
        task: task,
        results: results,
      });
      console.log("GENERATE COL REC", searchResponse.data);

      console.log("setcolrec for generatecolrec");

      setColRec(searchResponse.data.consolidated_results);

      // await new Promise(resolve => setTimeout(resolve, 500));

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
            active: true,
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
    console.log("USE EFFECT UPDATED COL REC", colRec);
  }, [colRec]);

  const reapplyFilters = async () => {
    console.log("REAPPLYFILTERS");
    console.log(colRec);
    console.log(activeColumns);
    // Create a new array with updated `active` properties
    const updatedFilters = filters.map((filter) => {
      if (filter.type === "knn" && !colRec.includes(filter.value)) {
        return { ...filter, active: false }; // Deactivate the filter
      } else {
        return { ...filter, active: true }; // Activate the filter
      }
    });
    const updatedActiveColumns = activeColumns.filter((column) =>
      colRec.includes(column)
    );

    setActiveColumns(updatedActiveColumns);
    // Update the state with the new filters
    setFilters(updatedFilters);

    console.log(updatedFilters);
    console.log(updatedActiveColumns);
    return { updatedFilters, updatedActiveColumns };
  };

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
    if (!settingsGenerate) {
      generateTaskRec(task);
    }
    setInput(task);
    setSettingsGenerate(true);
  }, [task, settingsGenerate]);

  useEffect(() => {
    console.log("Updated taskRec:", taskRec);
  }, [taskRec]);

  const hasInitialized = useRef(false);
  useEffect(() => {
    const handleResults = async () => {
      console.log("RESULTS UPDATED, GENERATE COL REC");
      setSelectedColumns(Array(5).fill(false));

      if (!hasInitialized.current && results.length > 0) {
        hasInitialized.current = true; // Mark as executed
        setInitialResults(results); // keep copy of original results
        console.log("NEW COL REC");
        await generateColRec(task); // Wait for generateColRec to complete
      }

      if (newTask) {
        console.log("NEW TASK invalidate nonexisting knn");
        await generateTaskRec(task); // Wait for generateTaskRec to complete
        await generateColRec(task); // Wait for generateColRec to complete
        console.log("RESET INITAL RESULTS");
        setInitialResults(results);

        setToggle(true);
        console.log("SET NEW TASK FALSE");
        setNewTask(false);
      }

      setDatasetCount(results.length);
    };

    handleResults(); // Call the async function
  }, [results]); // Add dependencies as needed

  useEffect(() => {
    const handleToggle = async () => {
      if (toggle) {
        console.log("RUNNING TOGGLE");

        // Reapply filters and get updated values
        const { updatedFilters, updatedActiveColumns } = await reapplyFilters();

        // Call toggleDatasets with the updated filters and activeColumns
        await toggleDatasets(updatedActiveColumns, updatedFilters);

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
          {taskRec?.length > 0 && (
            <div className="task-message-container" style={{ width: "100%" }}>
              <div style={{ fontWeight: "600" }}>
                Suggestions to refine your search query:
              </div>

              {taskRec.map(([key, value], index) => (
                <TaskSuggestionBlock
                  key={`${key}-${index}`}
                  recommendation={key}
                  reason={String(value)}
                  setTask={setTask}
                  setNewTask={setNewTask}
                />
              ))}
            </div>
          )}
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

          {colRec?.length > 0 && (
            <div className="col-rec-container" style={{ marginTop: "12px" }}>
              <div style={{ fontWeight: "600" }}>Filter by column topics:</div>

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
              <div style={{ fontWeight: "500", marginTop: "8px" }}>
                <i>Remaining datasets: {datasetCount}</i>
              </div>

              <button
                onClick={() => {
                  console.log("Selected Columns:", selectedColumns);
                  updateFilteredDatasets();
                }}
                className="metadata-button"
              >
                apply filters
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
  setNewTask: React.Dispatch<React.SetStateAction<boolean>>;
}

const TaskSuggestionBlock = ({
  recommendation,
  reason,
  setTask,
  setNewTask,
}: TaskSuggestionBlockProps) => {
  return (
    <div className="task-suggestion-block-container">
      <div
        className="task-suggestion"
        style={{ position: "relative", width: "98%" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            marginBottom: "4px",
          }}
        >
          <AutoAwesomeIcon
            style={{
              height: "16px",
              width: "16px",
              color: "orange",
              marginRight: "8px",
              marginTop: "4px",
            }}
          />
          <div>
            <Tippy
              content={reason}
              placement="bottom-start"
              theme="custom-tippy-theme"
              offset={[0, -0.5]}
            >
              <span style={{ cursor: "help" }}>{recommendation}</span>
            </Tippy>
          </div>
        </div>
      </div>

      <button
        onClick={() => {
          setNewTask(true);
          setTask(recommendation);
        }}
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
