function Bar({ width, height = 14, style }) {
  return <div className="skeleton-bar" style={{ width, height, ...style }} />;
}

export default function LoadingSkeleton() {
  return (
    <div className="app">
      <header className="app-header">
        <Bar width={160} height={24} />
        <div className="skeleton-bar skeleton-bar--circle" />
      </header>

      <main className="app-grid">
        <div className="card">
          <Bar width="50%" style={{ marginBottom: 14 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div className="skeleton-bar skeleton-bar--ring" />
            <Bar width={90} height={32} />
          </div>
        </div>

        <div className="card">
          <Bar width="40%" style={{ marginBottom: 14 }} />
          <Bar width={110} height={30} />
        </div>

        <div className="card calories-chart">
          <Bar width="30%" style={{ marginBottom: 16 }} />
          <Bar width="100%" height={200} />
        </div>

        <div className="card">
          <Bar width="45%" style={{ marginBottom: 16 }} />
          <Bar width="100%" height={120} />
        </div>

        <div className="card">
          <Bar width="25%" style={{ marginBottom: 16 }} />
          <Bar width="100%" height={160} />
        </div>

        <div className="card quick-add">
          <Bar width="20%" style={{ marginBottom: 16 }} />
          <Bar width="100%" height={40} />
        </div>
      </main>
    </div>
  );
}
