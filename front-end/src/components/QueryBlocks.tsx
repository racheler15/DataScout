import "../styles/QueryBlocks.css";
import { useState, useRef, useEffect } from "react";
import { Icon } from "@iconify/react";
import eyeIcon from "@iconify-icons/fluent/eye-20-regular";
import eyeOffIcon from "@iconify-icons/fluent/eye-off-20-regular";
import { X } from "lucide-react";
import FilterPrompt from "./FilterPrompt";
import { MessageProps, SYSTEM_UPDATES } from "./ChatBot";

interface QueryBlocksProps {
  task: string;
  setTask: React.Dispatch<React.SetStateAction<string>>;
  filters: string[];
  setFilters: React.Dispatch<React.SetStateAction<string[]>>;
  iconVisibility: boolean[];
  setIconVisibility: React.Dispatch<React.SetStateAction<boolean[]>>;
  messages: MessageProps[];
  setMessages: React.Dispatch<React.SetStateAction<MessageProps[]>>;
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
}: QueryBlocksProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const handleNewFilterSubmit = (filter: string) => {
    setFilters((prev) => [...prev, filter]); // Add the new filter
    setIconVisibility((prev) => [...prev, true]); // Update visibility state
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
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault(); // Prevent new line on Enter
                  setTask(task);
                  const updatedTask: MessageProps = {
                    id: messages.length + 1,
                    text: (
                      <>
                        <div className="system-update-response">
                          {SYSTEM_UPDATES[0]}
                        </div>
                      </>
                    ),
                    sender: "system",
                    show: false,
                  };
                  setMessages((prevMessages) => [...prevMessages, updatedTask]);
                  console.log("NEW TASK: ", task);
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
      <FilterPrompt
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)} // Close modal
        onSubmit={handleNewFilterSubmit} // Handle new filter submission
        messages={messages}
        setMessages={setMessages}
      />
    </div>
  );
};

export default QueryBlocks;
