type DetailScreenShellProps = {
  onBack: () => void;
  statusMessage: string;
  title: string;
};

export const DetailScreenShell = ({
  onBack,
  statusMessage,
  title,
}: DetailScreenShellProps): JSX.Element => (
  <main className="shell">
    <header className="section-header">
      <button className="secondary" onClick={onBack} type="button">
        Back
      </button>
      <h1>{title}</h1>
    </header>
    <p className="status">{statusMessage}</p>
  </main>
);
