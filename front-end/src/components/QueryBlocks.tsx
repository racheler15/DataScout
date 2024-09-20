import "../styles/QueryBlocks.css";
import { useState, useRef, useEffect } from "react";
import { Icon } from "@iconify/react";
import eyeIcon from "@iconify-icons/fluent/eye-20-regular";
import eyeOffIcon from "@iconify-icons/fluent/eye-off-20-regular";
import { X } from "lucide-react";

interface QueryBlocksProps {
  task: string;
  setTask: (task: string) => void;
  filter: string;
  setFilter: (task: string) => void;
}

interface FilterItemProps {
  filter: string;
  isVisible: boolean;
  onToggle: () => void;
  onRemove: () => void;
}

const QueryBlocks = ({}: QueryBlocksProps) => {
  const [task, setTask] = useState("");
  const [filters, setFilters] = useState(["f", '3']);
  const [iconVisibility, setIconVisibility] = useState<boolean[]>(
    new Array(filters.length).fill(true)
  );

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
                width: "400px",
              }}
              value={task}
              onChange={(e) => setTask(e.target.value)}
              // onKeyDown={(e) => {
              //   if (e.key === "Enter") {
              //     e.preventDefault(); // Prevent new line on Enter
              //     setTask(task);
              //   }
              // }}
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
          <span className="label">metadata</span>
          <div className="filter-tags">
            {filters.length === 0 ? (
              <div
                className="filter-prompt"
                style={{ color: "grey", paddingLeft: "8px" }}
              >
                No metadata filters added.
              </div>
            ) : (
              filters.map((filter, index) => (
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
    </div>
  );
};

export default QueryBlocks;
