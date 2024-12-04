import axios from "axios";

export interface MessageProps {
  id: number;
  text: string | React.ReactNode;
  sender: "user" | "system";
  show: boolean;
  type: "task_agent" | "metadata_agent" | "general";
}

export interface MessageItemProps {
  message: MessageProps;
  task: string;
  setTask: (task: string) => void;
  filters: string[];
  setFilters: React.Dispatch<React.SetStateAction<string[]>>;
}

const MessageItem = ({
  message,
  task,
  setTask,
  filters,
  setFilters,
}: MessageItemProps) => {
  const senderStyle = {
    color: message.sender === "user" ? "#3D5D9F" : "#A02A2A",
    paddingRight: message.sender === "user" ? "20px" : "0px",
  };

  const handleTaskClick = async (message: string) => {
    const clickUrl = "http://127.0.0.1:5000/api/get_task";
    const searchResponse = await axios.post(clickUrl, {
      query: message,
      filters: filters,
    });
    console.log(searchResponse);
    setTask(message);
  };

  return (
    <div className={`message-container ${message.show ? "" : "show"}`}>
      {message.show && (
        <>
          {message.type === "task_agent" ? (
            // Case 1: Task
            <div
              className="task-type"
              onClick={() => {
                if (typeof message.text === "string") {
                  handleTaskClick(message.text);
                } else {
                  console.error("Message text is not a string:", message.text);
                }
              }}
              style={{
                cursor: "pointer",
                color: "blue",
                textDecoration: "underline",
              }}
            >
              <span>{message.text}</span>
            </div>
          ) : message.type === "metadata_agent" ? (
            // Case 2: Metadata
            <div className="metadata-type">
              <span>{message.text}</span>
            </div>
          ) : (
            // Case 3: General type (default)
            <div className="general-message">
              <div className="user" style={senderStyle}>
                {message.sender === "user" ? "User:" : "System:"}{" "}
              </div>
              <div className="text">{message.text}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
export default MessageItem;
