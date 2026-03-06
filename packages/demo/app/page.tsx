export default function Home() {
  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "60px 24px" }}>
      {/* Hero */}
      <section style={{ marginBottom: 64 }}>
        <h1 style={{ fontSize: 48, fontWeight: 700, marginBottom: 16, lineHeight: 1.1 }}>
          Visual DevTools
        </h1>
        <p style={{ fontSize: 18, color: "#666", lineHeight: 1.6, maxWidth: 560 }}>
          Select any element, tweak its styles visually, and send the changes
          to your AI coding tool. Press <kbd style={{ padding: "2px 6px", background: "#f0f0f0", borderRadius: 4, fontSize: 14 }}>Alt+D</kbd> to start.
        </p>
      </section>

      {/* Cards */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 64 }}>
        <Card
          title="Inspect"
          description="Hover over any element to see its properties. Click to select and edit."
          color="#3b82f6"
        />
        <Card
          title="Edit"
          description="Adjust spacing, colors, typography, and layout with visual controls."
          color="#8b5cf6"
        />
        <Card
          title="Apply"
          description="Send your changes to Claude Code or Cursor to update the source code."
          color="#10b981"
        />
      </section>

      {/* Sample content */}
      <section style={{ marginBottom: 64 }}>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 20 }}>Sample Components</h2>

        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          <button style={{
            padding: "10px 20px",
            background: "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}>
            Primary Button
          </button>
          <button style={{
            padding: "10px 20px",
            background: "#fff",
            color: "#1a1a1a",
            border: "1px solid #e5e5e5",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}>
            Secondary Button
          </button>
          <button style={{
            padding: "10px 20px",
            background: "#ef4444",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}>
            Danger Button
          </button>
        </div>

        <div style={{
          padding: 24,
          background: "#f9fafb",
          borderRadius: 12,
          border: "1px solid #e5e5e5",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #667eea, #764ba2)",
            }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>Jane Cooper</div>
              <div style={{ color: "#999", fontSize: 14 }}>Product Designer</div>
            </div>
          </div>
          <p style={{ color: "#666", lineHeight: 1.6, margin: 0 }}>
            This is a sample profile card component. Try selecting it with
            the Composer overlay and adjusting the padding, border radius, or
            background color.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section style={{ display: "flex", gap: 32, marginBottom: 64 }}>
        <Stat label="Elements" value="∞" />
        <Stat label="Properties" value="40+" />
        <Stat label="Undo Steps" value="∞" />
      </section>
    </main>
  );
}

function Card({ title, description, color }: { title: string; description: string; color: string }) {
  return (
    <div style={{
      padding: 24,
      borderRadius: 12,
      border: "1px solid #e5e5e5",
      background: "#fff",
    }}>
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        background: color,
        marginBottom: 16,
        opacity: 0.9,
      }} />
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, marginTop: 0 }}>{title}</h3>
      <p style={{ color: "#666", lineHeight: 1.5, margin: 0, fontSize: 14 }}>{description}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 36, fontWeight: 700, marginBottom: 4 }}>{value}</div>
      <div style={{ color: "#999", fontSize: 14 }}>{label}</div>
    </div>
  );
}
