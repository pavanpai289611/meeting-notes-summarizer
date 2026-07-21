import type { Summary } from "../types";

interface SummaryViewProps {
  summary: Summary | null;
}

function TextSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="summary-section">
      <h2>{title}</h2>
      {items.length === 0 ? (
        <p className="summary-empty">None identified.</p>
      ) : (
        <ul>
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SummaryView({ summary }: SummaryViewProps) {
  if (!summary) {
    return null;
  }

  return (
    <section className="summary-view">
      <TextSection title="Key Discussion Points" items={summary.keyDiscussionPoints} />
      <TextSection title="Decisions Made" items={summary.decisionsMade} />
      <div className="summary-section">
        <h2>Action Items</h2>
        {summary.actionItems.length === 0 ? (
          <p className="summary-empty">None identified.</p>
        ) : (
          <ul>
            {summary.actionItems.map((item, index) => (
              <li key={index}>
                {item.task} — {item.owner}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
