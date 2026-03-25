import { describe, it, expect, vi } from "vitest";
import { PreviewBridge } from "./preview-bridge";

describe("PreviewBridge", () => {
  it("notifies subscribers when a value is set", () => {
    const bridge = new PreviewBridge();
    const listener = vi.fn();
    bridge.subscribe("width", listener);

    bridge.set("width", "100px");

    expect(listener).toHaveBeenCalledWith("100px");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not notify unrelated subscribers", () => {
    const bridge = new PreviewBridge();
    const widthListener = vi.fn();
    const heightListener = vi.fn();
    bridge.subscribe("width", widthListener);
    bridge.subscribe("height", heightListener);

    bridge.set("width", "100px");

    expect(widthListener).toHaveBeenCalledWith("100px");
    expect(heightListener).not.toHaveBeenCalled();
  });

  it("supports multiple subscribers for the same property", () => {
    const bridge = new PreviewBridge();
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    bridge.subscribe("width", listener1);
    bridge.subscribe("width", listener2);

    bridge.set("width", "200px");

    expect(listener1).toHaveBeenCalledWith("200px");
    expect(listener2).toHaveBeenCalledWith("200px");
  });

  it("unsubscribes correctly", () => {
    const bridge = new PreviewBridge();
    const listener = vi.fn();
    const unsub = bridge.subscribe("width", listener);

    bridge.set("width", "100px");
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    bridge.set("width", "200px");
    expect(listener).toHaveBeenCalledTimes(1); // not called again
  });

  it("tracks active state via start/end", () => {
    const bridge = new PreviewBridge();
    expect(bridge.active).toBe(false);

    bridge.start();
    expect(bridge.active).toBe(true);

    bridge.end();
    expect(bridge.active).toBe(false);
  });

  it("notifies subscribers with empty string on end", () => {
    const bridge = new PreviewBridge();
    const listener = vi.fn();
    bridge.subscribe("width", listener);

    bridge.start();
    bridge.set("width", "100px");
    bridge.end();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith("");
  });

  it("handles subscribe after set without error", () => {
    const bridge = new PreviewBridge();
    bridge.set("width", "100px"); // no subscribers yet — should not throw

    const listener = vi.fn();
    bridge.subscribe("width", listener);
    bridge.set("width", "200px");

    expect(listener).toHaveBeenCalledWith("200px");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("cleans up empty listener sets", () => {
    const bridge = new PreviewBridge();
    const listener = vi.fn();
    const unsub = bridge.subscribe("width", listener);
    unsub();

    // Set should not throw even after all listeners removed
    bridge.set("width", "300px");
    expect(listener).not.toHaveBeenCalled();
  });

  it("handles rapid sequential sets", () => {
    const bridge = new PreviewBridge();
    const listener = vi.fn();
    bridge.subscribe("top", listener);

    bridge.start();
    for (let i = 0; i < 100; i++) {
      bridge.set("top", `${i}px`);
    }

    expect(listener).toHaveBeenCalledTimes(100);
    expect(listener).toHaveBeenLastCalledWith("99px");
  });
});
