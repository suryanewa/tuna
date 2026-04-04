"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ── Data ──

const FOLDERS = [
  { name: "Drafts", count: 1 },
  { name: "Inbox", count: 12 },
  { name: "Starred", count: 3 },
  { name: "Sent", count: 0 },
  { name: "Archive", count: 0 },
  { name: "Trash", count: 0 },
];

const LABELS = [
  { name: "Work", color: "blue" },
  { name: "Personal", color: "green" },
  { name: "Finance", color: "amber" },
  { name: "Travel", color: "purple" },
];

const MESSAGES = [
  {
    id: 1, from: "Sarah Chen", avatar: "SC", subject: "Q2 Design Review — Updated Mocks",
    preview: "Hey team, I've uploaded the revised mockups for the Q2 dashboard redesign. The key changes are around the sidebar nav and the new notification panel...",
    time: "10:24 AM", unread: true, starred: true, labels: ["Work"],
  },
  {
    id: 2, from: "GitHub", avatar: "GH", subject: "Re: [retune/retune] feat: scope-aware variable detection",
    preview: "khadgi-sujan pushed 3 commits to dev/v0.5. feat: scope-aware variable detection in resolver...",
    time: "9:15 AM", unread: true, starred: false, labels: ["Work"],
  },
  {
    id: 3, from: "Alex Rivera", avatar: "AR", subject: "Flight confirmation — SFO → JFK",
    preview: "Your flight has been confirmed. Departure: March 22, 2026 at 8:45 AM from San Francisco International...",
    time: "Yesterday", unread: false, starred: true, labels: ["Travel"],
  },
  {
    id: 4, from: "Stripe", avatar: "ST", subject: "Your March invoice is ready",
    preview: "Your invoice for March 2026 is now available. Total amount: $49.00. View your invoice online or download the PDF...",
    time: "Yesterday", unread: false, starred: false, labels: ["Finance"],
  },
  {
    id: 5, from: "Maya Johnson", avatar: "MJ", subject: "Weekend hiking plans?",
    preview: "Hey! Are you still up for the Muir Woods hike this Saturday? I was thinking we could start around 9 AM and grab lunch after...",
    time: "Mar 14", unread: false, starred: false, labels: ["Personal"],
  },
  {
    id: 6, from: "Notion", avatar: "NO", subject: "Your weekly digest",
    preview: "Here's what happened in your workspace this week: 14 pages edited, 3 new databases created, 2 team members joined...",
    time: "Mar 14", unread: false, starred: false, labels: [],
  },
  {
    id: 7, from: "David Park", avatar: "DP", subject: "Re: Component library feedback",
    preview: "Thanks for the detailed review! I agree with your points about the button sizing. Let me update the tokens and push a new version...",
    time: "Mar 13", unread: false, starred: false, labels: ["Work"],
  },
  {
    id: 8, from: "AWS", avatar: "AW", subject: "Alert: CloudWatch alarm triggered",
    preview: "The alarm 'API-Latency-High' in region us-east-1 has entered ALARM state. Current value: 342ms, threshold: 200ms...",
    time: "Mar 13", unread: false, starred: false, labels: ["Work"],
    priority: "high",
  },
];

// ── Components ──

function Avatar({ initials, size = "md" }: { initials: string; size?: "sm" | "md" | "lg" }) {
  return <div className={`avatar avatar--${size}`}>{initials}</div>;
}

function Badge({ children, variant }: { children: React.ReactNode; variant: string }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return <span className={`tag tag-${color}`}>{children}</span>;
}

// ── Main App ──

/** Drawer with document-level "close on outside click" — common real-world pattern */
/** Test drawer with multiple close-on-outside-click patterns.
 *  Uses high z-index + backdrop + both click and pointerdown listeners
 *  to simulate real-world drawer libraries (Radix, Headless UI, Shadcn). */
function SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Pattern 1: document click listener (React/vanilla pattern)
    const handleClick = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Pattern 2: document pointerdown listener (Radix/Headless UI pattern)
    const handlePointerDown = (e: PointerEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("click", handleClick);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      {/* Backdrop (Radix/Shadcn pattern) */}
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)",
        zIndex: 2147483646,
      }} onClick={onClose} />
      {/* Drawer panel — same max z-index as Retune */}
      <div ref={drawerRef} style={{
        position: "fixed", top: 0, right: 0, width: 360, height: "100vh",
        background: "var(--color-bg)", borderLeft: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-lg)", zIndex: 2147483647, padding: "var(--spacing-6)",
        display: "flex", flexDirection: "column", gap: "var(--spacing-4)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: "var(--font-lg)", fontWeight: "var(--font-weight-semibold)" }}>Settings</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <p style={{ fontSize: "var(--font-sm)", color: "var(--color-text-muted)" }}>
          This drawer uses max z-index + backdrop + both click and pointerdown listeners. Tests all common real-world patterns.
        </p>
        <div className="form-field">
          <label className="form-field__label">Display Name</label>
          <input className="input" defaultValue="Sarah Chen" />
        </div>
        <div className="form-field">
          <label className="form-field__label">Email Signature</label>
          <textarea className="input input--textarea" rows={3} defaultValue="Best regards," />
        </div>
      </div>
    </>
  );
}

export default function MailApp() {
  const [activeFolder, setActiveFolder] = useState("Inbox");
  const [selectedMessage, setSelectedMessage] = useState<number | null>(1);
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const selected = MESSAGES.find(m => m.id === selectedMessage);

  return (
    <div className="app">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar__header">
          <h1 className="sidebar__logo">Mailflow</h1>
        </div>

        <button className="btn btn-primary btn-compose" onClick={() => setComposeOpen(true)}>
          Compose
        </button>

        <nav className="sidebar__nav">
          <div className="sidebar__section-title">Folders</div>
          {FOLDERS.map(folder => (
            <button
              key={folder.name}
              className={`sidebar__item${activeFolder === folder.name ? " sidebar__item--active" : ""}`}
              onClick={() => setActiveFolder(folder.name)}
            >
              <span className="sidebar__item-label">{folder.name}</span>
              {folder.count > 0 && (
                <span className="sidebar__item-count">{folder.count}</span>
              )}
            </button>
          ))}

          <div className="sidebar__section-title">Labels</div>
          {LABELS.map(label => (
            <button key={label.name} className="sidebar__item sidebar__item--label">
              <span className={`sidebar__dot sidebar__dot--${label.color}`} />
              <span className="sidebar__item-label">{label.name}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <Avatar initials="SK" size="sm" />
            <div className="sidebar__user-info">
              <span className="sidebar__user-name">Sujan K.</span>
              <span className="sidebar__user-email">sujan@mailflow.app</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Message List ── */}
      <main className="content">
        <div className="message-list">
          <div className="message-list__header">
            <h2 className="message-list__title">{activeFolder}</h2>
            <div className={`search${searchFocused ? " search--focused" : ""}`}>
              <input
                className="search__input"
                placeholder="Search messages..."
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
            </div>
          </div>

          <div className="message-list__toolbar">
            <label className="checkbox">
              <input type="checkbox" />
              <span className="checkbox__label">Select all</span>
            </label>
            <div className="toolbar__actions">
              <button className="btn btn-ghost btn-sm">Mark read</button>
              <button className="btn btn-ghost btn-sm">Archive</button>
              <button className="btn btn-danger btn-sm">Delete</button>
            </div>
          </div>

          <div className="message-list__items">
            {MESSAGES.map(msg => (
              <div
                key={msg.id}
                className={`message-row${msg.unread ? " message-row--unread" : ""}${selectedMessage === msg.id ? " message-row--selected" : ""}${msg.priority === "high" ? " message-row--priority" : ""}`}
                onClick={() => setSelectedMessage(msg.id)}
              >
                <div className="message-row__left">
                  <Avatar initials={msg.avatar} size="sm" />
                </div>
                <div className="message-row__body">
                  <div className="message-row__top">
                    <span className="message-row__from">{msg.from}</span>
                    <span className="message-row__time">{msg.time}</span>
                  </div>
                  <div className="message-row__subject">{msg.subject}</div>
                  <div className="message-row__preview">{msg.preview}</div>
                  {msg.labels.length > 0 && (
                    <div className="message-row__labels">
                      {msg.labels.map(l => {
                        const label = LABELS.find(lb => lb.name === l);
                        return label ? <Tag key={l} color={label.color}>{l}</Tag> : null;
                      })}
                    </div>
                  )}
                </div>
                {msg.starred && <span className="message-row__star">★</span>}
              </div>
            ))}
          </div>
        </div>

        {/* ── Message Detail ── */}
        {selected && (
          <div className="message-detail">
            <div className="message-detail__header">
              <div className="message-detail__meta">
                <Avatar initials={selected.avatar} />
                <div>
                  <div className="message-detail__from">{selected.from}</div>
                  <div className="message-detail__time">{selected.time}</div>
                </div>
              </div>
              <div className="message-detail__actions">
                <button className="btn btn-ghost btn-sm">Reply</button>
                <button className="btn btn-ghost btn-sm">Forward</button>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={(e) => { e.stopPropagation(); setSettingsOpen(true); }}>⚙</button>
                <button className="btn btn-ghost btn-sm btn-icon">⋯</button>
              </div>
            </div>
            <h2 className="message-detail__subject">{selected.subject}</h2>
            <div className="message-detail__body">
              <p>{selected.preview}</p>
              <p>This is the full message content. In a real app, this would contain the complete email with formatting, links, and attachments.</p>
              <p>Best regards,<br />{selected.from}</p>
            </div>
            {selected.labels.length > 0 && (
              <div className="message-detail__labels">
                {selected.labels.map(l => {
                  const label = LABELS.find(lb => lb.name === l);
                  return label ? <Tag key={l} color={label.color}>{l}</Tag> : null;
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Compose Modal ── */}
      {composeOpen && (
        <div className="modal-overlay" onClick={() => setComposeOpen(false)}>
          <div className="modal modal--compose" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <h3 className="modal__title">New Message</h3>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setComposeOpen(false)}>✕</button>
            </div>
            <div className="modal__body">
              <div className="form-field">
                <label className="form-field__label">To</label>
                <input className="input" placeholder="recipient@example.com" />
              </div>
              <div className="form-field">
                <label className="form-field__label">Subject</label>
                <input className="input" placeholder="Subject" />
              </div>
              <div className="form-field">
                <label className="form-field__label">Message</label>
                <textarea className="input input--textarea" placeholder="Write your message..." rows={8} />
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn-ghost" onClick={() => setComposeOpen(false)}>Discard</button>
              <button className="btn btn-primary">Send</button>
            </div>
          </div>
        </div>
      )}


      {/* ── Media Test Elements ── */}
      <div style={{ position: "fixed", bottom: 160, left: 16, display: "flex", gap: 12, alignItems: "flex-end", zIndex: 40 }}>
        <img
          src="https://picsum.photos/seed/retune/200/150"
          alt="Sample landscape"
          className="media-test-img"
          style={{ width: 120, height: 90, objectFit: "cover", borderRadius: "var(--radius-md)" }}
        />
        <svg width="48" height="48" viewBox="0 0 48 48" className="media-test-svg" style={{ flexShrink: 0 }}>
          <circle cx="24" cy="24" r="20" fill="var(--color-brand)" stroke="var(--color-brand-dark)" strokeWidth="2" />
          <path d="M20 16 L34 24 L20 32Z" fill="var(--color-bg)" />
        </svg>
        <video
          width="160"
          height="90"
          poster="https://picsum.photos/seed/retune-video/160/90"
          style={{ borderRadius: "var(--radius-md)", objectFit: "cover" }}
          muted
        >
          <source src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm" type="video/webm" />
        </video>
      </div>

      {/* ── Alert Banner ── */}
      <div className="alert alert-warning alert-dismissible">
        <span className="alert__icon" aria-hidden="true" />
        <span className="alert__text">Your storage is almost full. Upgrade your plan to get more space.</span>
        <button className="alert__close">✕</button>
      </div>

      {/* ── Test: Mixed utility + semantic classes (for scope filtering) ── */}
      <div className="spectrum-bg-blue p-4 rounded-lg" style={{ position: "fixed", bottom: 80, right: 16, maxWidth: 320 }}>
        <div className="heading-font font-bold text-lg" style={{ color: "rgb(var(--background-primary))", marginBottom: 8 }}>
          Spectrum Card
        </div>
        <p className="body-font text-sm" style={{ color: "rgb(var(--background-primary))", opacity: "var(--opacity-subtle)" }}>
          This card uses space-separated RGB colors, font variables, mixed utility + semantic classes, and opacity variables. Select it to test all the fixes.
        </p>
        <div className="flex items-center gap-2" style={{ marginTop: 12 }}>
          <button className="btn btn-ghost border-thin" style={{ color: "rgb(var(--background-primary))", borderColor: "rgb(var(--background-primary))" }}>
            Dismiss
          </button>
        </div>
      </div>

      {/* ── Settings Drawer (tests event propagation fix) ── */}
      <SettingsDrawer open={settingsOpen} onClose={useCallback(() => setSettingsOpen(false), [])} />
    </div>
  );
}
