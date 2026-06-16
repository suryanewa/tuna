"use client";

import { useId, useState } from "react";

type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    id: "what-is-tuna",
    question: "What is Tuna?",
    answer:
      "Tuna is a development overlay for visually editing elements in your running app. You tweak spacing, color, typography, and layout in the browser, then send a structured diff to your coding agent to apply in source.",
  },
  {
    id: "production",
    question: "Does it run in production?",
    answer:
      "No. Tuna is meant for local development. Add it to your dev layout and keep it out of production builds.",
  },
  {
    id: "frameworks",
    question: "Which stacks does it support?",
    answer:
      "Tuna works with React apps on Next.js, Vite, Remix, and similar setups. It detects Tailwind, CSS Modules, plain CSS, and other stylesheet approaches automatically.",
  },
  {
    id: "ai-integration",
    question: "How does AI integration work?",
    answer:
      "Run npx @suryanewa/tuna setup to install the MCP server and skill for Claude Code or Cursor. Tuna can also copy structured output to the clipboard if you prefer a manual handoff.",
  },
  {
    id: "finding-elements",
    question: "How does Tuna find the right code?",
    answer:
      "Each change includes a CSS selector, React component path, text content, classes, and optional source hints. Fidelity levels let you send minimal diffs or richer layout context for larger codebases.",
  },
];

export function FaqAccordion() {
  const baseId = useId();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="faq-list">
      {FAQ_ITEMS.map((item) => {
        const isOpen = openId === item.id;
        const triggerId = `${baseId}-${item.id}-trigger`;
        const panelId = `${baseId}-${item.id}-panel`;

        return (
          <div key={item.id} className={`faq-item${isOpen ? " is-open" : ""}`}>
            <button
              type="button"
              id={triggerId}
              className="faq-trigger"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenId(isOpen ? null : item.id)}
            >
              <span>{item.question}</span>
              <span className="faq-icon" aria-hidden="true" />
            </button>
            <div
              id={panelId}
              className="faq-panel-wrap"
              role="region"
              aria-labelledby={triggerId}
              aria-hidden={!isOpen}
            >
              <div className="faq-panel-inner">
                <p>{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
