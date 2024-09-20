import { Button } from "@chatscope/chat-ui-kit-react";
import "../styles/ResultsTable.css";
import { useState } from "react";
import { CircleArrowLeft, CircleArrowRight } from "lucide-react";

import React from "react";
export type ResultProp = {
  table_tags: string[];
  table_desc: string;
  previous_queries: string[];
  // example_records: Record<string, any>[];
  col_num: number;
  cosine_similarity: number;
  geo_granu: number[];
  popularity: number;
  table_name: string;
  time_granu: string[];
};
export interface ResultsTableProps {
  results: ResultProp[];
  open: boolean;
  onResetSearch: () => Promise<void>;
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
}: ResultsTableProps) => {
  const [selectedIndex, handleSelectedIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
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
            <span>Dataset popularity: {dataset.popularity}</span>
            <span>{dataset.col_num} cols</span>
          </div>
        </div>
      </div>
    );
  };

  const ResultPreview: React.FC<ResultPreviewProps> = ({ dataset }) => {
    if (!dataset) return <div>No dataset selected</div>;
    return (
      <div>
        <div className="preview-title">{dataset.table_name}</div>
        <div className="section">
          <div className="preview-subtitle">Description</div>
          <div className="section-content">{dataset.table_desc}</div>
        </div>
        <div className="section">
          <div className="preview-subtitle" style={{ marginBottom: "8px" }}>
            Previous queries
          </div>
          <div className="previous-query-container">
            {dataset.previous_queries ? (
              dataset.previous_queries.slice(0, 3).map((query, index) => (
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
        <div className="section">
          <div className="preview-subtitle">Example Records</div>
          {/* {dataset.example_records} */}

        </div>
        <div className="section">
          <div className="preview-subtitle">Tags</div>
          <div className="section-content">
            {dataset.table_tags ? dataset.table_tags.join(", ") : <div>No tags available</div>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="datasetlist-container" style={{ paddingBottom: "2rem" }}>
      <div className="list">
        <div className="sticky-header">
          <div style={{ display: "flex", alignItems: "center" }}>
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
        {/* <button style ={{background:"lightblue"}} onClick={onResetSearch} >Reset Search Space</button> */}
        <div className="page-selector">
          <div onClick={goToPreviousPage} style={{ cursor: "pointer" }}>
            <CircleArrowLeft /> Previous
          </div>{" "}
          <div onClick={goToNextPage} style={{ cursor: "pointer" }}>
            Next <CircleArrowRight />
          </div>
        </div>
      </div>
      <div className={`preview-container ${open ? "small" : ""}`}>
        <ResultPreview dataset={results[selectedIndex]}></ResultPreview>
      </div>
    </div>
  );
};

export default ResultsTable;
