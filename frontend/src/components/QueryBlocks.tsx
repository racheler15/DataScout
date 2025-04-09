import "../styles/QueryBlocks.css";
import { useEffect, useState, useRef } from "react";
import { Icon } from "@iconify/react";
import eyeIcon from "@iconify-icons/fluent/eye-20-regular";
import eyeOffIcon from "@iconify-icons/fluent/eye-off-20-regular";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import SearchIcon from "@mui/icons-material/Search";
import LabelImportantIcon from "@mui/icons-material/LabelImportant";
import TuneIcon from "@mui/icons-material/Tune";
import { X } from "lucide-react";
import FilterPrompt from "./FilterPrompt";
import axios from "axios";
import { ResultProp } from "./ResultsTable";
import "../styles/MessageItem.css";
import { MetadataFilter } from "../App";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";

interface QueryBlocksProps {
  task: string;
  setTask: React.Dispatch<React.SetStateAction<string>>;
  filters: MetadataFilter[];
  setFilters: React.Dispatch<React.SetStateAction<MetadataFilter[]>>;
  iconVisibility: boolean[];
  setIconVisibility: React.Dispatch<React.SetStateAction<boolean[]>>;
  pendingFilter: string | null;
  setPendingFilter: React.Dispatch<React.SetStateAction<string | null>>;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  results: ResultProp[];
  setResults: (a: ResultProp[]) => unknown;
  settingsGenerate: boolean;
  setSettingsGenerate: React.Dispatch<React.SetStateAction<boolean>>;
  setTaskRec: React.Dispatch<
    React.SetStateAction<[string, string, string[]][]>
  >;
  taskRec: [string, string, string[]][];
}

const QueryBlocks = ({
  task,
  setTask,
  filters,
  setFilters,
  iconVisibility,
  setIconVisibility,
  results,
  setResults,
  settingsGenerate,
  setSettingsGenerate,
  taskRec,
  setTaskRec,
}: QueryBlocksProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  const [newSearch, setNewSearch] = useState(false);
  const [toggle, setToggle] = useState(false);
  const [hnswColumn, setHnswColumn] = useState("");

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
    console.log(initialResults);
    console.log(filteredSavedDatasets);
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
  ) => Promise<string[] | undefined>; // Use Promise<void> if the function doesn't return anything

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
      const taskSuggestionsURL =
        "http://127.0.0.1:5000/api/task_semantic_suggestion";
      console.log("GENERATE TASK REC");
      console.log("TASK", task);
      console.log("RESULTS", results);
      const searchResponse = await axios.post(taskSuggestionsURL, {
        task: task,
        results: results,
        goal: ""
      });
      console.log("TASK REC", searchResponse.data);
      console.log(searchResponse.data.consolidated_results);
      const querySuggestions = searchResponse.data.consolidated_results;
      const clusters = searchResponse.data.datasets_in_clusters;
      const queryObject =
        typeof querySuggestions === "string"
          ? JSON.parse(querySuggestions)
          : querySuggestions;
      const queryArray = Object.entries(queryObject);
      setTaskRec(
        queryArray
          .slice(0, 3)
          .map(([key, value], index) => [
            `${key}`,
            `${value} (${clusters[index]?.length || 0})`,
            clusters[index],
          ])
      );
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
    if (newSearch) {
      console.log("Task bar updated:", task);
      fetchData();
    }
  }, [newSearch, task]); // Dependency array includes only taskBar

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
    // if (!settingsGenerate) {
    //   generateTaskRec(task);
    // }
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
        await generateTaskRec(task);
        await generateColRec(task); // Wait for generateColRec to complete
      }

      if (newTask) {
        console.log("NEW TASK invalidate nonexisting knn");
        console.log("RESET INITAL RESULTS");
        setInitialResults(results);
        await generateTaskRec(task); // Wait for generateTaskRec to complete
        await generateColRec(task); // Wait for generateColRec to complete

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

  const handleMetadata = async (hnswColumn: string) => {
    if (!hnswColumn) return;

    try {
      const fetchResponse = await axios.post(
        "http://127.0.0.1:5000/api/manual_metadata",
        {
          selectedFilter: "column_specification",
          selectedOperation: "is",
          value: hnswColumn,
          results: results,
        }
      );
      console.log(fetchResponse.data);
      setResults(fetchResponse.data.results);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleColumnSearch = (hnswColumn: string) => {
    console.log("HANDLE COLUMN SEARCH", hnswColumn);
    if (!hnswColumn) return;

    // Check if filter already exists
    setFilters((prev) => {
      const filterString = `column_specification is ${hnswColumn}`;
      console.log(filterString);
      handleMetadata(hnswColumn);

      return [
        ...prev,
        {
          type: "normal",
          filter: filterString,
          value: hnswColumn,
          operand: "is",
          subject: "column_specification",
          visible: true,
          active: true,
        },
      ];
    });

    setIconVisibility((prev) => [...prev, true]);
    setHnswColumn("");
  };

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
          Dataset Search Query
        </span>
        <img
          src="/lego-block.png"
          alt="Blocks Icon"
          style={{ width: "40px", height: "40px", marginTop: "-12px" }}
        />
      </div>{" "}
      <div className="blocks-container">
        <div className="task-block-container">
          <span style={{ display: "flex", alignItems: "center" }}>
            <LabelImportantIcon
              style={{
                height: "16px",
                width: "16px",
                color: "red",
                marginRight: "4px",
              }}
            />
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
                    setNewSearch(true);
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
              <div style={{ fontWeight: "600", fontSize: "15px" }}>
                Suggestions to Refine your Search Query:
              </div>

              {taskRec.map(([key, value, cluster], index) => (
                <TaskSuggestionBlock
                  key={`${key}-${index}`}
                  recommendation={key}
                  reason={String(value)}
                  cluster={cluster}
                  setTask={setTask}
                  setNewTask={setNewTask}
                  setResults={setResults}
                  results={results}
                />
              ))}
            </div>
          )}
        </div>

        <div className="filter-block-container">
          <span style={{ display: "flex", alignItems: "center" }}>
            <LabelImportantIcon
              style={{
                height: "16px",
                width: "16px",
                color: "blue",
                marginRight: "4px",
              }}
            />
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
          <div
            style={{
              // border: "1px solid #ddd",
              padding: "0.2rem",
              borderRadius: "6px",
              // boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div className="col-rec-container">
              {" "}
              <div
                style={{
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  fontSize: "20px",
                }}
              >
                <SearchIcon
                  style={{
                    height: "20px",
                    width: "20px",
                    color: "black",
                    marginRight: "8px",
                    marginLeft: "2px",
                  }}
                />
                Search using your own Column Concept
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginTop: "6px",
                  alignItems: "center",
                  width: "100%",
                  marginLeft: "8px",
                }}
              >
                <input
                  type="text"
                  placeholder="Enter column name..."
                  value={hnswColumn}
                  onChange={(e) => setHnswColumn(e.target.value)}
                  style={{
                    padding: "8px",
                    height: "28px",
                    borderRadius: "10px",
                    border: "1px solid #2363eb",
                    width: "90%",
                  }}
                />
                <button
                  onClick={() => handleColumnSearch(hnswColumn)}
                  className="metadata-button"
                  style={{ marginTop: "0px" }}
                >
                  try
                </button>
              </div>
            </div>
          </div>
          <div
            style={{
              // border: "1px solid #ddd",
              padding: "0.2rem",
              borderRadius: "6px",
              marginTop: "2px",
              // boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              style={{
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                marginBottom: "4px",
                fontSize: "20px",
              }}
            >
              {" "}
              <AutoAwesomeIcon
                style={{
                  height: "16px",
                  width: "16px",
                  color: "orange",
                  marginRight: "14px",
                  marginLeft: "2px",
                }}
              />
              Smart Filter by Column Concept:
            </div>

            {colRec?.length > 0 && (
              <div className="col-rec-container">
                {filteredColRecWithIndices.map(
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  ({ key, value, originalIndex }, filteredIndex) => (
                    <div key={key}>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginLeft: "30px",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedColumns[filteredIndex] || false} // set false if undefined
                          onChange={(e) =>
                            updateSelectedColumns(
                              filteredIndex,
                              e.target.checked
                            )
                          }
                        />
                        {value}
                      </label>
                    </div>
                  )
                )}
                <div
                  style={{
                    fontWeight: "500",
                    marginTop: "4px",
                    marginLeft: "30px",
                    fontSize: "16px",
                    color: "darkblue",
                  }}
                >
                  <i>Remaining datasets: {datasetCount}</i>
                </div>

                <button
                  onClick={() => {
                    console.log("Selected Columns:", selectedColumns);
                    updateFilteredDatasets();
                  }}
                  className="metadata-button"
                  style={{
                    marginLeft: "24px",
                    // marginLeft: "auto",
                    // display: "block",
                  }}
                >
                  apply filters
                </button>
              </div>
            )}
          </div>

          <GranularityFilter
            results={results}
            setFilters={setFilters}
            setIconVisibility={setIconVisibility}
            filters={filters}
            setResults={setResults}
          />
        </div>
        <FilterPrompt
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)} // Close modal
          onSubmit={() => {}} // Handle new filter submission
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
  setResults: (a: ResultProp[]) => unknown;
  cluster: string[];
  results: ResultProp[];
}

const TaskSuggestionBlock = ({
  recommendation,
  reason,
  setTask,
  setNewTask,
  setResults,
  cluster,
  results,
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
          console.log("CLICKED ON TASK TRY");
          setTask(recommendation);
          const filteredResults: ResultProp[] = results.filter((result) =>
            cluster.includes(result.database_name)
          );
          console.log(filteredResults);
          setResults(filteredResults);
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

type GranularityItem = {
  type: "time" | "geo";
  value: string;
  count: number;
};

type SelectedGranularities = {
  time: string[];
  geo: string[];
};

interface GranularityFilterProps {
  results: ResultProp[];
  setFilters: React.Dispatch<React.SetStateAction<MetadataFilter[]>>;
  setIconVisibility: React.Dispatch<React.SetStateAction<boolean[]>>;
  filters: MetadataFilter[];
  setResults: (a: ResultProp[]) => unknown;
}

const GranularityFilter = ({
  results,
  setFilters,
  setIconVisibility,
  filters,
  setResults,
}: GranularityFilterProps) => {
  const [topGranularities, setTopGranularities] = useState<GranularityItem[]>(
    []
  );
  const [selected, setSelected] = useState<SelectedGranularities>({
    time: [],
    geo: [],
  });

  useEffect(() => {
    const counts = {
      time: {} as Record<string, number>,
      geo: {} as Record<string, number>,
    };

    results.forEach((result) => {
      if (result.time_granu)
        counts.time[result.time_granu] =
          (counts.time[result.time_granu] || 0) + 1;
      if (result.geo_granu)
        counts.geo[result.geo_granu] = (counts.geo[result.geo_granu] || 0) + 1;
    });

    const all = [
      ...Object.entries(counts.time).map(
        ([value, count]) => ({ type: "time", value, count } as const)
      ),
      ...Object.entries(counts.geo).map(
        ([value, count]) => ({ type: "geo", value, count } as const)
      ),
    ].sort((a, b) => b.count - a.count);

    // Filter out granularities that are already in filters
    const filteredGranularities = all.filter((granularity) => {
      const filterExists = filters.some((filter) => {
        // Check if a filter with this granularity already exists
        return (
          filter.subject === `${granularity.type}_granu` &&
          filter.value === granularity.value
        );
      });
      return !filterExists;
    });

    setTopGranularities(filteredGranularities.slice(0, 3));
  }, [results, filters]);

  const toggleSelection = (type: "time" | "geo", value: string) => {
    setSelected((prev) => ({
      ...prev,
      [type]: prev[type].includes(value)
        ? prev[type].filter((v) => v !== value)
        : [...prev[type], value],
    }));
  };

  const toggleGranu = async (filters: MetadataFilter[]) => {
    console.log("TOGGLE", filters);
    const normalFilters = filters.filter(
      (filter) => filter.type === "normal" && filter.visible && filter.active
    );

    console.log("NORMAL FILTERS", normalFilters);

    const colFilteredURL = "http://127.0.0.1:5000/api/remove_metadata_update";
    try {
      const searchResponse = await axios.post(colFilteredURL, {
        filters: normalFilters,
        results: results,
        uniqueDatasets: [],
      });
      console.log("ADD SEARCH DATSETS", searchResponse.data);

      setResults(searchResponse.data.filtered_results);
    } catch (error) {
      console.error("Error fetching filtered datasets:", error);
    }
  };

  const handleTry = () => {
    console.log("HANDEL TRY FOR GRANU");
    // Create new filters with explicit type casting
    const newFilters = [
      ...selected.time.map(
        (value) =>
          ({
            type: "normal" as const,
            filter: `time_granularity is ${value.toLowerCase()}`,
            value: value,
            operand: "is" as const,
            subject: "time_granu",
            visible: true,
            active: true,
          } satisfies MetadataFilter)
      ),
      ...selected.geo.map(
        (value) =>
          ({
            type: "normal" as const,
            filter: `geo_granularity is ${value.toLowerCase()}`,
            value: value,
            operand: "is" as const,
            subject: "geo_granu",
            visible: true,
            active: true,
          } satisfies MetadataFilter)
      ),
    ];
    console.log(newFilters);

    if (newFilters.length > 0) {
      setFilters((prev) => {
        const updatedFilters = [...prev, ...newFilters];
        toggleGranu(updatedFilters);
        return updatedFilters;
      });
      setIconVisibility((prev) => [
        ...prev,
        ...new Array(newFilters.length).fill(true),
      ]);
      setSelected({ time: [], geo: [] });
    }
  };

  return (
    <div
      style={{
        // border: "1px solid #ddd",
        padding: "0.2rem",
        borderRadius: "6px",
        marginTop: "6px",
        marginBottom: "6px",

        // boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div
        style={{
          fontWeight: "600",
          display: "flex",
          alignItems: "center",
          marginBottom: "4px",
          fontSize: "20px",
        }}
      >
        <TuneIcon
          style={{
            height: "18px",
            width: "18px",
            color: "black",
            marginRight: "8px",
            marginLeft: "2px",
          }}
        />
        Top Granularity Filters
      </div>
      <div style={{ margin: "4px 0" }}>
        {topGranularities.map(({ type, value, count }) => (
          <div key={`${type}-${value}`} style={{ margin: "0.15rem 0" }}>
            <label
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <input
                type="checkbox"
                style={{ marginLeft: "32px" }}
                checked={selected[type].includes(value)}
                onChange={() => toggleSelection(type, value)}
              />
              <span>
                {type === "time" ? "⏱" : "🌍"} {value} ({count})
              </span>
            </label>
          </div>
        ))}
        <button
          onClick={handleTry}
          disabled={selected.time.length === 0 && selected.geo.length === 0}
          className="metadata-button"
          style={{
            marginLeft: "24px",
          }}
        >
          apply filters
        </button>
      </div>
    </div>
  );
};
