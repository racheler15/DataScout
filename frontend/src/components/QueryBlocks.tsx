import "../styles/QueryBlocks.css";
import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import eyeIcon from "@iconify-icons/fluent/eye-20-regular";
import eyeOffIcon from "@iconify-icons/fluent/eye-off-20-regular";
import { X } from "lucide-react";
import FilterPrompt from "./FilterPrompt";
import { MessageProps } from "./MessageItem";
import axios from "axios";
import { ResultProp } from "./ResultsTable";

interface QueryBlocksProps {
  setResults: (a: ResultProp[]) => unknown;
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
  setResults,
  currentPage,
  setCurrentPage,
}: QueryBlocksProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

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
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
    setIconVisibility((prev) => prev.filter((_, i) => i !== index)); // Update visibility state
  };

  const handleClick = () => {
    setIsModalOpen(true); // Open the modal when "+" is clicked
  };

  useEffect(() => {
    if (pendingFilter) {
      console.log("Processing filter:", pendingFilter);
      handleNewFilterSubmit(pendingFilter);
      setPendingFilter(null); // Reset after processing
    }
  }, [pendingFilter]);

  useEffect(() => {
    // Define the async function inside the useEffect
    const updateData = async () => {
      try {
        const visibleFilters = filters.filter(
          (_, index) => iconVisibility[index]
        );
        const refineResponse = await axios.post(
          "http://127.0.0.1:5000/api/refine_metadata",
          {
            cur_query: task,
            filters: visibleFilters,
          }
        );
        console.log(refineResponse);
        setResults(refineResponse.data.complete_results);
        setCurrentPage(1);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    // Call the async function
    updateData();
  }, [filters, iconVisibility]);

  const handleNewFilterSubmit = async (filter: string) => {
    try {
      const submitResponse = await axios.post(
        "http://127.0.0.1:5000/api/add_metadata",
        {
          attribute: filter,
        }
      );

      const newMetadata = submitResponse.data.metadata;
      console.log(newMetadata);

      // Check if newMetadata is empty
      if (!newMetadata || newMetadata.length === 0) {
        throw new Error("The submitted metadata is invalid or empty.");
        // } else if (activeFilters.includes(newMetadata[0])) {
        //   throw new Error(
        //     "The submitted metadata is already being used in filters."
        //   );
      }
      // Update states on successful response
      setFilters((prev) => [...prev, newMetadata[1]]); // Add the new filter
      setIconVisibility((prev) => [...prev, true]); // Update visibility state
      setActiveFilters((prev) => [...prev, newMetadata[0]]); // Add new active filter to list

      const refineResponse = await axios.post(
        "http://127.0.0.1:5000/api/refine_metadata",
        {
          cur_query: task,
          filters: [...filters, newMetadata[1]],
        }
      );
      console.log(refineResponse);
      setResults(refineResponse.data.complete_results);
      setCurrentPage(1);
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error submitting filter:", error.message);
        alert(`Failed to submit filter: ${error.message}`);
      } else {
        console.error("Unexpected error:", error);
        alert("An unexpected error occurred.");
      }
    }
  };

  useEffect(() => {
    setInput(task);
  }, [task]);

  const [input, setInput] = useState(""); // State to track user input

  return (
    <div className="query-container">
      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={{ fontWeight: "bold", marginRight: "0.5rem" }}>
          Query Decomposition
        </span>
        <img
          src="/lego-block.png"
          alt="Blocks Icon"
          style={{ width: "40px", height: "40px" }}
        />
      </div>{" "}
      <div className="blocks-container">
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
      </div>
      <FilterPrompt
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)} // Close modal
        onSubmit={handleNewFilterSubmit} // Handle new filter submission
        messages={messages}
        setMessages={setMessages}
        activeFilters={activeFilters}
      />
    </div>
  );
};

export default QueryBlocks;
