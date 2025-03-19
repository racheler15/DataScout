import { MessageProps } from "./MessageItem";
import ChatBot from "./ChatBot";
import QueryBlocks from "./QueryBlocks";
import "../styles/ChatContainer.css";
import { ArrowRightToLine, ArrowLeftFromLine } from "lucide-react";
import { ResultProp } from "./ResultsTable";
import axios from "axios";
import { useEffect, useState } from "react";

interface ChatContainerProps {
  chatOpen: boolean;
  setChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setResults: (a: ResultProp[]) => unknown;
  results: ResultProp[];
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  task: string;
  setTask: React.Dispatch<React.SetStateAction<string>>;
  settingsSpecificity: string;
  setSettingsSpecificity: React.Dispatch<React.SetStateAction<string>>;
  settingsGoal: string;
  setSettingsGoal: React.Dispatch<React.SetStateAction<string>>;
  settingsDomain: string;
  setSettingsDomain: React.Dispatch<React.SetStateAction<string>>;
  settingsGenerate: boolean;
  setSettingsGenerate: React.Dispatch<React.SetStateAction<boolean>>;
  setTaskRec: React.Dispatch<React.SetStateAction<[string, any][]>>;
}
export interface MetadataFilter {
  type: "knn" | "normal"; // Add other types as needed
  filter: string; // The whole filter
  value: string;
  operand: string;
  subject: string;
  visible: boolean;
}

const ChatContainer: React.FC<ChatContainerProps> = ({
  chatOpen,
  setChatOpen,
  setResults,
  results,
  currentPage,
  setCurrentPage,
  task,
  setTask,
  settingsSpecificity,
  setSettingsSpecificity,
  setSettingsGoal,
  settingsGoal,
  settingsDomain,
  setSettingsDomain,
  settingsGenerate,
  setSettingsGenerate,
  setTaskRec,
}) => {
  // useEffect(() => {
  //   // Fetch most popular datasets when the component mounts
  //   const fetchMostPopularDatasets = async () => {
  //     try {
  //       const response = await axios.get(
  //         "http://127.0.0.1:5000/api/most_popular_datasets"
  //       );
  //       console.log("POPULAR RESULTS: ", response);

  //       setResults(response.data); // Set results with the fetched data
  //     } catch (error) {
  //       console.error("Error fetching top 10 popular datasets:", error);
  //     }
  //   };
  //   fetchMostPopularDatasets();
  // }, [setResults]); // Dependency array includes setResults

  const suggested_tasks = {
    "Train a predictive model on voter turnout in presidential elections":
      "Identified a specific task: train a predictive model",

    "Train a predictive model on crime rates in major cities":
      "Identified a specific task: predictive model",

    "Analyze consumer behavior for food based on race":
      "Identified a specific task: analyze",
  };

  const demovega = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    data: {
      values: [
        { "IMDB Rating": 8.5 },
        { "IMDB Rating": 7.2 },
        { "IMDB Rating": 9.0 },
        { "IMDB Rating": 6.5 },
        { "IMDB Rating": 7.8 },
        { "IMDB Rating": 8.1 },
        { "IMDB Rating": 7.0 },
        { "IMDB Rating": 6.8 },
        { "IMDB Rating": 8.7 },
        { "IMDB Rating": 7.5 },
        { "IMDB Rating": 50 },
      ],
    },
    params: [
      {
        name: "highlightBin",
        value: 0,
        bind: {
          input: "range",
          min: 0,
          max: 10,
          step: 1,
        },
      },
    ],
    layer: [
      {
        mark: "bar",
        encoding: {
          x: { field: "IMDB Rating", bin: true },
          y: { aggregate: "count" },
          color: {
            condition: {
              test: "highlightBin >= datum['bin_maxbins_10_IMDB Rating']",
              value: "orange",
            },
            value: "lightgray",
          },
        },
      },
    ],
  };

  const demogvega2 = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    data: {
      values: [
        { "IMDB Rating": 8.5 },
        { "IMDB Rating": 7.2 },
        { "IMDB Rating": 9.0 },
        { "IMDB Rating": 6.5 },
        { "IMDB Rating": 7.8 },
        { "IMDB Rating": 8.1 },
        { "IMDB Rating": 7.0 },
        { "IMDB Rating": 6.8 },
        { "IMDB Rating": 8.7 },
        { "IMDB Rating": 7.5 },
      ],
    },
    signals: [
      {
        name: "maxIMDBRating",
        value: 10,
        on: [
          {
            events: "data('values')",
            update: "min(datum['IMDB Rating'])",
          },
        ],
      },
    ],
    params: [
      {
        name: "highlightBin",
        value: 0,
        bind: {
          input: "range",
          min: 0,
          max: { signal: "maxIMDBRating" },
          step: 1,
        },
      },
    ],
    layer: [
      {
        mark: "bar",
        encoding: {
          x: { field: "IMDB Rating", bin: true },
          y: { aggregate: "count" },
          color: {
            condition: {
              test: "highlightBin >= datum['bin_maxbins_10_IMDB Rating']",
              value: "orange",
            },
            value: "lightgray",
          },
        },
      },
    ],
  };

  const suggested_metadata = {
    "Row numbers": [
      "Row numbers",
      JSON.stringify([
        3629, 10600, 13020, 4287, 4633, 32561, 3582, 1025, 630, 816, 35, 30,
        16281, 821, 21, 10127, 11162, 4888, 52, 138, 1548, 5000, 10000, 10000,
        350, 30, 32177, 4847, 5000, 56, 32581, 11, 15079, 24, 9, 5145, 1, 14199,
        24803, 885, 32560, 58, 400, 436, 14125, 400, 61, 10000, 462, 4153, 4291,
        2553, 607, 923, 6241, 336, 199, 22407, 4028, 1470, 1470, 196, 116, 3047,
        35, 8805, 20, 6599, 20743, 1842, 180, 37, 1340, 493, 4276, 13000, 1000,
        30, 42, 3000, 66, 56, 2308, 303, 3220,
      ]),
      "reason lalalllalal",
      4,
    ],
    "Column Numbers": [
      "SECOND LONGGGGGGGG Rating",
      JSON.stringify([
        33, 33, 33, 31, 15, 19, 4, 15, 31, 31, 5, 18, 19, 3, 17, 18, 23, 14, 14,
        31, 2, 20, 15, 8, 3, 12, 14, 2, 12, 2, 4, 5, 3, 14, 11, 5, 7, 12, 7, 5,
        11, 5, 8, 9, 13, 8, 3, 2, 35, 35, 15, 10, 3, 6, 12, 13, 3, 12, 6, 22, 3,
        13, 4, 22, 12, 11, 12, 2, 22, 10, 9, 12, 6, 13, 17, 18, 5, 20, 7, 2, 21,
        18, 10, 28, 18, 11, 10, 9, 13, 11, 10, 33, 20, 5, 7, 7, 11, 2,
      ]),
      "reason 2",
      2,
    ],
  };
  const [messages, setMessages] = useState<MessageProps[]>([
    {
      id: 1,
      text: "Hello, I am ChatGPT! To start off, let’s try to construct an initial descriptive task for better search results.",
      sender: "system",
      show: true,
      type: "general",
    },
    {
      id: 2,
      text: "",
      sender: "system",
      show: true,
      type: "system_agent",
    },
    // {
    //   id: 3,
    //   text: JSON.stringify(suggested_tasks),
    //   sender: "system",
    //   show: true,
    //   type: "task_agent",
    // },
    // {
    //   id: 4,
    //   text: JSON.stringify(suggested_metadata),
    //   sender: "system",
    //   show: true,
    //   type: "metadata_agent",
    // },
  ]);

  const [filters, setFilters] = useState<MetadataFilter[]>([]);
  const [iconVisibility, setIconVisibility] = useState<boolean[]>(
    new Array(filters.length).fill(true)
  );

  const [pendingFilter, setPendingFilter] = useState<string | null>(null);

  return (
    <div className={`chat-container ${chatOpen ? "" : "closed"}`}>
      {/* <div
        className="arrow-container"
        onClick={() => {
          setChatOpen(!chatOpen);
        }}
      >
        {chatOpen ? <ArrowRightToLine /> : <ArrowLeftFromLine />}
      </div> */}
      {/* <div className="chat-button">Chat Open</div> */}
      {chatOpen && (
        <>
          <QueryBlocks
            task={task}
            setTask={setTask}
            filters={filters}
            setFilters={setFilters}
            iconVisibility={iconVisibility}
            setIconVisibility={setIconVisibility}
            messages={messages}
            setMessages={setMessages}
            pendingFilter={pendingFilter}
            setPendingFilter={setPendingFilter}
            results={results}
            setResults={setResults}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
          />
          {/* <ChatBot
            setResults={setResults}
            results={results}
            task={task}
            setTask={setTask}
            filters={filters}
            setFilters={setFilters}
            setIconVisibility={setIconVisibility}
            messages={messages}
            setMessages={setMessages}
            settingsSpecificity={settingsSpecificity}
            setSettingsSpecificity={setSettingsSpecificity}
            settingsGoal={settingsGoal}
            setSettingsGoal={setSettingsGoal}
            settingsDomain={settingsDomain}
            setSettingsDomain={setSettingsDomain}
            pendingFilter={pendingFilter}
            setPendingFilter={setPendingFilter}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
          /> */}
        </>
      )}
    </div>
  );
};

export default ChatContainer;
