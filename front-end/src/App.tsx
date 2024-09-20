import "./App.css";
import Diagram from "./components/Diagram";
import ResultsTable, { ResultProp } from "./components/ResultsTable";
import { useState } from "react";
import ChatContainer from "./components/ChatContainer";

function App() {
  const [chatOpen, setChatOpen] = useState(true);
  const [results, setResults] = useState<ResultProp[]>([]);
  return (
    <div className={`app-container ${chatOpen ? "": "chat-close"}`}>
      <ResultsTable results={results} open = {chatOpen} onResetSearch={async () => {}} />
      <ChatContainer
        chatOpen={chatOpen}
        setChatOpen={setChatOpen}
        setResults={setResults}
      />
    </div>
  );
}

export default App;
