import { useEffect, useState } from "react";
import "./App.css";
import ErrorBanner from "./components/ErrorBanner";
import HistoryList from "./components/HistoryList";
import InputPanel from "./components/InputPanel";
import SummaryView from "./components/SummaryView";
import { getErrorMessage, summarize } from "./lib/api";
import { deleteRecord, loadRecords, saveRecord } from "./lib/storage";
import type { Summary, SummaryRecord } from "./types";

function App() {
  const [inputText, setInputText] = useState("");
  const [currentSummary, setCurrentSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<SummaryRecord[]>([]);

  useEffect(() => {
    setHistory(loadRecords());
  }, []);

  async function handleSubmit() {
    setIsLoading(true);
    try {
      const summary = await summarize(inputText);
      setCurrentSummary(summary);
      setErrorMessage(null);

      const record: SummaryRecord = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        inputText,
        summary,
      };
      setHistory(saveRecord(record));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  function handleSelect(record: SummaryRecord) {
    setCurrentSummary(record.summary);
    setInputText(record.inputText);
  }

  function handleDelete(id: string) {
    setHistory(deleteRecord(id));
  }

  return (
    <main className="app">
      <h1>Meeting Notes Summarizer</h1>
      <InputPanel
        value={inputText}
        onChange={setInputText}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
      <ErrorBanner message={errorMessage} />
      <SummaryView summary={currentSummary} />
      <HistoryList
        records={history}
        onSelect={handleSelect}
        onDelete={handleDelete}
      />
    </main>
  );
}

export default App;
