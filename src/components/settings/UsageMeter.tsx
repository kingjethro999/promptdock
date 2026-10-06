export type Usage = {
  route: string;
  capacity?: number;
  used?: number;
  remaining?: number;
  resetsIn?: number;
  unlimited?: boolean;
};

const labels: Record<string, string> = {
  "/api/run": "Run prompt",
  "/api/idea-to-prompt": "Idea to prompt",
  "/api/transcribe": "Voice transcription",
};

export default function UsageMeter({
  usage,
  loading,
  error,
}: {
  usage: Usage[];
  loading: boolean;
  error: string;
}) {
  return (
    <section className="settings-card react-settings-card react-usage-card">
      <span className="section-kicker">USAGE</span>
      <h2>This hour</h2>
      <p>
        Every AI action has a rolling hourly budget. The meter shows what is
        left before the budget refills.
      </p>
      <div className="usage-list">
        {loading && <p className="usage-empty">Loading usage…</p>}
        {error && (
          <p className="usage-empty" role="status">
            {error}
          </p>
        )}
        {usage.map((item) => {
          const remaining = Math.floor(item.remaining || 0);
          const capacity = item.capacity || 0;
          const percent = item.unlimited
            ? 100
            : capacity
              ? Math.max(0, Math.min(100, (remaining / capacity) * 100))
              : 0;
          return (
            <div className="usage-item" key={item.route}>
              <div className="usage-head">
                <strong>
                  {labels[item.route] || item.route.replace("/api/", "")}
                </strong>
                <span>
                  {item.unlimited
                    ? "Unlimited"
                    : `${remaining} of ${capacity} left`}
                </span>
              </div>
              <div
                className="usage-bar"
                role="meter"
                aria-label={`${labels[item.route] || item.route} remaining`}
                aria-valuemin={0}
                aria-valuemax={item.unlimited ? 100 : capacity}
                aria-valuenow={item.unlimited ? 100 : remaining}
              >
                <span style={{ width: `${percent}%` }} />
              </div>
              {!item.unlimited && Boolean(item.resetsIn) && (
                <small>
                  Full in about {Math.ceil((item.resetsIn || 0) / 60)} minutes
                </small>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
