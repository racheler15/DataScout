import "../styles/ResultsTable.css";
// import { CircleArrowLeft, CircleArrowRight } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import DownloadIcon from "@mui/icons-material/Download";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import ReactMarkdown from "react-markdown";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import axios from "axios";
import { MetadataFilter } from "../App";
//@ts-ignore
import { CsvToHtmlTable } from "react-csv-to-table";
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
  open,
  onResetSearch,
  currentPage,
  setCurrentPage,
  task,
  filters,
}: ResultsTableProps) => {
  const [selectedIndex, handleSelectedIndex] = useState(0);
  const pageSize = 50;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  // Get the datasets to be displayed for the current page
  const limitedResults = results.slice(startIndex, endIndex);
  const totalPages = Math.ceil(results.length / pageSize);

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
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
              {dataset.cosine_similarity !== undefined &&
              dataset.cosine_similarity !== null
                ? `Relevance Score: ${Math.round(
                    dataset.cosine_similarity * 100
                  ).toFixed(0)}% · `
                : ""}
              Usability score:{" "}
              {Math.round(
                parseFloat(dataset.usability_rating.toString()) * 100
              ) + "% "}
            </span>
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
  interface TableHeaderProps {
    children: string;
  }
  type ColumnDescription = {
    col_name: string;
    type_and_description: string;
  };
  const EnhancedCsvToHtmlTable: React.FC<CsvToHtmlTableProps> = ({
    data,
    csvDelimiter,
    tableClassName,
    columnDescriptions,
  }) => {
    // Convert columnDescriptions to a dictionary for easier lookup
    const fixedColumnDescriptions = columnDescriptions.replace(/'/g, '"');
    const parsed: ColumnDescription[] = JSON.parse(fixedColumnDescriptions);

    const columnDescriptionsMap = parsed.reduce(
      (acc: Record<string, string>, { col_name, type_and_description }) => {
        acc[col_name] = type_and_description;
        return acc;
      },
      {} // Initial empty object for the accumulator
    );

    console.log(columnDescriptionsMap);

    // CustomHeader component that shows a tooltip on hover
    const CustomHeader: React.FC<{ children?: React.ReactNode }> = ({
      children,
    }) => {
      const headerText = children?.toString() || "";
      return (
        <Tippy
          content={
            columnDescriptionsMap[headerText] || "No description available"
          }
          placement="top"
          delay={[100, 0]}
          duration={200}
        >
          <th style={{ cursor: "help", position: "relative" }}>{children}</th>
        </Tippy>
      );
    };

    return (
      <CsvToHtmlTable
        data={data}
        csvDelimiter={csvDelimiter}
        tableClassName={tableClassName}
        tableHeaderRenderer={(props) => <CustomHeader {...props} />}
        hasHeader={true}
        renderCell={(cell) => cell}
      />
    );
  };

  const ResultPreview: React.FC<ResultPreviewProps> = ({ dataset, index }) => {
    // useEffect(() => {
    //   if (dataset?.dataset_column_dictionary) {
    //     console.log(dataset.dataset_column_dictionary);
    //     const fixedColumnDescriptions =
    //       dataset.dataset_column_dictionary.replace(/'/g, '"');
    //     const columnDescriptions = JSON.parse(fixedColumnDescriptions);
    //     console.log(columnDescriptions);
    //   }
    // }, [dataset]);
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
        <div className="preview-title">{dataset.database_name}</div>
        <div
          className="preview-title"
          style={{
            fontSize: "20px",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AttachFileIcon />
          {dataset.table_name}
        </div>

        <div className="section-row">
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
          {dataset.time_granu ? (
            <div
              className="section-item"
              style={{ backgroundColor: "#a9c7ff3b" }}
            >
              {dataset.time_granu}-Level Granularity{" "}
            </div>
          ) : null}
          {dataset.geo_granu ? (
            <div
              className="section-item"
              style={{ backgroundColor: "#a9c7ff3b" }}
            >
              {dataset.geo_granu}-Level Granularity
            </div>
          ) : null}{" "}
        </div>
        {index < 10 && (
          <>
            <div className="preview-subtitle">
              Why this dataset is relevant?
            </div>
            <div
              className="description section"
              style={{
                backgroundColor: "#d9fcddb7",
                border: "1px solid #68ca73",
                minHeight: "40px",
              }}
            >
              {relevanceMap[index].isRelevant}
            </div>
          </>
        )}

        {index < 10 && (
          <>
            <div className="preview-subtitle">
              Why this dataset is not relevant?
            </div>
            <div
              className="description section"
              style={{
                backgroundColor: "#fff4d6",
                border: "1px solid #f6da86",
                minHeight: "40px",
              }}
            >
              {relevanceMap[index].notRelevant}
            </div>
          </>
        )}

        <div className="preview-subtitle">Description</div>
        <div className="description section">
          <div className="section-content">
            {expanded ? (
              <ReactMarkdown>{dataset.db_description}</ReactMarkdown>
            ) : (
              dataset.dataset_context
            )}
          </div>

          {dataset.db_description !== dataset.dataset_context && (
            <div style={{ textAlign: "right" }}>
              <button
                onClick={() => setExpanded(!expanded)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#007bff",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                {expanded ? "Show Less" : "Show More"}
              </button>
            </div>
          )}
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
        {/* <div className="section">
          <div className="preview-subtitle" style={{ marginBottom: "8px" }}>
            Tags
          </div>
          <div className="section-content">
            {dataset.tags ? (
              dataset.tags.join(", ")
            ) : (
              <div>No recommendations available</div>
            )}
          </div>
        </div> */}
        <div className="section">
          <div className="preview-subtitle">Tags</div>
          <div className="previous-query-container">
            {dataset.tags ? (
              dataset.tags.map((query, index) => (
                <div key={index} className="previous-query">
                  {query}
                </div>
              ))
            ) : (
              <div style={{ fontSize: "12px" }}>No tags available</div>
            )}
          </div>
        </div>
        {/* <div className="section">
          <div className="preview-subtitle" style={{ marginBottom: "8px" }}>
            Potential Use Cases
          </div>
          <div className="previous-query-container">
            {dataset.task_queries ? (
              dataset.task_queries.slice(0, 3).map((query, index) => (
                <div key={index} className="previous-query">
                  {query}
                </div>
              ))
            ) : (
              <div style={{ fontSize: "12px" }}>
                No previous queries available
              </div>
            )}
          </div>
        </div> */}

        <div className="section">
          <div className="preview-subtitle">Example Records</div>
          <div className="table-scroll-container">
            <div className="table-view">
              {/* <EnhancedCsvToHtmlTable
                data={dataset.example_rows_md}
                csvDelimiter="|"
                tableClassName="table table-striped table-hover"
                columnDescriptions={dataset.dataset_column_dictionary}
              /> */}
              <CsvToHtmlTable
                data={dataset.example_rows_md}
                csvDelimiter="|"
                tableClassName="table table-striped table-hover"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const [currentResults, setCurrentResults] = useState(results);
  const [isBlankedOut, setIsBlankedOut] = useState(false);
  interface relevanceMapProps {
    isRelevant: string;
    notRelevant: string;
  }
  const [relevanceMap, setRelevanceMap] = useState<relevanceMapProps[]>(
    Array(10).fill({ isRelevant: "Loading...", notRelevant: "Loading..." })
  );
  const generateRelevance = async () => {
    console.log("GENERATING RELEVANCE");
    const relevanceURL = "http://127.0.0.1:5000/api/relevance_map";
    try {
      const searchResponse = await axios.post(relevanceURL, {
        results: results,
        task: task,
        filters: filters,
      });
      console.log("RELEVANCE", searchResponse.data);
      setRelevanceMap(searchResponse.data.results);

      // Update datasetCount based on the filtered results
    } catch (error) {
      console.error("Error fetching filtered datasets:", error);
    }
  };

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
      setRelevanceMap(
        Array(10).fill({ isRelevant: "Loading...", notRelevant: "Loading..." })
      );
      setCurrentResults(results);
      generateRelevance();
    }
  }, [results, currentResults]);

  return (
    <div
      className="datasetlist-container"
      style={{
        paddingBottom: "2rem",
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
              paddingBottom: "16px",
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
                handleSelectedIndex(startIndex + index);
              }}
            />
          ))}
        </div>
        {/* <div className="page-selector">
          <div onClick={goToPreviousPage} style={{ cursor: "pointer" }}>
            <CircleArrowLeft /> Previous
          </div>{" "}
          <div onClick={goToNextPage} style={{ cursor: "pointer" }}>
            Next <CircleArrowRight />
          </div>
        </div> */}
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
