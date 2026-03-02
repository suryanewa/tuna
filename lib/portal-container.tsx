"use client";

import * as React from "react";

const PortalContainerContext = React.createContext<HTMLElement | null>(null);

export function usePortalContainer(): HTMLElement | null {
  return React.useContext(PortalContainerContext);
}

export function PortalContainerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [container, setContainer] = React.useState<HTMLElement | null>(null);

  return (
    <PortalContainerContext.Provider value={container}>
      {children}
      <div ref={setContainer} data-portal-container="" />
    </PortalContainerContext.Provider>
  );
}
