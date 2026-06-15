export interface ChromeTab {
  id?: number;
  url?: string;
}

export interface ChromeMessage {
  type: "TUNA_TOGGLE_OVERLAY" | "TUNA_ACTIVATE_OVERLAY";
}

export interface ChromeApi {
  action: {
    onClicked: {
      addListener(listener: (tab: ChromeTab) => void | Promise<void>): void;
    };
  };
  runtime: {
    id?: string;
    lastError?: { message?: string };
    onMessage: {
      addListener(
        listener: (
          message: ChromeMessage,
          sender: unknown,
          sendResponse: (response?: unknown) => void,
        ) => boolean | void,
      ): void;
    };
  };
  scripting: {
    executeScript(details: {
      target: { tabId: number };
      files: string[];
    }): Promise<unknown>;
  };
  tabs: {
    sendMessage(tabId: number, message: ChromeMessage): Promise<unknown>;
  };
}

declare global {
  const chrome: ChromeApi | undefined;
}
