type DetailScreenShellProps = {
  assistantLauncher?: JSX.Element;
  onBack: () => void;
  statusMessage: string;
  title: string;
};

export const DetailScreenShell = ({
  assistantLauncher,
  onBack,
  statusMessage,
  title,
}: DetailScreenShellProps): JSX.Element => (
  <main className="shell">
    <header className="section-header">
      <div className="button-row">
        {assistantLauncher}
        <button className="secondary" onClick={onBack} type="button">
          Back
        </button>
      </div>
      <h1>{title}</h1>
    </header>
    <p className="status">{statusMessage}</p>
  </main>
);
