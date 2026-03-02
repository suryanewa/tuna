"use client";

import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { usePortalContainer } from "@/lib/portal-container";
import { useVisualBell } from "./VisualBellContext";
import { VisualBell } from "./VisualBell";

export function VisualBellPortal() {
  const { bells, dismissBell } = useVisualBell();
  const portalContainer = usePortalContainer();
  const activeBell = bells[bells.length - 1] ?? null;

  const content = (
    <div
      data-editor-panel
      style={{
        position: "fixed",
        bottom: 80,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        pointerEvents: "none",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <AnimatePresence mode="wait">
        {activeBell && (
          <motion.div
            key={activeBell.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15, ease: [0.2, 0.65, 0.3, 0.9] }}
          >
            <VisualBell entry={activeBell} onDismiss={dismissBell} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return createPortal(content, portalContainer ?? document.body);
}
