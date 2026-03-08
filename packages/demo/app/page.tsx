import "./styles.css";

export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px" }}>
      {/* Hero */}
      <section style={{ marginBottom: 64 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <div className="logo-mark" />
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>Composer</span>
        </div>
        <h1 style={{ fontSize: 44, fontWeight: 700, marginBottom: 16, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
          Visual DevTools for<br />your AI coding workflow
        </h1>
        <p className="body-text" style={{ maxWidth: 520 }}>
          Select any element, tweak its styles visually, and send the changes
          to Claude Code or Cursor. Press <kbd className="kbd">Alt+D</kbd> to start editing this page.
        </p>
      </section>

      {/* How it works */}
      <section style={{ marginBottom: 64 }}>
        <h2 className="section-title">How it works</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <FeatureCard step="1" title="Select" description="Click any element on your page to inspect and select it for editing." />
          <FeatureCard step="2" title="Edit" description="Adjust spacing, colors, typography, layout, filters and more with visual controls." />
          <FeatureCard step="3" title="Apply" description="Copy changes to your clipboard or let your AI coding tool apply them to source." />
        </div>
      </section>

      {/* Scope */}
      <section style={{ marginBottom: 64 }}>
        <h2 className="section-title">Element vs Class scope</h2>
        <p className="body-text" style={{ marginBottom: 24 }}>
          When you select an element that uses CSS classes, Composer detects how many
          other elements share that class. You can toggle between editing just this
          element or all matching elements at once.
        </p>
        <p className="body-text" style={{ marginBottom: 24 }}>
          Try selecting one of these buttons — they all share the <code className="code">.btn</code> class.
          Toggle to "All .btn" and change the border-radius to see every button update.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <button className="btn btn-primary">Primary</button>
          <button className="btn btn-secondary">Secondary</button>
          <button className="btn btn-danger">Danger</button>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="btn btn-primary">Submit</button>
          <button className="btn btn-secondary">Cancel</button>
          <button className="btn btn-danger">Delete</button>
        </div>
      </section>

      {/* Properties */}
      <section style={{ marginBottom: 64 }}>
        <h2 className="section-title">Supported properties</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <PropCategory title="Layout" items={["Display", "Position", "Flex & Grid", "Alignment", "Z-index"]} />
          <PropCategory title="Spacing" items={["Padding", "Margin", "Gap", "Offsets (top/right/bottom/left)"]} />
          <PropCategory title="Size" items={["Width & Height", "Min/Max constraints", "Overflow"]} />
          <PropCategory title="Typography" items={["Font family & size", "Weight & style", "Line height & spacing", "Text align & transform"]} />
          <PropCategory title="Appearance" items={["Background color & gradient", "Border & radius", "Box shadow", "Opacity"]} />
          <PropCategory title="Filters" items={["Blur, brightness, contrast", "Hue-rotate, saturate", "Invert, sepia", "Layer & backdrop targeting"]} />
        </div>
      </section>

      {/* Tags — test shared classes */}
      <section style={{ marginBottom: 64 }}>
        <h2 className="section-title">Integration</h2>
        <p className="body-text" style={{ marginBottom: 20 }}>
          Composer works with any React framework and any styling approach.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <span className="tag">Tailwind CSS</span>
          <span className="tag">CSS Modules</span>
          <span className="tag">Inline Styles</span>
          <span className="tag">styled-components</span>
          <span className="tag">Plain CSS</span>
        </div>
        <p className="body-text" style={{ marginBottom: 20 }}>
          Changes are tracked with full context — source file, component hierarchy,
          styling approach, and design token mapping — so your AI tool knows exactly
          how to apply them.
        </p>
      </section>

      {/* API */}
      <section style={{ marginBottom: 64 }}>
        <h2 className="section-title">Agent API</h2>
        <p className="body-text" style={{ marginBottom: 20 }}>
          Composer exposes a global API that AI agents can call to read and clear changes programmatically.
        </p>
        <div className="code-block">
          <div className="code-line"><span className="code-comment">// Get all pending changes</span></div>
          <div className="code-line">window.__composer.getChanges()</div>
          <div className="code-line" style={{ height: 8 }} />
          <div className="code-line"><span className="code-comment">// Get formatted output for AI</span></div>
          <div className="code-line">window.__composer.getFormattedChanges()</div>
          <div className="code-line" style={{ height: 8 }} />
          <div className="code-line"><span className="code-comment">// Clear all changes and revert preview</span></div>
          <div className="code-line">window.__composer.clearChanges()</div>
        </div>
      </section>

      {/* Setup */}
      <section style={{ marginBottom: 64 }}>
        <h2 className="section-title">Quick setup</h2>
        <div className="code-block">
          <div className="code-line"><span className="code-comment">// In your layout.tsx</span></div>
          <div className="code-line"><span className="code-keyword">import</span> {"{"} DevOverlay {"}"} <span className="code-keyword">from</span> <span className="code-string">"@composer/overlay"</span>;</div>
          <div className="code-line" style={{ height: 8 }} />
          <div className="code-line"><span className="code-keyword">export default function</span> Layout({"{"} children {"}"}) {"{"}</div>
          <div className="code-line">{"  "}<span className="code-keyword">return</span> (</div>
          <div className="code-line">{"    "}&lt;html&gt;</div>
          <div className="code-line">{"      "}&lt;body&gt;</div>
          <div className="code-line">{"        "}{"{"}children{"}"}</div>
          <div className="code-line">{"        "}&lt;<span className="code-component">DevOverlay</span> /&gt;</div>
          <div className="code-line">{"      "}&lt;/body&gt;</div>
          <div className="code-line">{"    "}&lt;/html&gt;</div>
          <div className="code-line">{"  "});</div>
          <div className="code-line">{"}"}</div>
        </div>
      </section>

      {/* Sample components for testing */}
      <section style={{ marginBottom: 64 }}>
        <h2 className="section-title">Sample components</h2>
        <p className="body-text" style={{ marginBottom: 20 }}>
          Use these to test the overlay. Each group shares CSS classes.
        </p>

        {/* Profile cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <ProfileCard name="Jane Cooper" role="Product Designer" />
          <ProfileCard name="Alex Morgan" role="Frontend Engineer" />
        </div>

        {/* List items */}
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
          <div className="list-item">
            <span>Design system audit</span>
            <span className="tag">Design</span>
          </div>
          <div className="list-item">
            <span>API refactor</span>
            <span className="tag">Engineering</span>
          </div>
          <div className="list-item">
            <span>User interviews</span>
            <span className="tag">Research</span>
          </div>
          <div className="list-item">
            <span>Launch planning</span>
            <span className="tag">Product</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #e5e5e5", paddingTop: 24, marginBottom: 32 }}>
        <p style={{ color: "#999", fontSize: 13, margin: 0 }}>
          Composer — visual CSS editing for AI-assisted development.
        </p>
      </footer>
    </main>
  );
}

function FeatureCard({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="card">
      <div className="step-badge">{step}</div>
      <h3 className="card-title">{title}</h3>
      <p className="card-desc">{description}</p>
    </div>
  );
}

function PropCategory({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <h4 style={{ fontSize: 13, fontWeight: 600, marginTop: 0, marginBottom: 8 }}>{title}</h4>
      <ul style={{ margin: 0, paddingLeft: 16 }}>
        {items.map((item) => (
          <li key={item} className="prop-item">{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ProfileCard({ name, role }: { name: string; role: string }) {
  return (
    <div className="profile-card">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div className="avatar" />
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{name}</div>
          <div style={{ color: "#999", fontSize: 13 }}>{role}</div>
        </div>
      </div>
      <p className="card-desc">
        Select this card and toggle scope to see "All .profile-card" update both cards at once.
      </p>
    </div>
  );
}
