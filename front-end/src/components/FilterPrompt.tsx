import { useState } from "react";
import "../styles/FilterPrompt.css";
import { MessageProps, SYSTEM_UPDATES} from "./ChatBot";

interface FilterPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (filter: string) => void;
  messages: MessageProps[];
  setMessages: React.Dispatch<React.SetStateAction<MessageProps[]>>;
}

const FilterPrompt: React.FC<FilterPromptProps> = ({
  isOpen,
  onClose,
  onSubmit,
  messages,
  setMessages,
}) => {
  const [filterValue, setFilterValue] = useState("");

  const remaining = ["# cols", "popularity", "location", "time"];
  const handleSubmit = () => {
    const reply: MessageProps = {
      id: messages.length + 1,
      text: (
        <>  
        <div className="system-update-response">
          {SYSTEM_UPDATES[2]}
        </div>
        </>
      ),
      sender: "system",
      show: false,
    };
    if (filterValue) {
      onSubmit(filterValue);
      setFilterValue(""); // Clear input after submission
      onClose(); // Close the modal
      setMessages((prevMessages) => [...prevMessages, reply])
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
          <div className="wrapped-attributes-container">
            {remaining.map((attribute, index) => (
              <div key={index} className="wrapped-attributes">
                {attribute}
              </div>
            ))}
          </div>
        </div>

        <textarea
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          placeholder="Enter new metadata filter..."
          style={{
            width: "100%",
            minHeight: "80px",
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
