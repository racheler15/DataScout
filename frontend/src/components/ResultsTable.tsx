import "../styles/ResultsTable.css";
// import { CircleArrowLeft, CircleArrowRight } from "lucide-react";
import React, { useState, useEffect } from "react";
//@ts-ignore
import { CsvToHtmlTable } from "react-csv-to-table";
import ReactMarkdown from "react-markdown";

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
};
export interface ResultsTableProps {
  results: ResultProp[];
  open: boolean;
  onResetSearch: () => Promise<void>;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
}
interface ResultItemProps {
  index: number;
  dataset: ResultProp;
  isSelected: boolean;
  onClick: () => void;
}
interface ResultPreviewProps {
  dataset: ResultProp;
}

const ResultsTable: React.FC<ResultsTableProps> = ({
  results,
  open,
  onResetSearch,
  currentPage,
  setCurrentPage,
}: ResultsTableProps) => {
  const [selectedIndex, handleSelectedIndex] = useState(0);
  const pageSize = 20;
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
          <div className="dataset-title"> {dataset.table_name}</div>
          <div className="dataset-stats">
            <span>
              {dataset.cosine_similarity !== undefined &&
              dataset.cosine_similarity !== null
                ? `Similarity: ${dataset.cosine_similarity.toFixed(2)} · `
                : ""}
              Usability score:{" "}
              {Math.round(
                parseFloat(dataset.usability_rating.toString()) * 100
              ) + "% "}
            </span>
            <span>{formatBytes(dataset.file_size_in_byte)}</span>
            <span>
              {dataset.col_num} cols &middot; {dataset.row_num} rows
            </span>
          </div>
        </div>
      </div>
    );
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

  const ResultPreview: React.FC<ResultPreviewProps> = ({ dataset }) => {
    if (!dataset) return <div>No dataset selected</div>;
    return (
      <div>
        <div className="preview-title">{dataset.table_name}</div>

        <div
          className="section"
          style={{
            // border: "1px solid gray",
            borderRadius: "12px",
            background: "rgba(136, 136, 136, 0.1)",
            paddingLeft: "12px",
            paddingTop: "12px",
            marginRight: "12px",
          }}
        >
          <div className="preview-subtitle">Description</div>
          <div className="section-content" style={{ marginRight: "16px" }}>
            <ReactMarkdown className="markdown-content">
              {dataset.db_description}
            </ReactMarkdown>
          </div>
        </div>
        <div className="section">
          <div className="preview-subtitle" style={{ marginBottom: "8px" }}>
            Recommended keywords
          </div>
          <div className="section-content">
            {dataset.keywords ? (
              dataset.keywords.join(", ")
            ) : (
              <div>No recommendations available</div>
            )}
          </div>
        </div>
        <div className="section">
          <div className="preview-subtitle">Columns</div>
          <div className="section-content">{dataset.col_num}</div>
        </div>
        <div className="section">
          <div className="preview-subtitle">Rows</div>
          <div className="section-content">{dataset.row_num}</div>
        </div>
        <div className="section">
          <div className="preview-subtitle">Size</div>
          <div className="section-content">
            {formatBytes(dataset.file_size_in_byte)}
          </div>
        </div>

        <div className="section">
          <div className="preview-subtitle">Tags</div>
          <div className="section-content">
            {dataset.tags ? (
              dataset.tags.join(", ")
            ) : (
              <div>No tags available</div>
            )}
          </div>
        </div>
        <div className="section">
          <div className="preview-subtitle" style={{ marginBottom: "8px" }}>
            Previous queries
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
        </div>
        <div className="section" style={{ paddingBottom: "60px" }}>
          <div className="preview-subtitle">Example Records</div>
          <div className="table-scroll-container">
            <div className="table-view">
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

  useEffect(() => {
    console.log("CHECKING RESULTS");
    if (JSON.stringify(results) !== JSON.stringify(currentResults)) {
      // If results have changed, blank out the component for 1 second
      setIsBlankedOut(true);
      setCurrentResults(results);
      // Set timeout to revert the blank out effect after 1 second
      setTimeout(() => {
        setIsBlankedOut(false);
        // Update the results after the blank out
      }, 1000); // 0.5 second
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
              padding: "16px 0",
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
      <div className="preview-container">
        <ResultPreview dataset={results[selectedIndex]}></ResultPreview>
      </div>
    </div>
  );
};

export default ResultsTable;
