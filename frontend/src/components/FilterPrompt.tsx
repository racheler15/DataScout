import { useState, useEffect } from "react";
import "../styles/FilterPrompt.css";
import { MessageProps } from "./MessageItem";
import axios from "axios";

interface FilterPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (filter: string) => void;
  messages: MessageProps[];
  setMessages: React.Dispatch<React.SetStateAction<MessageProps[]>>;
  activeFilters: string[];
}

const FilterPrompt: React.FC<FilterPromptProps> = ({
  isOpen,
  onClose,
  onSubmit,
  messages,
  setMessages,
  activeFilters,
}) => {
  const [filterValue, setFilterValue] = useState("");
  const [suggestedAttributes, setSuggestedAttributes] = useState<{
    [key: string]: string;
  }>({});

  useEffect(() => {
    const fetchRemainingAttributes = async () => {
      try {
        const fetchResponse = await axios.post(
          "http://127.0.0.1:5000/api/remaining_attributes",
          {
            // attributes: activeFilters,
            attributes: "[]",

          }
        );
        setSuggestedAttributes(fetchResponse.data.attributes);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchRemainingAttributes();
  }, [activeFilters]);

  const handleSubmit = () => {
    if (filterValue) {
      onSubmit(filterValue);
      setFilterValue(""); // Clear input after submission
      onClose(); // Close the modal
    }
  };

  if (!isOpen) return null; // Don't render anything if modal is not open

  return (
    <div className="filter-overlay">
      <div className="filter-content">
        <div style={{ fontWeight: "bold", fontSize: "20px" }}>
          Manually Add Metadata Filter
        </div>
        <div className="remaining-attributes">
          Avaliable metadata attributes:
          <div
            style={{
              fontSize: "12px",
              marginBottom: "4px",
              marginTop: "4px",
              fontWeight: "normal",
            }}
          >
            <i>Hover to see data type</i>
          </div>
          <div className="wrapped-attributes-container">
            {Object.entries(suggestedAttributes).map(([key, value], index) => (
              <div
                key={index}
                className="wrapped-attributes"
                title={value} // Tooltip that shows the value on hover
              >
                {key}
              </div>
            ))}
          </div>
        </div>

        <textarea
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          placeholder="Enter new metadata filter..."
          rows = {1}
          style={{
            width: "100%",
            borderRadius: "8px",
            padding: "8px",
          }}
        />
        <div style={{ fontSize: "12px", marginBottom: "4px" }}>
          <i>
            This step is for users who know a specific metadata attribute to
            filter the search space. Otherwise, you can generate it in the chat
            interface below.
          </i>
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
