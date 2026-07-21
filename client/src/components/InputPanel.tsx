interface InputPanelProps {
  value: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export default function InputPanel({
  value,
  onChange,
  onSubmit,
  isLoading,
}: InputPanelProps) {
  const isSubmitDisabled = isLoading || value.trim().length === 0;

  return (
    <section className="input-panel">
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Paste your meeting notes or transcript here…"
        rows={12}
        disabled={isLoading}
      />
      <button type="button" onClick={onSubmit} disabled={isSubmitDisabled}>
        {isLoading ? "Summarizing…" : "Summarize"}
      </button>
    </section>
  );
}
