import "./App.css";
import ResultsTable, { ResultProp } from "./components/ResultsTable";
import { useState } from "react";
import ChatContainer from "./components/ChatContainer";

function App() {
  const [chatOpen, setChatOpen] = useState(true);
  const [results, setResults] = useState<ResultProp[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  
  return (
    <div
      className={`app-container ${chatOpen ? "" : "chat-close"}`}
    >
      <ResultsTable
        results={results}
        open={chatOpen}
        onResetSearch={async () => {}}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
      />
      <ChatContainer
        chatOpen={chatOpen}
        setChatOpen={setChatOpen}
        results={results}
        setResults={setResults}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
      />
    </div>
  );
}

export default App;
