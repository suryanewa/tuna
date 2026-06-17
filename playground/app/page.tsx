import "./styles.css";
import { BentoCell } from "./bento-cell";
import { CopyCommandButton, TryItButton } from "./components";
import { FaqAccordion } from "./faq-accordion";
import { ScrollIndicator } from "./scroll-indicator";

const installCommand = "npm install @suryanewa/tuna";
const layoutSnippet = `import { Tuna } from "@suryanewa/tuna"

// Add anywhere in your component tree
<Tuna />`;
const aiSetupCommand = "npx @suryanewa/tuna setup";
const agentOutputExample = `Apply these Tuna visual changes to the source code:

**Environment:**
- URL: http://localhost:3000/
- Viewport: 1440×900
- Scroll: (0, 0)
- Timestamp: 2026-06-17T01:20:00.000Z

> **Framework:** Tailwind CSS detected. Apply all changes using Tailwind utility classes — do NOT use inline styles or raw CSS values. When a class swap is suggested, replace the old class with the new one in the JSX/HTML.

# Visual Changes (1 element)

## \`<button>\` "Get Started"

**Source:** \`src/components/HeroSection.tsx:42:10\`
**Component:** HeroSection → Button
**Styling:** Tailwind CSS (modify utility classes)
**DOM Path:** \`body > main > section.hero > div > button.btn-primary\`
**Selector:** \`main > section.hero > button.btn-primary\` (element-specific)
**Classes:** \`btn btn-primary px-6 py-3 rounded-lg bg-blue-600 text-sm\`

### Changes

| Property | Before | After | Token |
|----------|--------|-------|-------|
| \`padding\` | \`12px 24px\` | \`16px 32px\` | — |
| \`border-radius\` | \`8px\` | \`12px\` | — |
| \`background-color\` | \`#2563eb\` | \`#1d4ed8\` | \`.bg-blue-700\` |
| \`font-size\` | \`14px\` | \`16px\` | \`.text-base\` |`;

export default function Home() {
  return (
    <>
      <ScrollIndicator />
      <main className="compact-shell" id="main-content">
      <header className="top">
        <a className="brand" href="#main-content" aria-label="Tuna home">
          <img src="/tuna-mark.svg" alt="" width={44} height={20} />
          <h1>Tuna</h1>
        </a>
      </header>

      <section id="intro" className="intro" aria-labelledby="intro-title" data-scroll-section="Intro">
        <h2 id="intro-title">Visual edits your agents can ship.</h2>
        <p className="tagline">
          Tuna lets you select UI elements, fine-tune their visual details, and
          instruct your agents directly from your browser. Make changes visually
          and ship them frictionlessly.
        </p>
        <div className="hero-actions">
          <TryItButton />
          <div className="install-pill" aria-label={installCommand}>
            <span className="prompt">$</span>
            <code>{installCommand}</code>
            <CopyCommandButton text={installCommand} className="install-copy" />
          </div>
        </div>
      </section>

      <section id="workflow" className="function-rows" aria-labelledby="function-title" data-scroll-section="Workflow">
        <div className="section-head">
          <h2 id="function-title">How it works</h2>
          <p className="section-subtitle">A short loop for visual tuning.</p>
        </div>

        <div className="bento-grid">
          <BentoCell
            label="Speak"
            className="bento-speak"
            icon={<BentoMicIcon />}
            visual={<BentoSpeakDemo />}
            value="Dictate visual feedback and instructions in your browser. Tuna turns your spoken notes into targeted comments that reference selected elements as context."
          />
          <BentoCell
            label="Select"
            className="bento-select"
            icon={<BentoCursorIcon />}
            visual={<BentoSelectDemo />}
            value="Click on any element to capture selector, text, classes, bounds, and React ancestry context. Supports multiple selections."
          />
          <BentoCell
            label="Draw"
            className="bento-draw"
            icon={<BentoPencilIcon />}
            visual={<BentoDrawDemo />}
            value="Sketch directly over the page to mark areas, call out alignment issues, and capture visual annotations your agents can reference."
          />
          <BentoCell
            label="Comment"
            className="bento-comment"
            icon={<BentoCommentIcon />}
            visual={<BentoCommentDemo />}
            value="Quickly leave targeted notes on elements and drawn areas. Comments contain selector and component context alongside written visual changes."
          />
          <BentoCell
            label="Tune"
            className="bento-tune"
            icon={<BentoWrenchIcon />}
            visual={<BentoTuneDemo />}
            value="Adjust parameters including spacing, color, layout, opacity, and shadows with live previewing. Quickly alter individual elements, classes, and grouped selections."
          />
          <BentoCell
            label="Handoff"
            className="bento-handoff"
            icon={<BentoCopyIcon />}
            visual={<BentoHandoffDemo />}
            value="Copy or stream a structured diff through MCP with enough context for your coding agent to cleanly enact changes."
          />
        </div>
      </section>

      <section id="agent-output" className="agent-block" aria-labelledby="agent-output-title" data-scroll-section="Handoff">
        <div className="section-head">
          <h2 id="agent-output-title">Seamless handoff</h2>
          <p className="section-subtitle">
            No more tedious UI descriptions. Tuna gives your agents structured,
            actionable context so you can move from visual intent to shipped code
            faster.
          </p>
        </div>
        <div className="code-card">
          <pre>
            <AgentOutputCode />
          </pre>
          <CopyCommandButton text={agentOutputExample} iconSize={16} className="code-copy" />
        </div>
      </section>

      <section id="setup" className="setup-block" aria-labelledby="setup-title" data-scroll-section="Setup">
        <div className="section-head">
          <h2 id="setup-title">Get started</h2>
        </div>

        <div className="setup-steps">
          <SetupStep title="1. Install Tuna on your device">
            <div className="code-card code-card-command">
              <pre>
                <span className="code-prompt">$ </span>
                <span className="code-command">npm</span>{" "}
                <span className="code-function">install</span>{" "}
                <span className="code-string">@suryanewa/tuna</span>
              </pre>
              <CopyCommandButton text={installCommand} iconSize={16} className="code-copy" />
            </div>
          </SetupStep>

          <SetupStep title="2. Add Tuna to your codebase">
            <div className="code-card">
              <pre>
                <span className="code-keyword">import</span> {"{ "}
                <span className="code-symbol">Tuna</span>
                {" }"} <span className="code-keyword">from</span>{" "}
                <span className="code-string">"@suryanewa/tuna"</span>
                {"\n\n"}
                <span className="code-comment">{"// Add anywhere in your component tree"}</span>
                {"\n"}
                <span className="code-punctuation">{"<"}</span>
                <span className="code-component">Tuna</span>
                <span className="code-punctuation">{" />"}</span>
              </pre>
              <CopyCommandButton text={layoutSnippet} iconSize={16} className="code-copy" />
            </div>
          </SetupStep>

          <SetupStep title="3. Connect Tuna to your agent(s)">
            <p className="setup-copy">
              Auto-detects Codex, Claude Code, and Cursor. Automatically configures
              the Tuna MCP server and installs a skill that teaches your agents how
              to handle design-related code.
            </p>
            <div className="code-card code-card-command">
              <pre>
                <span className="code-prompt">$ </span>
                <span className="code-command">npx</span>{" "}
                <span className="code-string">@suryanewa/tuna</span>{" "}
                <span className="code-function">setup</span>
              </pre>
              <CopyCommandButton text={aiSetupCommand} iconSize={16} className="code-copy" />
            </div>
            <p className="setup-note">
              Works with Next.js, Vite, and Remix. Tailwind, CSS Modules, and plain CSS.
              Codex, Claude Code, Cursor, plus manual MCP configuration for other compatible agents.
            </p>
          </SetupStep>
        </div>
      </section>

      <section id="faq" className="faq-block" aria-labelledby="faq-title" data-scroll-section="FAQ">
        <div className="section-head">
          <h2 id="faq-title">FAQ</h2>
        </div>
        <FaqAccordion />
      </section>

      <footer className="footer">
        <div className="footer-links">
          <a
            className="footer-icon"
            href="https://github.com/suryanewa/tuna"
            aria-label="GitHub"
          >
            <GitHubIcon />
          </a>
          <a
            className="footer-icon"
            href="https://www.npmjs.com/package/@suryanewa/tuna"
            aria-label="npm"
          >
            <NpmIcon />
          </a>
          <a className="footer-icon" href="/llms.txt" aria-label="llms.txt">
            <DocumentIcon />
          </a>
        </div>
        <p className="footer-credit">
          A fork of{" "}
          <a href="https://retune.dev" target="_blank" rel="noopener noreferrer">
            Retune
          </a>{" "}
          by{" "}
          <a
            href="https://x.com/___sujan"
            target="_blank"
            rel="noopener noreferrer"
          >
            Sujan Khadgi
          </a>
        </p>
      </footer>
      </main>
    </>
  );
}

function AgentOutputCode() {
  return (
    <>
      <span className="code-prose">Apply these Tuna visual changes to the source code:</span>
      {"\n\n"}
      <span className="code-md-strong">**Environment:**</span>
      {"\n"}
      <span className="code-punctuation">-</span> <span className="code-md-key">URL</span>
      <span className="code-punctuation">:</span> <span className="code-string">http://localhost:3000/</span>
      {"\n"}
      <span className="code-punctuation">-</span> <span className="code-md-key">Viewport</span>
      <span className="code-punctuation">:</span> <span className="code-number">1440×900</span>
      {"\n"}
      <span className="code-punctuation">-</span> <span className="code-md-key">Scroll</span>
      <span className="code-punctuation">:</span> <span className="code-number">(0, 0)</span>
      {"\n"}
      <span className="code-punctuation">-</span> <span className="code-md-key">Timestamp</span>
      <span className="code-punctuation">:</span> <span className="code-string">2026-06-17T01:20:00.000Z</span>
      {"\n\n"}
      <span className="code-md-quote">&gt; </span>
      <span className="code-md-strong">**Framework:**</span>{" "}
      <span className="code-prose">Tailwind CSS detected. Apply all changes using Tailwind utility classes — do NOT use inline styles or raw CSS values. When a class swap is suggested, replace the old class with the new one in the JSX/HTML.</span>
      {"\n\n"}
      <span className="code-md-heading"># Visual Changes (1 element)</span>
      {"\n\n"}
      <span className="code-md-heading">## </span>
      <span className="code-inline">`&lt;button&gt;`</span>{" "}
      <span className="code-string">"Get Started"</span>
      {"\n\n"}
      <span className="code-md-strong">**Source:**</span>{" "}
      <span className="code-inline">`src/components/HeroSection.tsx:42:10`</span>
      {"\n"}
      <span className="code-md-strong">**Component:**</span>{" "}
      <span className="code-component">HeroSection</span>{" "}
      <span className="code-punctuation">→</span>{" "}
      <span className="code-component">Button</span>
      {"\n"}
      <span className="code-md-strong">**Styling:**</span>{" "}
      <span className="code-prose">Tailwind CSS (modify utility classes)</span>
      {"\n"}
      <span className="code-md-strong">**DOM Path:**</span>{" "}
      <span className="code-inline">`body &gt; main &gt; section.hero &gt; div &gt; button.btn-primary`</span>
      {"\n"}
      <span className="code-md-strong">**Selector:**</span>{" "}
      <span className="code-inline">`main &gt; section.hero &gt; button.btn-primary`</span>{" "}
      <span className="code-comment">(element-specific)</span>
      {"\n"}
      <span className="code-md-strong">**Classes:**</span>{" "}
      <span className="code-inline">`btn btn-primary px-6 py-3 rounded-lg bg-blue-600 text-sm`</span>
      {"\n\n"}
      <span className="code-md-heading">### Changes</span>
      {"\n\n"}
      <span className="code-table">| Property | Before | After | Token |</span>
      {"\n"}
      <span className="code-table">|----------|--------|-------|-------|</span>
      {"\n"}
      <span className="code-table">| </span>
      <span className="code-inline">`padding`</span>
      <span className="code-table"> | </span>
      <span className="code-inline">`12px 24px`</span>
      <span className="code-table"> | </span>
      <span className="code-inline">`16px 32px`</span>
      <span className="code-table"> | — |</span>
      {"\n"}
      <span className="code-table">| </span>
      <span className="code-inline">`border-radius`</span>
      <span className="code-table"> | </span>
      <span className="code-inline">`8px`</span>
      <span className="code-table"> | </span>
      <span className="code-inline">`12px`</span>
      <span className="code-table"> | — |</span>
      {"\n"}
      <span className="code-table">| </span>
      <span className="code-inline">`background-color`</span>
      <span className="code-table"> | </span>
      <span className="code-inline">`#2563eb`</span>
      <span className="code-table"> | </span>
      <span className="code-inline">`#1d4ed8`</span>
      <span className="code-table"> | </span>
      <span className="code-inline">`.bg-blue-700`</span>
      <span className="code-table"> |</span>
      {"\n"}
      <span className="code-table">| </span>
      <span className="code-inline">`font-size`</span>
      <span className="code-table"> | </span>
      <span className="code-inline">`14px`</span>
      <span className="code-table"> | </span>
      <span className="code-inline">`16px`</span>
      <span className="code-table"> | </span>
      <span className="code-inline">`.text-base`</span>
      <span className="code-table"> |</span>
    </>
  );
}

function BentoSpeakDemo() {
  return (
    <div className="bento-mini-ui speak-ui">
      <span className="speak-waveform">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

function BentoSelectDemo() {
  return (
    <div className="bento-mini-ui select-ui">
      <span className="select-target" />
      <span className="select-box">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="select-tooltip">button.btn-primary</span>
      <svg className="select-cursor" viewBox="0 0 24 24">
        <path d="M3.45158 4.72779L9.06387 20.5551C9.36964 21.4174 10.577 21.4503 10.9293 20.6059L13.6196 14.157C13.721 13.9138 13.9143 13.7205 14.1575 13.6191L20.6064 10.9288C21.4508 10.5765 21.4179 9.36915 20.5556 9.06338L4.72828 3.45109C3.93501 3.1698 3.17029 3.93452 3.45158 4.72779Z" />
      </svg>
    </div>
  );
}

function BentoDrawDemo() {
  return (
    <div className="bento-mini-ui draw-ui">
      <svg className="draw-canvas" viewBox="0 0 220 112">
        <rect className="draw-page-block draw-page-block-main" x="52" y="22" width="116" height="40" rx="5" />
        <rect className="draw-page-block draw-page-block-small" x="71" y="72" width="78" height="14" rx="4" />
        <circle className="draw-fill" cx="110" cy="62" r="26" />
        <circle className="draw-ink draw-ink-line" pathLength={1} cx="110" cy="62" r="26" />
      </svg>
      <svg className="draw-pencil-icon" viewBox="0 0 24 24">
        <path className="draw-pencil-body" d="M18.9142 3.41415L20.5858 5.08573C21.3668 5.86678 21.3668 7.13311 20.5858 7.91416L17.75 10.7499L7.83579 20.6642C7.46071 21.0392 6.95201 21.2499 6.42157 21.2499H2.75V17.5784C2.75 17.0479 2.96071 16.5392 3.33579 16.1642L13.25 6.24994L16.0858 3.41416C16.8668 2.63311 18.1332 2.63311 18.9142 3.41415Z" />
        <path className="draw-pencil-seam" d="M13.25 6.25L17.75 10.75" />
      </svg>
    </div>
  );
}

function BentoTuneDemo() {
  return (
    <div className="bento-mini-ui tune-ui">
      <div className="tune-row tune-row-spacing">
        <span className="tune-track">
          <i />
        </span>
      </div>
      <div className="tune-row tune-row-radius">
        <span className="tune-track">
          <i />
        </span>
      </div>
      <div className="tune-row tune-row-fill">
        <span className="tune-track">
          <i />
        </span>
      </div>
    </div>
  );
}

function BentoCommentDemo() {
  return (
    <div className="bento-mini-ui comment-ui">
      <div className="comment-page">
        <span className="comment-target" />
        <span className="comment-select-box">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="comment-trigger">
          <svg viewBox="0 0 20 20" aria-hidden="true" className="comment-trigger-icon">
            <path d="M3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10C17 13.866 13.866 17 10 17H4C3.44772 17 3 16.5523 3 16V10Z" />
          </svg>
        </span>
      </div>
      <div className="comment-box">
        <div className="comment-top-row">
          <span className="comment-close" />
          <div className="comment-input">
            <span className="comment-mention">@Button</span>
            <span className="comment-typing-wrap">
              <span className="comment-typed">tighten the padding</span>
              <span className="comment-caret" />
            </span>
          </div>
          <span className="comment-dictate">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M10 3.75C8.89543 3.75 8 4.64543 8 5.75V9.25C8 10.3546 8.89543 11.25 10 11.25C11.1046 11.25 12 10.3546 12 9.25V5.75C12 4.64543 11.1046 3.75 10 3.75Z" />
              <path d="M5.75 9.25C5.75 11.5972 7.65279 13.5 10 13.5C12.3472 13.5 14.25 11.5972 14.25 9.25" />
              <path d="M10 13.5V16.25" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

function BentoHandoffDemo() {
  return (
    <div className="bento-mini-ui handoff-ui">
      <div className="handoff-flow">
        <div className="handoff-node handoff-visual">
          <span className="handoff-visual-box" />
        </div>
        <div className="handoff-path">
          <span className="handoff-packet" />
        </div>
        <div className="handoff-node handoff-code">
          <svg className="handoff-code-glyph" viewBox="0 0 20 16" aria-hidden="true">
            <line className="handoff-code-line" x1="1" y1="3" x2="19" y2="3" />
            <line className="handoff-code-line" x1="1" y1="8" x2="13" y2="8" />
            <line className="handoff-code-line" x1="1" y1="13" x2="19" y2="13" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function BentoCursorIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="cursor-icon">
      <path className="cursor-arrow" d="M3.45158 4.72779L9.06387 20.5551C9.36964 21.4174 10.577 21.4503 10.9293 20.6059L13.6196 14.157C13.721 13.9138 13.9143 13.7205 14.1575 13.6191L20.6064 10.9288C21.4508 10.5765 21.4179 9.36915 20.5556 9.06338L4.72828 3.45109C3.93501 3.1698 3.17029 3.93452 3.45158 4.72779Z" />
    </svg>
  );
}

function BentoPencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="pencil-icon">
      <g className="pencil-body">
        <path d="M18.9142 3.41415L20.5858 5.08573C21.3668 5.86678 21.3668 7.13311 20.5858 7.91416L17.75 10.7499L7.83579 20.6642C7.46071 21.0392 6.95201 21.2499 6.42157 21.2499H2.75V17.5784C2.75 17.0479 2.96071 16.5392 3.33579 16.1642L13.25 6.24994L16.0858 3.41416C16.8668 2.63311 18.1332 2.63311 18.9142 3.41415Z" />
        <path d="M13.25 6.25L17.75 10.75" />
      </g>
    </svg>
  );
}

function BentoWrenchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="wrench-icon">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function BentoCommentIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="comment-icon">
      <path d="M3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10C17 13.866 13.866 17 10 17H4C3.44772 17 3 16.5523 3 16V10Z" />
    </svg>
  );
}

function BentoCopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="copy-icon">
      <path className="copy-bg" d="M7.75 7.75V5.75C7.75 4.64543 8.64543 3.75 9.75 3.75H18.25C19.3546 3.75 20.25 4.64543 20.25 5.75V14.26C20.25 15.3646 19.3546 16.26 18.25 16.26H16.25" />
      <path className="copy-fg" d="M3.75 9.75V18.25C3.75 19.3546 4.64543 20.25 5.75 20.25H14.25C15.3546 20.25 16.25 19.3546 16.25 18.25V9.75C16.25 8.64543 15.3546 7.75 14.25 7.75H5.75C4.64543 7.75 3.75 8.64543 3.75 9.75Z" />
    </svg>
  );
}

function BentoMicIcon() {
  return (
    <svg viewBox="4 2 16 20" aria-hidden="true" className="mic-icon">
      <path d="M12 3.75C10.8954 3.75 10 4.64543 10 5.75V12.25C10 13.3546 10.8954 14.25 12 14.25C13.1046 14.25 14 13.3546 14 12.25V5.75C14 4.64543 13.1046 3.75 12 3.75Z" />
      <path d="M6.75 11.75C6.75 14.6495 9.10051 17 12 17C14.8995 17 17.25 14.6495 17.25 11.75" />
      <path d="M12 17V20.25" />
    </svg>
  );
}

function SetupStep({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="setup-step">
      <h3 className="setup-step-title">{title}</h3>
      {children}
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="-1 -1 26 26" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.404 1.02.005 2.04.137 3 .404 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function NpmIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm0 2.5L18.5 9H14V4.5zM8 13h8v1.5H8V13zm0 3.5h8V18H8v-1.5z" />
    </svg>
  );
}
