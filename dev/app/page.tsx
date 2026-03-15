"use client";

import { useState } from "react";

function Avatar({ initials, size = "md" }: { initials: string; size?: "sm" | "md" | "lg" }) {
  const cls = `avatar${size !== "md" ? ` avatar--${size}` : ""}`;
  return <div className={cls}>{initials}</div>;
}

function Badge({ children, variant }: { children: React.ReactNode; variant: "success" | "warning" | "error" | "info" }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

function Card({ title, children, featured, compact, footer }: {
  title: string;
  children: React.ReactNode;
  featured?: boolean;
  compact?: boolean;
  footer?: React.ReactNode;
}) {
  const cls = `card${featured ? " card--featured" : ""}${compact ? " card--compact" : ""}`;
  return (
    <div className={cls}>
      <div className="card-header">{title}</div>
      <div className="card-body">{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}

function ModalDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-secondary" onClick={() => setOpen(true)}>Open Modal</button>
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__title">Confirm Action</div>
            <div className="modal__body">
              Are you sure you want to proceed? This action cannot be undone.
            </div>
            <div className="modal__actions">
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => setOpen(false)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DataTable() {
  const data = [
    { name: "Alice Johnson", role: "Engineer", status: "Active", email: "alice@example.com" },
    { name: "Bob Smith", role: "Designer", status: "Away", email: "bob@example.com" },
    { name: "Carol Williams", role: "Manager", status: "Active", email: "carol@example.com" },
    { name: "David Brown", role: "Engineer", status: "Offline", email: "david@example.com" },
  ];
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Role</th>
          <th>Status</th>
          <th>Email</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.email}>
            <td className="flex items-center gap-3">
              <Avatar initials={row.name[0]} size="sm" />
              <span className="font-medium text-gray-900">{row.name}</span>
            </td>
            <td className="text-gray-500">{row.role}</td>
            <td>
              <Badge variant={row.status === "Active" ? "success" : row.status === "Away" ? "warning" : "error"}>
                {row.status}
              </Badge>
            </td>
            <td className="text-gray-500">{row.email}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SkeletonCard() {
  return (
    <div className="card p-6">
      <div className="skeleton mb-4" style={{ width: 120, height: 16 }} />
      <div className="skeleton mb-2" style={{ width: "100%", height: 12 }} />
      <div className="skeleton mb-2" style={{ width: "80%", height: 12 }} />
      <div className="skeleton" style={{ width: "60%", height: 12 }} />
    </div>
  );
}

export default function TestPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Nav (semantic BEM) ── */}
      <nav className="nav sticky top-0 z-10 shadow-sm">
        <div className="nav__brand">Retune Dev</div>
        <ul className="nav__links">
          <li><a className="nav__link nav__link--active">Dashboard</a></li>
          <li><a className="nav__link">Projects</a></li>
          <li><a className="nav__link">Settings</a></li>
        </ul>
      </nav>

      {/* ── Hero (semantic + utility mix) ── */}
      <section className="hero">
        <h1 className="hero__title tracking-tight">Dev Playground</h1>
        <p className="hero__subtitle">
          Press <kbd className="px-4 py-2 bg-gray-100 rounded-md text-sm font-medium">Alt+D</kbd> to
          toggle edit mode. Click any element to inspect it.
        </p>
        <div className="hero__actions">
          <button className="btn btn-primary btn-lg">Get Started</button>
          <button className="btn btn-secondary btn-lg">Documentation</button>
        </div>
      </section>

      <main className="max-w-2xl mx-auto p-8">

        {/* ── Section: Buttons (semantic classes w/ variants) ── */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Buttons</h2>
          <div className="flex flex-wrap gap-3 items-center">
            <button className="btn btn-primary">Primary</button>
            <button className="btn btn-secondary">Secondary</button>
            <button className="btn btn-danger">Danger</button>
            <button className="btn btn-ghost">Ghost</button>
            <button className="btn btn-primary btn-sm">Small</button>
            <button className="btn btn-primary btn-lg">Large</button>
          </div>
        </section>

        {/* ── Section: Cards (semantic + compound selectors) ── */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Cards</h2>
          <div className="grid grid-cols-2 gap-4">
            <Card title="Basic Card">
              A simple card component with semantic class names.
            </Card>
            <Card title="Featured Card" featured>
              This card has a featured variant with a blue border.
            </Card>
            <Card title="Compact Card" compact footer={
              <button className="btn btn-primary btn-sm">Action</button>
            }>
              Compact variant with a footer containing a button.
            </Card>
            <SkeletonCard />
          </div>
        </section>

        {/* ── Section: Badges (semantic variants) ── */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Badges</h2>
          <div className="flex gap-3 items-center flex-wrap">
            <Badge variant="success">Active</Badge>
            <Badge variant="warning">Pending</Badge>
            <Badge variant="error">Failed</Badge>
            <Badge variant="info">New</Badge>
          </div>
        </section>

        {/* ── Section: Avatars ── */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Avatars</h2>
          <div className="flex gap-3 items-center">
            <Avatar initials="S" size="sm" />
            <Avatar initials="M" />
            <Avatar initials="L" size="lg" />
          </div>
        </section>

        {/* ── Section: Form inputs (semantic + state classes) ── */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Form Controls</h2>
          <div className="flex flex-col gap-3 max-w-lg">
            <input className="input" placeholder="Normal input" />
            <input className="input input--error" placeholder="Error state input" />
            <div className="flex gap-3">
              <input className="input flex-1" placeholder="First name" />
              <input className="input flex-1" placeholder="Last name" />
            </div>
          </div>
        </section>

        {/* ── Section: Data table ── */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Data Table</h2>
          <div className="border rounded-xl overflow-hidden bg-white">
            <DataTable />
          </div>
        </section>

        {/* ── Section: Utility-heavy element (like Yahoo Shopping) ── */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Utility-Heavy Elements</h2>
          <p className="text-sm text-gray-500 mb-4">These elements use many utility classes, simulating sites like Yahoo Shopping.</p>
          <div className="flex flex-col gap-4">
            {/* Product card — lots of utilities */}
            <div className="flex gap-4 p-4 bg-white rounded-xl border shadow-sm">
              <div className="shrink-0 rounded-lg overflow-hidden" style={{ width: 120, height: 120, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }} />
              <div className="flex flex-col flex-1">
                <span className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-2">Editor&apos;s Pick</span>
                <h3 className="text-base font-semibold text-gray-900 mb-0 leading-tight">Wireless Noise-Canceling Headphones</h3>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed truncate">Premium sound quality with 30-hour battery life and active noise cancellation.</p>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-lg font-bold text-gray-900">$299.99</span>
                  <button className="btn btn-primary btn-sm">Add to Cart</button>
                </div>
              </div>
            </div>

            {/* Another utility-heavy product */}
            <div className="flex gap-4 p-4 bg-white rounded-xl border shadow-sm">
              <div className="shrink-0 rounded-lg overflow-hidden" style={{ width: 120, height: 120, background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" }} />
              <div className="flex flex-col flex-1">
                <span className="text-xs font-medium text-red-600 uppercase tracking-wide mb-2">Sale</span>
                <h3 className="text-base font-semibold text-gray-900 mb-0 leading-tight">Smart Watch Pro</h3>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed truncate">Health tracking, GPS, and 5-day battery in a sleek design.</p>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-lg font-bold text-gray-900">
                    <span className="text-red-600">$199.99</span>{" "}
                    <span className="text-sm font-normal text-gray-500 line-through">$349.99</span>
                  </span>
                  <button className="btn btn-primary btn-sm">Add to Cart</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section: Mixed semantic + utility (sidebar layout) ── */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Sidebar Layout</h2>
          <div className="flex rounded-xl border overflow-hidden bg-white" style={{ height: 320 }}>
            <div className="sidebar">
              <div className="sidebar__section-title">Navigation</div>
              <button className="sidebar__item sidebar__item--active">Dashboard</button>
              <button className="sidebar__item">Analytics</button>
              <button className="sidebar__item">Reports</button>
              <div className="sidebar__section-title">Settings</div>
              <button className="sidebar__item">Profile</button>
              <button className="sidebar__item">Team</button>
              <button className="sidebar__item">Billing</button>
            </div>
            <div className="flex-1 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Dashboard</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Select items in the sidebar to test how Retune handles semantic BEM classes
                alongside utility classes on the same page.
              </p>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="p-4 bg-blue-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">128</div>
                  <div className="text-xs text-gray-500 mt-2">Users</div>
                </div>
                <div className="p-4 bg-gray-100 rounded-lg text-center">
                  <div className="text-2xl font-bold text-gray-900">$9.4k</div>
                  <div className="text-xs text-gray-500 mt-2">Revenue</div>
                </div>
                <div className="p-4 bg-red-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-red-600">3</div>
                  <div className="text-xs text-gray-500 mt-2">Issues</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section: Modal (semantic) ── */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Modal</h2>
          <ModalDemo />
        </section>

        {/* ── Section: Flex and Grid layouts ── */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Flex Layout</h2>
          <div className="flex gap-4 flex-wrap">
            {["One", "Two", "Three"].map((label) => (
              <div key={label} className="flex-1 p-4 bg-gray-100 rounded-lg text-center font-medium text-gray-700">
                {label}
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Grid Layout</h2>
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`p-4 rounded-lg${i === 0 ? " col-span-2" : ""}`}
                style={{ background: `hsl(${i * 50 + 200}, 60%, 92%)`, border: `1px solid hsl(${i * 50 + 200}, 40%, 82%)` }}
              >
                <span className="text-sm font-medium" style={{ color: `hsl(${i * 50 + 200}, 50%, 35%)` }}>
                  Cell {i + 1}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section: Positioned elements ── */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Positioned Elements</h2>
          <div className="relative bg-gray-100 rounded-xl p-6" style={{ height: 200 }}>
            <div className="absolute top-0 right-0 mt-4 mr-4">
              <Badge variant="warning">Absolute badge</Badge>
            </div>
            <div className="absolute" style={{ bottom: 16, left: 16 }}>
              <span className="text-sm text-gray-500">Bottom-left positioned</span>
            </div>
            <div className="flex items-center justify-center h-full">
              <span className="text-gray-500">Relative container</span>
            </div>
          </div>
        </section>

        {/* ── Section: Tooltip ── */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Tooltip</h2>
          <div className="tooltip-trigger inline-flex">
            <button className="btn btn-secondary">Hover me</button>
            <div className="tooltip">This is a tooltip</div>
          </div>
        </section>

        {/* ── Section: Semantic Token Testing ── */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Semantic Design Tokens</h2>
          <p className="text-sm text-gray-500 mb-6">
            These use custom semantic tokens (not Tailwind). Select them to see blue dot indicators on inputs.
          </p>

          {/* Spacing tokens */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Spacing Tokens</h3>
            <div className="flex gap-4 items-start">
              <div className="spacing-xs surface-subtle radius-sm border">
                <span className="type-caption color-secondary">spacing-xs</span>
              </div>
              <div className="spacing-sm surface-subtle radius-sm border">
                <span className="type-caption color-secondary">spacing-sm</span>
              </div>
              <div className="spacing-md surface-subtle radius-default border">
                <span className="type-body color-secondary">spacing-md</span>
              </div>
              <div className="spacing-lg surface-subtle radius-default border">
                <span className="type-body color-secondary">spacing-lg</span>
              </div>
              <div className="spacing-xl surface-subtle radius-lg border">
                <span className="type-body-lg color-secondary">spacing-xl</span>
              </div>
            </div>
          </div>

          {/* Color tokens */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Color Tokens</h3>
            <div className="flex gap-3 flex-wrap">
              <div className="spacing-sm surface-accent radius-default">
                <span className="type-body color-primary font-medium">color-primary</span>
              </div>
              <div className="spacing-sm surface-success radius-default">
                <span className="type-body color-success font-medium">color-success</span>
              </div>
              <div className="spacing-sm surface-danger radius-default">
                <span className="type-body color-danger font-medium">color-danger</span>
              </div>
              <div className="spacing-sm surface-warning radius-default">
                <span className="type-body color-warning font-medium">color-warning</span>
              </div>
              <div className="spacing-sm surface-muted radius-default">
                <span className="type-body color-muted font-medium">color-muted</span>
              </div>
            </div>
          </div>

          {/* Typography tokens */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Typography Tokens</h3>
            <div className="flex flex-col gap-2">
              <p className="type-caption color-muted">type-caption (12px)</p>
              <p className="type-body color-secondary">type-body (14px)</p>
              <p className="type-body-lg color-secondary">type-body-lg (16px)</p>
              <p className="type-heading-sm font-semibold">type-heading-sm (18px)</p>
              <p className="type-heading font-bold">type-heading (24px)</p>
              <p className="type-heading-lg font-bold">type-heading-lg (32px)</p>
            </div>
          </div>

          {/* Radius tokens */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Radius Tokens</h3>
            <div className="flex gap-4 items-center">
              <div className="spacing-md surface-muted border radius-none text-center" style={{ width: 72, height: 72 }}>
                <span className="type-caption color-secondary">none</span>
              </div>
              <div className="spacing-md surface-muted border radius-sm text-center" style={{ width: 72, height: 72 }}>
                <span className="type-caption color-secondary">sm</span>
              </div>
              <div className="spacing-md surface-muted border radius-default text-center" style={{ width: 72, height: 72 }}>
                <span className="type-caption color-secondary">default</span>
              </div>
              <div className="spacing-md surface-muted border radius-lg text-center" style={{ width: 72, height: 72 }}>
                <span className="type-caption color-secondary">lg</span>
              </div>
              <div className="spacing-md surface-muted border radius-xl text-center" style={{ width: 72, height: 72 }}>
                <span className="type-caption color-secondary">xl</span>
              </div>
              <div className="spacing-md surface-muted border radius-pill text-center" style={{ width: 72, height: 72 }}>
                <span className="type-caption color-secondary">pill</span>
              </div>
            </div>
          </div>

          {/* Mixed: semantic + gap tokens */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Gap Tokens</h3>
            <div className="flex flex-col gap-3">
              <div className="flex gap-tight">
                {["A", "B", "C", "D"].map((l) => (
                  <div key={l} className="spacing-sm surface-muted radius-sm type-body font-medium text-center flex-1">{l}</div>
                ))}
              </div>
              <div className="flex gap-default">
                {["A", "B", "C", "D"].map((l) => (
                  <div key={l} className="spacing-sm surface-muted radius-sm type-body font-medium text-center flex-1">{l}</div>
                ))}
              </div>
              <div className="flex gap-relaxed">
                {["A", "B", "C", "D"].map((l) => (
                  <div key={l} className="spacing-sm surface-muted radius-sm type-body font-medium text-center flex-1">{l}</div>
                ))}
              </div>
              <div className="flex gap-loose">
                {["A", "B", "C", "D"].map((l) => (
                  <div key={l} className="spacing-sm surface-muted radius-sm type-body font-medium text-center flex-1">{l}</div>
                ))}
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <span className="type-caption color-muted">gap-tight (4px)</span>
              <span className="type-caption color-muted">→ gap-default (8px)</span>
              <span className="type-caption color-muted">→ gap-relaxed (16px)</span>
              <span className="type-caption color-muted">→ gap-loose (24px)</span>
            </div>
          </div>
        </section>

        {/* ── Section: Token Testing (Tailwind utilities) ── */}
        {/* These use Tailwind-style classes — indicators should NOT appear */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Tailwind Utility Tokens</h2>
          <p className="text-sm text-gray-500 mb-6">
            These use Tailwind-style utilities. No indicators should appear — the output system handles class suggestions.
          </p>

          {/* Individual-axis padding tokens — each side is a separate token */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Padding Tokens (individual axes)</h3>
            <div className="flex gap-4">
              <div className="pt-4 pb-2 pl-6 pr-4 bg-blue-50 rounded-lg border border-blue-500">
                <span className="text-sm text-blue-700">pt-4 pb-2 pl-6 pr-4</span>
              </div>
              <div className="pt-8 pb-4 pl-2 pr-2 bg-green-50 rounded-lg border border-green-500">
                <span className="text-sm text-green-700">pt-8 pb-4 pl-2 pr-2</span>
              </div>
              <div className="py-6 px-3 bg-amber-50 rounded-lg border-l-4 border-amber-500">
                <span className="text-sm text-amber-600">py-6 px-3</span>
              </div>
            </div>
          </div>

          {/* Margin tokens */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Margin Tokens</h3>
            <div className="bg-gray-100 rounded-lg p-4">
              <div className="mt-2 mb-4 ml-4 mr-2 p-3 bg-white rounded-md border text-sm text-gray-700">
                mt-2 mb-4 ml-4 mr-2 (inside gray container)
              </div>
              <div className="mt-6 mb-2 p-3 bg-white rounded-md border text-sm text-gray-700">
                mt-6 mb-2 (vertical only)
              </div>
            </div>
          </div>

          {/* Gap tokens — flex container with different gaps to swap between */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Gap Tokens (try swapping gap-2 → gap-6)</h3>
            <div className="flex gap-2 mb-3">
              {["A", "B", "C", "D"].map((l) => (
                <div key={l} className="p-3 bg-gray-200 rounded-md text-sm font-medium text-gray-700 flex-1 text-center">{l}</div>
              ))}
            </div>
            <div className="flex gap-6">
              {["E", "F", "G", "H"].map((l) => (
                <div key={l} className="p-3 bg-gray-200 rounded-md text-sm font-medium text-gray-700 flex-1 text-center">{l}</div>
              ))}
            </div>
          </div>

          {/* Typography tokens — font-size, weight, line-height, letter-spacing */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Typography Tokens</h3>
            <div className="flex flex-col gap-3">
              <p className="text-xs font-normal leading-normal tracking-normal text-gray-600">
                text-xs / font-normal / leading-normal / tracking-normal
              </p>
              <p className="text-base font-medium leading-snug tracking-tight text-gray-800">
                text-base / font-medium / leading-snug / tracking-tight
              </p>
              <p className="text-xl font-bold leading-tight tracking-tighter text-gray-900">
                text-xl / font-bold / leading-tight / tracking-tighter
              </p>
              <p className="text-3xl font-semibold leading-none tracking-wide text-blue-600">
                text-3xl / font-semibold / leading-none / tracking-wide
              </p>
            </div>
          </div>

          {/* Color tokens — text and background */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Color Tokens (text + background)</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <span className="text-blue-700 text-sm font-medium">bg-blue-100 / text-blue-700</span>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <span className="text-red-500 text-sm font-medium">bg-red-100 / text-red-500</span>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <span className="text-green-600 text-sm font-medium">bg-green-100 / text-green-600</span>
              </div>
              <div className="p-3 bg-gray-800 rounded-lg">
                <span className="text-white text-sm font-medium">bg-gray-800 / text-white</span>
              </div>
              <div className="p-3 bg-amber-100 rounded-lg">
                <span className="text-amber-600 text-sm font-medium">bg-amber-100 / text-amber-600</span>
              </div>
              <div className="p-3 bg-gray-200 rounded-lg">
                <span className="text-gray-600 text-sm font-medium">bg-gray-200 / text-gray-600</span>
              </div>
            </div>
          </div>

          {/* Border radius tokens — compare different radiuses */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Border Radius Tokens</h3>
            <div className="flex gap-4 items-center">
              <div className="p-4 bg-gray-100 border rounded-none text-xs text-gray-500 text-center" style={{ width: 72, height: 72 }}>none</div>
              <div className="p-4 bg-gray-100 border rounded-sm text-xs text-gray-500 text-center" style={{ width: 72, height: 72 }}>sm</div>
              <div className="p-4 bg-gray-100 border rounded text-xs text-gray-500 text-center" style={{ width: 72, height: 72 }}>default</div>
              <div className="p-4 bg-gray-100 border rounded-lg text-xs text-gray-500 text-center" style={{ width: 72, height: 72 }}>lg</div>
              <div className="p-4 bg-gray-100 border rounded-xl text-xs text-gray-500 text-center" style={{ width: 72, height: 72 }}>xl</div>
              <div className="p-4 bg-gray-100 border rounded-2xl text-xs text-gray-500 text-center" style={{ width: 72, height: 72 }}>2xl</div>
              <div className="p-4 bg-gray-100 border rounded-full text-xs text-gray-500 text-center" style={{ width: 72, height: 72 }}>full</div>
            </div>
          </div>

          {/* Shadow + opacity tokens */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Shadow &amp; Opacity Tokens</h3>
            <div className="flex gap-4">
              <div className="p-4 bg-white rounded-lg shadow-sm text-sm text-gray-600 text-center" style={{ width: 100 }}>shadow-sm</div>
              <div className="p-4 bg-white rounded-lg shadow text-sm text-gray-600 text-center" style={{ width: 100 }}>shadow</div>
              <div className="p-4 bg-white rounded-lg shadow-md text-sm text-gray-600 text-center" style={{ width: 100 }}>shadow-md</div>
              <div className="p-4 bg-white rounded-lg shadow-lg text-sm text-gray-600 text-center" style={{ width: 100 }}>shadow-lg</div>
            </div>
            <div className="flex gap-4 mt-4">
              <div className="p-4 bg-blue-600 rounded-lg opacity-50 text-white text-sm text-center" style={{ width: 100 }}>50%</div>
              <div className="p-4 bg-blue-600 rounded-lg opacity-75 text-white text-sm text-center" style={{ width: 100 }}>75%</div>
              <div className="p-4 bg-blue-600 rounded-lg text-white text-sm text-center" style={{ width: 100 }}>100%</div>
            </div>
          </div>

          {/* Semantic + utility overlap — test which token wins */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Semantic + Utility Overlap</h3>
            <p className="text-xs text-gray-400 mb-3">These use both semantic and utility classes. Token resolution should detect the utility token providing the value.</p>
            <div className="flex gap-4">
              <div className="card p-3 rounded-2xl shadow-md">
                <div className="card-header text-sm">Card + p-3 + rounded-2xl</div>
                <div className="card-body text-xs">Utility tokens override the card&apos;s default padding and radius.</div>
              </div>
              <div className="card pt-8 pb-2 border-l-4 border-blue-500">
                <div className="card-header text-sm">Card + pt-8 + pb-2</div>
                <div className="card-body text-xs">Asymmetric padding via individual axis tokens.</div>
              </div>
            </div>
          </div>

          {/* Border width + color tokens */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Border Width &amp; Color Tokens</h3>
            <div className="flex gap-4">
              <div className="p-4 border-2 border-blue-500 rounded-lg text-sm text-gray-700">border-2 blue</div>
              <div className="p-4 border-4 border-red-500 rounded-lg text-sm text-gray-700">border-4 red</div>
              <div className="p-4 border-2 border-green-500 rounded-lg text-sm text-gray-700">border-2 green</div>
              <div className="p-4 border-l-4 border-amber-500 bg-amber-50 rounded-lg text-sm text-gray-700">border-l-4 amber</div>
            </div>
          </div>
        </section>

      </main>

        {/* ── Section: CSS Custom Properties ── */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">CSS Custom Properties</h2>
          <p className="text-sm text-gray-500 mb-6">
            These elements use CSS custom properties (variables). Select them to see var() tokens in the picker.
          </p>
          <div style={{ display: "flex", gap: "var(--spacing-4)" }}>
            <div style={{
              padding: "var(--spacing-4)",
              backgroundColor: "var(--color-bg-subtle)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              fontSize: "var(--font-sm)",
            }}>
              Spacing + radius + color vars
            </div>
            <div style={{
              padding: "var(--spacing-6)",
              backgroundColor: "var(--color-brand)",
              borderRadius: "var(--radius-lg)",
              color: "#fff",
              fontSize: "var(--font-base)",
              fontWeight: 600,
              boxShadow: "var(--shadow-md)",
            }}>
              Brand card with shadow
            </div>
            <div style={{
              padding: "var(--spacing-3)",
              backgroundColor: "var(--color-bg)",
              borderRadius: "var(--radius-xl)",
              border: "2px solid var(--color-accent)",
              color: "var(--color-accent)",
              fontSize: "var(--font-xs)",
              fontWeight: 500,
            }}>
              Accent border
            </div>
          </div>
        </section>

      {/* ── Footer ── */}
      <footer className="border-b p-6 text-center text-sm text-gray-500">
        Retune Dev Playground &middot; Testing selector identification &amp; property controls
      </footer>
    </div>
  );
}
