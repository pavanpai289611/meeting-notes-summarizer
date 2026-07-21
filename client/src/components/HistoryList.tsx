import type { SummaryRecord } from "../types";

interface HistoryListProps {
  records: SummaryRecord[];
  onSelect: (record: SummaryRecord) => void;
  onDelete: (id: string) => void;
}

function snippet(text: string, maxLength = 60): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength)}…`;
}

export default function HistoryList({ records, onSelect, onDelete }: HistoryListProps) {
  return (
    <section className="history-list">
      <h2>History</h2>
      {records.length === 0 ? (
        <p>No saved summaries yet.</p>
      ) : (
        <ul>
          {records.map((record) => (
            <li key={record.id}>
              <button
                type="button"
                className="history-item"
                onClick={() => onSelect(record)}
              >
                <span className="history-date">
                  {new Date(record.createdAt).toLocaleString()}
                </span>
                <span className="history-snippet">{snippet(record.inputText)}</span>
              </button>
              <button
                type="button"
                className="history-delete"
                onClick={() => {
                  if (window.confirm("Delete this summary?")) {
                    onDelete(record.id);
                  }
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
