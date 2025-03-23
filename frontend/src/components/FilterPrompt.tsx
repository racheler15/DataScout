import { useState, useEffect } from "react";
import "../styles/FilterPrompt.css";
import axios from "axios";
//@ts-expect-error react-csv table unsupported by react18
import { CsvToHtmlTable } from "react-csv-to-table";
import { ResultProp } from "./ResultsTable";
import { MetadataFilter } from "../App";
interface FilterPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (filter: string) => void;
  activeFilters: string[];
  results: ResultProp[];
  setResults: (a: ResultProp[]) => unknown;
  setFilters: React.Dispatch<React.SetStateAction<MetadataFilter[]>>;
  setIconVisibility: React.Dispatch<React.SetStateAction<boolean[]>>;
}

const FilterPrompt: React.FC<FilterPromptProps> = ({
  isOpen,
  onClose,
  onSubmit,
  activeFilters,
  results,
  setResults,
  setFilters,
  setIconVisibility,
}) => {
  const dummyFilter: Filter = { name: "", operations: [], values: [] };
  const [avaliableFilters, setAvaliableFilters] = useState<Filter[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<Filter>(dummyFilter);
  const [selectedOperation, setSelectedOperation] = useState<string>("");
  const [inputValue, setInputValue] = useState<string>("");
  const [csvData, setCsvData] = useState("");

  useEffect(() => {
    const fetchRemainingAttributes = async () => {
      try {
        const fetchResponse = await axios.post(
          "http://127.0.0.1:5000/api/remaining_attributes",
          {
            attributes: "[]",
          }
        );
        setCsvData(fetchResponse.data.csv_data);

        const dataFilters = fetchResponse.data.filters;
        setAvaliableFilters(dataFilters);
        if (dataFilters.length > 0) {
          setSelectedFilter(dataFilters[0]);
          setSelectedOperation(dataFilters[0].operations[0] || ""); // Default to the first operation if available
          setInputValue(dataFilters[0].values[0] || ""); // Default to the first value if available
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchRemainingAttributes();
  }, [activeFilters]);

  const handleMetadata = async () => {
    console.log(selectedFilter);
    console.log(results.length);
    console.log(inputValue);
    console.log(results);
    if (selectedFilter) {
      try {
        const fetchResponse = await axios.post(
          "http://127.0.0.1:5000/api/manual_metadata",
          {
            selectedFilter: selectedFilter.name,
            selectedOperation: selectedOperation,
            value: inputValue,
            results: results,
          }
        );
        console.log(fetchResponse.data);

        setResults(fetchResponse.data.results);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    }
  };

  const handleSubmit = () => {
    if (selectedFilter && selectedOperation && inputValue) {
      const filterString = `${selectedFilter.name} ${selectedOperation} ${inputValue}`;
      console.log(filterString);
      handleMetadata();
      setFilters((prev) => [
        ...prev,
        {
          type: "normal",
          filter: filterString,
          value: inputValue,
          operand: selectedOperation,
          subject: selectedFilter.name,
          visible: true,
          active: true,
        },
      ]);
      setIconVisibility((prev) => [...prev, true]);

      onSubmit(filterString);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="filter-overlay">
      <div className="filter-content">
        <div style={{ fontWeight: "bold", fontSize: "20px" }}>
          Manually Add Metadata Filter
        </div>
        <IndividualFilter
          avaliableFilters={avaliableFilters}
          selectedFilter={selectedFilter}
          setSelectedFilter={setSelectedFilter}
          selectedOperation={selectedOperation}
          setSelectedOperation={setSelectedOperation}
          inputValue={inputValue}
          setInputValue={setInputValue}
        />
        <div className="remaining-attributes">
          Available metadata filters:
          <div
            style={{
              fontSize: "12px",
              marginBottom: "4px",
              marginTop: "4px",
              fontWeight: "normal",
            }}
          >
            <i>Scroll to view</i>
          </div>
          <div className="table-container">
            <CsvToHtmlTable
              data={csvData}
              csvDelimiter="|"
              tableClassName="table table-hover table-striped"
              className="table-blue"
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "1rem",
          }}
        >
          <button onClick={onClose}>Cancel</button>
          <button
            onClick={handleSubmit}
            style={{ marginLeft: "1rem", backgroundColor: "#b2caff" }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
};
export default FilterPrompt;
interface Filter {
  name: string;
  operations: string[];
  values: string[];
}

interface IndividualFilterProps {
  avaliableFilters: Filter[];
  selectedFilter: Filter;
  setSelectedFilter: React.Dispatch<React.SetStateAction<Filter>>;
  selectedOperation: string;
  setSelectedOperation: React.Dispatch<React.SetStateAction<string>>;
  inputValue: string;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
}

const IndividualFilter: React.FC<IndividualFilterProps> = ({
  avaliableFilters,
  selectedFilter,
  setSelectedFilter,
  selectedOperation,
  setSelectedOperation,
  inputValue,
  setInputValue,
}) => {
  const handleNameChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const filterName = event.target.value;
    const filter = avaliableFilters.find((f) => f.name === filterName);
    if (filter) {
      setSelectedFilter(filter);
      setSelectedOperation(filter.operations[0]);
      setInputValue(filter.values[0] || "");
    }
  };

  const handleValueChange = (
    event: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>
  ) => {
    setInputValue(event.target.value);
  };

  return (
    <div className="individual-filter-container">
      <div className="dropdown-container">
        <label htmlFor="filter-name-dropdown">Filter Name</label>
        <select
          id="filter-name-dropdown"
          value={selectedFilter.name}
          onChange={handleNameChange}
        >
          {avaliableFilters.map((filter, index) => (
            <option key={index} value={filter.name}>
              {filter.name}
            </option>
          ))}
        </select>
      </div>

      <div className="dropdown-container">
        <label htmlFor="operation-dropdown">Operation</label>
        {selectedFilter.operations.length > 1 ? (
          <select
            id="operation-dropdown"
            value={selectedOperation}
            onChange={(e) => setSelectedOperation(e.target.value)}
          >
            {selectedFilter.operations.map((operation, index) => (
              <option key={index} value={operation}>
                {operation}
              </option>
            ))}
          </select>
        ) : (
          <span
            style={{
              padding: "8px",
              fontSize: "12px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              width: "180px",
              outline: "none",
              height: "36px",
              backgroundColor: "#f6f6f6",
            }}
          >
            {selectedFilter.operations[0]}
          </span>
        )}
      </div>

      <div className="dropdown-container">
        <label htmlFor="value-dropdown">Value</label>
        {selectedFilter.values.length > 0 ? (
          <select
            id="value-dropdown"
            value={inputValue}
            onChange={handleValueChange}
          >
            {selectedFilter.values.map((value, index) => (
              <option key={index} value={value}>
                {value}
              </option>
            ))}
          </select>
        ) : (
          <input
            id="value-dropdown"
            type="text"
            value={inputValue}
            onChange={handleValueChange}
            placeholder={
              selectedFilter.name === "file_size_in_byte"
                ? "Enter integer value in MB"
                : [
                    "table_name",
                    "database_name",
                    "db_description",
                    "tags",
                    "keywords",
                    "metadata_queries",
                    "task_queries",
                  ].includes(selectedFilter.name)
                ? "Enter keywords"
                : selectedFilter.name === "usability_rating"
                ? "Enter % from 0-100"
                : selectedFilter.name == "row_num" ||
                  selectedFilter.name == "col_num" ||
                  selectedFilter.name == "popularity"
                ? "Enter integer value"
                : selectedFilter.name == "column_specification"
                ? "Enter column name"
                : "Enter custom value"
            }
          />
        )}
      </div>
    </div>
  );
};
