import "../styles/ResultsTable.css";
// import { CircleArrowLeft, CircleArrowRight } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import DownloadIcon from "@mui/icons-material/Download";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ReactMarkdown from "react-markdown";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import axios from "axios";
import { MetadataFilter } from "../App";

// CUSTOMIZE RESULTPROP DEPENDING ON DATABASE
export type ResultProp = {
  table_name: string;
  database_name: string;
  example_rows_md: string;
  time_granu: string;
  geo_granu: string;
  db_description: string;
  col_num: number;
  row_num: number;
  popularity: number;
  usability_rating: number;
  tags: string[];
  file_size_in_byte: number;
  keywords: string[];
  task_queries: string[];
  metadata_queries: string[];
  example_rows_embed: number[];
  cosine_similarity: number;
  dataset_context: string;
  dataset_purpose: string;
  dataset_source: string;
  dataset_collection_method: string;
  dataset_column_dictionary: string;
  dataset_references: string;
  dataset_acknowledgements: string;
};
export interface ResultsTableProps {
  results: ResultProp[];
  open: boolean;
  onResetSearch: () => Promise<void>;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  task: string;
  filters: MetadataFilter[];
}
interface ResultItemProps {
  index: number;
  dataset: ResultProp;
  isSelected: boolean;
  onClick: () => void;
}
interface ResultPreviewProps {
  dataset: ResultProp;
  index: number;
}

const ResultsTable: React.FC<ResultsTableProps> = ({
  results,
  currentPage,
  task,
  filters,
}: ResultsTableProps) => {
  const [selectedIndex, handleSelectedIndex] = useState(0);
  const pageSize = 200;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  // Get the datasets to be displayed for the current page
  const limitedResults = results.slice(startIndex, endIndex);

  const previewContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedIndex !== null && previewContainerRef.current) {
      previewContainerRef.current.scrollTo({ top: 0, left: 0 }); // Scroll the container to the top
    }
  }, [selectedIndex]);

  const ResultItem: React.FC<ResultItemProps> = ({
    dataset,
    index,
    isSelected,
    onClick,
  }) => {
    return (
      <div
        className={`dataset-container ${isSelected ? "selected" : ""}`}
        onClick={onClick}
      >
        <div className="dataset-index"> {index + 1}. </div>
        <div className="dataset-details">
          <div className="dataset-title"> {dataset.database_name}</div>
          <div className="dataset-stats">
            <span>
              {dataset.col_num} cols &middot; {dataset.row_num} rows &middot;{" "}
              {formatBytes(dataset.file_size_in_byte)} &middot;{" "}
              <DownloadIcon style={{ color: "#ccccc", width: "20px" }} />{" "}
              {formatPopularity(dataset.popularity)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const formatPopularity = (popularity: number) => {
    if (popularity >= 1000) {
      return `${(Math.round(popularity / 100) / 10).toFixed(1)}k`;
    }
    return popularity;
  };

  function formatBytes(bytes: number) {
    const units = ["Bytes", "kB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  interface CsvToHtmlTableProps {
    data: string;
    csvDelimiter: string;
    tableClassName: string;
    columnDescriptions: string;
  }

  type ColumnDescription = {
    col_name: string;
    type_and_description: string;
  };
  const EnhancedCsvToHtmlTable: React.FC<CsvToHtmlTableProps> = ({
    data,
    csvDelimiter = ",",
    tableClassName,
    columnDescriptions,
  }) => {
    // Parse columnDescriptions with selective replacement of single quotes
    let parsed: ColumnDescription[] = [];
    try {
      // Log the input for better debugging
      // console.log("COLUMNS", columnDescriptions);
      // console.log("DATA", data);
        
      if (typeof columnDescriptions === 'string') {
        const trimmed = columnDescriptions.trim();
        
        // Check for dictionary format (starts with [{ and ends with }])
        if (trimmed.startsWith('[{') && trimmed.endsWith('}]')) {
          // Your existing dictionary parsing logic
          const fixedColumnDescriptions = trimmed
            .replace(/'(\w+)':/g, '"$1":')
            .replace(/: '(.*?)'/g, ': "$1"');
          
          parsed = JSON.parse(fixedColumnDescriptions);
        } 
        // Otherwise treat as string array format
        else {
          const entries = trimmed
            .replace(/^\[|\]$/g, '')
            .replace(/"/g, '')
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);
    
          parsed = entries.map(entry => {
            const colonIndex = entry.indexOf(':');
            return {
              col_name: colonIndex === -1 ? entry : entry.substring(0, colonIndex).trim(),
              type_and_description: colonIndex === -1 ? '' : entry.substring(colonIndex + 1).trim()
            };
          });
        }
      }
      // If already an array (either format), use as-is
      else if (Array.isArray(columnDescriptions)) {
        parsed = columnDescriptions;
      }
    
    } catch (error) {
      console.error("Error parsing columnDescriptions:", error);
      parsed = []; // Set empty array in case of error
    }
    // console.log("PARSED", parsed);

    // Normalize keys in columnDescriptionsMap
    const normalizeKey = (key: string) => key.trim().toLowerCase();

    const columnDescriptionsMap = parsed.reduce(
      (acc: Record<string, string>, { col_name, type_and_description }) => {
        // console.log("Current col_name:", col_name);
        // console.log("Current type_and_description:", type_and_description);
        // console.log("Current accumulator:", acc);
        acc[normalizeKey(col_name)] = type_and_description;
        return acc;
      },
      {}
    );

    // Extract CSV headers and rows
    const rows = data.split("\n");
    const headers = rows[0].split(csvDelimiter);
    // console.log(rows);
    // console.log(headers);

    // Filter out empty columns from headers and rows
    const filteredHeaders = headers.filter((header) => header.trim() !== "");
    const filteredRows = rows.slice(1).map((row) => {
      const cells = row.split(csvDelimiter);
      return cells.filter((cell, index) => headers[index].trim() !== ""); // Align with filtered headers
    });

    // CustomHeader component that shows a tooltip on hover
    const CustomHeader: React.FC<{ children?: React.ReactNode }> = ({
      children,
    }) => {
      const headerText = normalizeKey(children?.toString() || "");
      const description =
        columnDescriptionsMap[headerText] || "No description available";

      return (
        <Tippy
          content={description}
          placement="bottom-start"
          delay={[100, 0]}
          offset={[0, -1]}
          duration={200}
          theme="custom-tippy-theme"
        >
          <th style={{ cursor: "help", position: "relative" }}>{children}</th>
        </Tippy>
      );
    };

    return (
      <table className={tableClassName}>
        <thead>
          <tr>
            {filteredHeaders.map((header, index) => (
              <CustomHeader key={index}>{header}</CustomHeader>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const ResultPreview: React.FC<ResultPreviewProps> = ({ dataset, index }) => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    const [expanded, setExpanded] = useState(false);
    if (!dataset) return <div>No dataset selected</div>;
    const source =
      dataset.dataset_source && dataset.dataset_source !== "N/A"
        ? dataset.dataset_source
        : null;
    const collectionMethod =
      dataset.dataset_collection_method &&
      dataset.dataset_collection_method !== "N/A"
        ? dataset.dataset_collection_method
        : null;

    return (
      <div>
        <div className="preview-title">{dataset.database_name} </div>
        <div
          className="preview-title"
          style={{
            fontSize: "16px",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "gray",
          }}
        >
          <AttachFileIcon />
          {dataset.table_name}
        </div>

        <div className="section-row">
          <div className="section-item">
            Usability score:{" "}
            {Math.round(parseFloat(dataset.usability_rating.toString()) * 100) +
              "% "}
          </div>
          <div className="section-item">{dataset.col_num} cols </div>
          <div className="section-item">{dataset.row_num} rows </div>
          <div className="section-item">
            {" "}
            {formatBytes(dataset.file_size_in_byte)}{" "}
          </div>
          <div className="section-item">
            {" "}
            <DownloadIcon style={{ color: "#ccccc", width: "20px" }} />{" "}
            {formatPopularity(dataset.popularity)}{" "}
          </div>
          {dataset.tags
            ? dataset.tags.map((query, index) => (
                <div
                  key={index} // Adding a key to avoid React warnings
                  className="section-item"
                  style={{
                    backgroundColor: "#feebfe",
                    border: "1px solid #fdd4fd",
                  }}
                >
                  {query.replace(/^'|'$/g, '')}
                </div>
              ))
            : null}
          {dataset.time_granu ? (
            <div
              className="section-item"
              style={{
                backgroundColor: "#a9c7ff3b",
                border: "1px solid #cdd6ff",
              }}
            >
              {dataset.time_granu}-Level Granularity{" "}
            </div>
          ) : null}
          {dataset.geo_granu ? (
            <div
              className="section-item"
              style={{
                backgroundColor: "#a9c7ff3b",
                border: "1px solid #cdd6ff",
              }}
            >
              {dataset.geo_granu}-Level Granularity
            </div>
          ) : null}{" "}
        </div>

        {relevanceMap.some((item) => item.index === index) && (
          <>
            <div
              className="preview-subtitle"
              style={{ display: "flex", alignItems: "center" }}
            >
              <AutoAwesomeIcon
                style={{ height: "16px", width: "16px", color: "orange" }}
              />
              &nbsp;<i>Why is this dataset relevant for your task?</i>
            </div>
            <div
              className="description section"
              style={{
                backgroundColor: "#fff4d6",
                border: "1px solid #f6da86",
                minHeight: "40px",
              }}
            >
              <div style={{ marginBottom: "10px" }}>
                <b>Utility: </b>
                {relevanceMap.find((item) => item.index === index)
                  ?.isRelevant || "Loading..."}
              </div>
              <div>
                <b>Limitation: </b>
                {relevanceMap.find((item) => item.index === index)
                  ?.notRelevant || "Loading..."}
              </div>
            </div>
          </>
        )}

        <div className="preview-subtitle">Description</div>
        <div className="description section" style={{ position: "relative" }}>
          <div className="section-content">
            {expanded ? (
              <ReactMarkdown>{dataset.db_description}</ReactMarkdown>
            ) : (
              dataset.dataset_context
            )}
          </div>
          {dataset.db_description !== dataset.dataset_context && (
            <div style={{ marginTop: "16px" }}>
              <button
                onClick={() => setExpanded(!expanded)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#007bff",
                  cursor: "pointer",
                  fontSize: "12px",
                  position: "absolute",
                  right: "0",
                  bottom: "0",
                  textDecoration: "underline",
                }}
              >
                {expanded ? "Show Summary" : "Show More"}
              </button>
            </div>
          )}
        </div>

        <div className="section">
          <div className="preview-subtitle">Dataset Preview</div>
          <div className="table-scroll-container">
            <div className="table-view">
              <EnhancedCsvToHtmlTable
                data={dataset.example_rows_md}
                csvDelimiter="|"
                tableClassName="table table-striped table-hover"
                columnDescriptions={dataset.dataset_column_dictionary}
              />
            </div>
          </div>
        </div>

        {(source || collectionMethod) && (
          <div className="section" style={{ marginBottom: "8px" }}>
            <div className="preview-subtitle">
              Data Source & Collection Method
            </div>
            <div className="section-content" style={{ marginBottom: "0px" }}>
              {collectionMethod && <p>{collectionMethod}</p>}
              {source && (
                <p>
                  Data source references: <i>{source}</i>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const [currentResults, setCurrentResults] = useState(results);
  const [isBlankedOut, setIsBlankedOut] = useState(false);
  interface relevanceMapProps {
    isRelevant: string;
    notRelevant: string;
    index: number;
  }
  const [relevanceMap, setRelevanceMap] = useState<relevanceMapProps[]>(
    Array.from({ length: 5 }, (_, index) => ({
      index,
      isRelevant: "Loading...",
      notRelevant: "Loading...",
    }))
  );

  const generateRelevance = async (index: number) => {
    const relevanceURL = "http://127.0.0.1:5000/api/relevance_map";
    try {
      const searchResponse = await axios.post(relevanceURL, {
        index: index,
        results: results,
        task: task,
        filters: filters,
      });

      // Update relevanceMap for the specific index
      setRelevanceMap((prev) =>
        prev.map((item) =>
          item.index === index
            ? {
                ...item,
                isRelevant: searchResponse.data.results[0].isRelevant,
                notRelevant: searchResponse.data.results[0].notRelevant,
              }
            : item
        )
      );
    } catch (error) {
      console.error("Error fetching relevance for index", index, error);
      // Update relevanceMap to show an error for the specific index
      setRelevanceMap((prev) =>
        prev.map((item) =>
          item.index === index
            ? { ...item, isRelevant: "Error", notRelevant: "Error" }
            : item
        )
      );
    }
  };
  useEffect(() => {}, [relevanceMap]);

  useEffect(() => {
    console.log("CHECKING RESULTS");
    if (JSON.stringify(results) !== JSON.stringify(currentResults)) {
      // If results have changed, blank out the component for 1 second
      setIsBlankedOut(true);
      // Set timeout to revert the blank out effect after 1 second
      setTimeout(() => {
        setIsBlankedOut(false);
        // Update the results after the blank out
      }, 500); // 0.5 second

      // Reset relevanceMap to initial state
      setRelevanceMap(
        Array.from({ length: Math.min(results.length, 5) }, (_, index) => ({
          index,
          isRelevant: "Loading...",
          notRelevant: "Loading...",
        }))
      );
      console.log("UPDATED TO NEW RESULTS");
      setCurrentResults(results);
      handleSelectedIndex(0);

      for (let i = 0; i < 5; i++) {
        generateRelevance(i);
      }
    }
  }, [results, currentResults]);

  const handleDatasetClick = (index: number) => {
    // Check if the index already exists in relevanceMap
    const itemExists = relevanceMap.some((item) => item.index === index);

    // If the index doesn't exist, add a new entry with "Loading..." state
    if (!itemExists) {
      setRelevanceMap((prev) => [
        ...prev,
        { index: index, isRelevant: "Loading...", notRelevant: "Loading..." },
      ]);

      // Generate relevance for the clicked index
      generateRelevance(index);
    }

    // Handle the selected index (your existing logic)
    handleSelectedIndex(index);
  };

  return (
    <div
      className="datasetlist-container"
      style={{
        paddingBottom: "1rem",
        opacity: isBlankedOut ? 0 : 1, // Make it blank out by changing opacity
        transition: "opacity 1s ease", // Smooth transition for opacity change
      }}
    >
      <div className="list">
        <div className="sticky-header">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              position: "sticky",
              top: 0,
              backgroundColor: "white",
              zIndex: 1,
              paddingTop: "0px",
              paddingBottom: "4px",
            }}
          >
            <span
              style={{
                fontWeight: "bold",
                fontSize: "24px",
                marginRight: "1rem",
              }}
            >
              Top Dataset Results
            </span>
            <img
              src="/clipboard.png"
              alt="Dataset Icon"
              style={{ width: "28px", height: "28px" }}
            />
          </div>
          <span
            style={{ paddingLeft: "4px", color: "black", fontSize: "12px" }}
          >
            <i>
              Showing {startIndex + 1} to {Math.min(endIndex, results.length)}{" "}
              of {results.length} datasets.{" "}
            </i>
          </span>
        </div>

        <div
          className="scrollable-dataset-results"
          style={{ paddingTop: "1rem" }}
        >
          {limitedResults.map((result, index) => (
            <ResultItem
              key={startIndex + index}
              dataset={result}
              index={startIndex + index}
              isSelected={selectedIndex === startIndex + index}
              onClick={() => {
                handleDatasetClick(startIndex + index);
              }}
            />
          ))}
        </div>
      </div>
      <div className="preview-container" ref={previewContainerRef}>
        <ResultPreview
          dataset={results[selectedIndex]}
          index={selectedIndex}
        ></ResultPreview>
      </div>
    </div>
  );
};

export default ResultsTable;
