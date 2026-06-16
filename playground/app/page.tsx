import "./styles.css";
import { CopyCommandButton, TryItButton } from "./components";
import { FaqAccordion } from "./faq-accordion";

const installCommand = "npm install @suryanewa/tuna";
const layoutSnippet = `import { Tuna } from "@suryanewa/tuna"

// Add anywhere in your component tree
<Tuna />`;
const aiSetupCommand = "npx @suryanewa/tuna setup";
const agentOutputExample = `# Visual Changes (1 element)

## \`<button>\` "Get Started"

**Source:** \`src/components/HeroSection.tsx:42:10\` when React source metadata is available
**Component:** HeroSection → Button
**Styling:** Tailwind CSS
**Selector:** \`main > section.hero > button.btn-primary\`

### Changes

| Property | Before | After | Token |
|----------|--------|-------|-------|
| \`padding\` | \`12px 24px\` | \`16px 32px\` | — |
| \`border-radius\` | \`8px\` | \`12px\` | — |
| \`background-color\` | \`#2563eb\` | \`#1d4ed8\` | \`bg-blue-700\` |
| \`font-size\` | \`14px\` | \`16px\` | \`text-base\` |`;

export default function Home() {
  return (
    <main className="compact-shell" id="main-content">
      <header className="top">
        <a className="brand" href="#main-content" aria-label="Tuna home">
          <img src="/icon.svg" alt="" width={44} height={20} />
          <h1>Tuna</h1>
        </a>
      </header>

      <section className="intro" aria-labelledby="intro-title">
        <h2 id="intro-title">Edit the page. Send the exact change.</h2>
        <p className="tagline">
          Tuna lets you select DOM elements in development, adjust their visual
          details in the browser, and hand your coding agent a structured diff it
          can apply to source.
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

      <section className="function-rows" aria-labelledby="function-title">
        <div className="section-head">
          <h2 id="function-title">How it works</h2>
          <p className="section-subtitle">A short loop for visual fixes.</p>
        </div>

        <div className="bento-grid">
          <BentoCell
            label="Context"
            className="bento-context"
            icon={<BentoSettingsIcon />}
            value="Minimal keeps context compact. Standard adds component tree, classes, and text. Full adds richer layout and page context."
          />
          <BentoCell
            label="Select"
            className="bento-select"
            icon={<BentoCursorIcon />}
            value="Click an element while Tuna is active. The overlay captures selector, text, classes, bounds, and React ancestry."
          />
          <BentoCell
            label="Draw"
            className="bento-draw"
            icon={<BentoPencilIcon />}
            value="Sketch directly over the page to mark areas, call out alignment issues, and capture visual annotations your agent can inspect."
          />
          <BentoCell
            label="Tune"
            className="bento-tune"
            icon={<BentoWrenchIcon />}
            value="Adjust spacing, typography, color, radius, layout, image fit, position, opacity, and shadows with live preview."
          />
          <BentoCell
            label="Comment"
            className="bento-comment"
            icon={<BentoCommentIcon />}
            value="Leave targeted notes on elements or drawn areas. Comments travel with selector and component context alongside visual changes."
          />
          <BentoCell
            label="Handoff"
            className="bento-handoff"
            icon={<BentoCopyIcon />}
            value="Copy or stream a structured diff through MCP with enough context for your coding agent to find the source."
          />
        </div>
      </section>

      <section className="agent-block" aria-labelledby="agent-output-title">
        <div className="section-head">
          <h2 id="agent-output-title">What your agent sees</h2>
          <p className="section-subtitle">
            Not vague descriptions, structured data. Component names, selector paths,
            styling approach, source hints when available, and exact before/after
            values your agent can act on immediately.
          </p>
        </div>
        <div className="code-card">
          <pre>{agentOutputExample}</pre>
          <CopyCommandButton text={agentOutputExample} iconSize={16} className="code-copy" />
        </div>
      </section>

      <section className="setup-block" aria-labelledby="setup-title">
        <div className="section-head">
          <h2 id="setup-title">Get started</h2>
        </div>

        <div className="setup-steps">
          <SetupStep title="1. Install the package">
            <div className="code-card code-card-command">
              <pre>
                <span className="prompt">$ </span>
                {installCommand}
              </pre>
              <CopyCommandButton text={installCommand} iconSize={16} className="code-copy" />
            </div>
          </SetupStep>

          <SetupStep title="2. Add to your layout">
            <div className="code-card">
              <pre>
                <span className="code-k">import</span> {"{ Tuna }"} <span className="code-k">from</span>{" "}
                <span className="code-s">"@suryanewa/tuna"</span>
                {"\n\n"}
                <span className="code-c">{"// Add anywhere in your component tree"}</span>
                {"\n"}
                {"<"}
                <span className="code-k">Tuna</span>
                {" />"}
              </pre>
              <CopyCommandButton text={layoutSnippet} iconSize={16} className="code-copy" />
            </div>
            <p className="setup-note">
              Automatically hidden in production. Use {"<Tuna force />"} for live demos.
            </p>
          </SetupStep>

          <SetupStep title="3. Connect your AI tool">
            <p className="setup-copy">
              Auto-detects Claude Code and Cursor. Configures the MCP server and installs
              the Tuna skill that teaches your agent how to resolve design tokens, utility
              classes, and CSS variables.
            </p>
            <div className="code-card code-card-command">
              <pre>
                <span className="prompt">$ </span>
                {aiSetupCommand}
              </pre>
              <CopyCommandButton text={aiSetupCommand} iconSize={16} className="code-copy" />
            </div>
            <p className="setup-note">
              Works with Next.js, Vite, and Remix. Tailwind, CSS Modules, and plain CSS.
              Claude Code and Cursor via MCP.
            </p>
          </SetupStep>
        </div>
      </section>

      <section className="faq-block" aria-labelledby="faq-title">
        <div className="section-head">
          <h2 id="faq-title">FAQ</h2>
        </div>
        <FaqAccordion />
      </section>

      <footer className="footer">
        <div className="footer-links">
          <a
            className="footer-icon"
            href="https://github.com/khadgi-sujan/tuna"
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
  );
}

function BentoCell({ label, value, icon, className }: { label: string; value: string; icon?: React.ReactNode; className?: string }) {
  return (
    <article className={`bento-cell ${className || ""}`}>
      <h3 className="bento-cell-label">
        <span>{label}</span>
        {icon && <span className="bento-cell-icon">{icon}</span>}
      </h3>
      <p className="bento-cell-copy">{value}</p>
    </article>
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

function BentoSettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="settings-icon">
      <path className="gear-outer" d="M7.878 5.21415L7.17474 5.05186C6.58003 4.91462 5.95657 5.09343 5.525 5.525C5.09343 5.95657 4.91462 6.58003 5.05186 7.17474L5.21415 7.878C5.40122 8.6886 5.06696 9.53036 4.37477 9.99182L3.51965 10.5619C3.03881 10.8825 2.75 11.4221 2.75 12C2.75 12.5779 3.03881 13.1175 3.51965 13.4381L4.37477 14.0082C5.06696 14.4696 5.40122 15.3114 5.21415 16.122L5.05186 16.8253C4.91462 17.42 5.09343 18.0434 5.525 18.475C5.95657 18.9066 6.58003 19.0854 7.17474 18.9481L7.878 18.7858C8.6886 18.5988 9.53036 18.933 9.99182 19.6252L10.5619 20.4804C10.8825 20.9612 11.4221 21.25 12 21.25C12.5779 21.25 13.1175 20.9612 13.4381 20.4804L14.0082 19.6252C14.4696 18.933 15.3114 18.5988 16.122 18.7858L16.8253 18.9481C17.42 19.0854 18.0434 18.9066 18.475 18.475C18.9066 18.0434 19.0854 17.42 18.9481 16.8253L18.7858 16.122C18.5988 15.3114 18.933 14.4696 19.6252 14.0082L20.4804 13.4381C20.9612 13.1175 21.25 12.5779 21.25 12C21.25 11.4221 20.9612 10.8825 20.4804 10.5619L19.6252 9.99182C18.933 9.53036 18.5988 8.6886 18.7858 7.878L18.9481 7.17473C19.0854 6.58003 18.9066 5.95657 18.475 5.525C18.0434 5.09343 17.42 4.91462 16.8253 5.05186L16.122 5.21415C15.3114 5.40122 14.4696 5.06696 14.0082 4.37477L13.4381 3.51965C13.1175 3.03881 12.5779 2.75 12 2.75C11.4221 2.75 10.8825 3.03881 10.5619 3.51965L9.99182 4.37477C9.53036 5.06696 8.6886 5.40122 7.878 5.21415Z" />
      <path className="gear-inner" d="M14.75 12C14.75 13.5188 13.5188 14.75 12 14.75C10.4812 14.75 9.25 13.5188 9.25 12C9.25 10.4812 10.4812 9.25 12 9.25C13.5188 9.25 14.75 10.4812 14.75 12Z" />
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
