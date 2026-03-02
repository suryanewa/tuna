"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { SearchSmall, CloseFilled } from "@/components/icons/editor";
import type { GifImage } from "@/lib/playground/types";

// ============================================================================
// Types
// ============================================================================

interface GifSearchPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectGif: (gifUrl: string, width: number, height: number) => void;
}

// ============================================================================
// Component
// ============================================================================

export function GifSearchPopover({
  open,
  onOpenChange,
  onSelectGif,
}: GifSearchPopoverProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<GifImage[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>();

  // Fetch trending on open
  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    fetchGifs("");
    // Focus input after mount
    requestAnimationFrame(() => inputRef.current?.focus());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Click outside to close
  React.useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    // Delay to avoid closing immediately from the button click that opened it
    const timer = setTimeout(() => {
      document.addEventListener("pointerdown", handlePointerDown);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open, onOpenChange]);

  // Escape to close
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const fetchGifs = React.useCallback(async (q: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/playground/gifs?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setResults(data.gifs || []);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchGifs(value), 300);
  };

  // Split results into two columns (alternating for even distribution)
  const col1: GifImage[] = [];
  const col2: GifImage[] = [];
  results.forEach((gif, i) => {
    if (i % 2 === 0) col1.push(gif);
    else col2.push(gif);
  });

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      data-editor-panel
      className={cn(
        "fixed left-1/2 -translate-x-1/2 bottom-[60px] z-[60]",
        "w-[400px] bg-white dark:bg-stone-900 overflow-hidden",
        "flex flex-col"
      )}
      style={{
        height: 380,
        borderRadius: 14,
        boxShadow: "0px 0px 0.5px rgba(0,0,0,0.3), 0px 1px 3px rgba(0,0,0,0.15)",
      }}
    >
      {/* Search input */}
      <div className="p-[12px] border-b border-stone-200 dark:border-stone-700">
        <div className="flex items-center w-full bg-stone-100 dark:bg-stone-800 rounded-md p-[4px]">
          <SearchSmall className="w-6 h-6 shrink-0 text-stone-400 dark:text-stone-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search KLIPY"
            className="flex-1 h-6 bg-transparent text-[11px] tracking-[0.055px] text-stone-900 dark:text-stone-100 border-0 outline-none placeholder:text-stone-400 dark:placeholder:text-stone-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => { handleQueryChange(""); inputRef.current?.focus(); }}
              className="w-6 h-6 shrink-0 flex items-center justify-center text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300"
            >
              <CloseFilled className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-[12px]">
        {isLoading && results.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-[11px] text-stone-400 dark:text-stone-500">Loading...</span>
          </div>
        ) : results.length > 0 ? (
          <>
            <div className="flex gap-[8px]">
              {/* Column 1 */}
              <div className="flex-1 flex flex-col gap-[8px] py-[12px]">
                {col1.map((gif) => (
                  <button
                    key={gif.id}
                    type="button"
                    onClick={() => onSelectGif(gif.original_url, gif.original_width, gif.original_height)}
                    className="w-full rounded-md overflow-hidden bg-stone-100 dark:bg-stone-800 hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={gif.url} alt={gif.title} className="w-full h-auto" loading="lazy" />
                  </button>
                ))}
              </div>
              {/* Column 2 */}
              <div className="flex-1 flex flex-col gap-[8px] py-[12px]">
                {col2.map((gif) => (
                  <button
                    key={gif.id}
                    type="button"
                    onClick={() => onSelectGif(gif.original_url, gif.original_width, gif.original_height)}
                    className="w-full rounded-md overflow-hidden bg-stone-100 dark:bg-stone-800 hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={gif.url} alt={gif.title} className="w-full h-auto" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
            <p className="py-2 text-center text-[9px] text-stone-400 dark:text-stone-500">Powered by KLIPY</p>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-1">
            <span className="text-[11px] text-stone-400 dark:text-stone-500">
              {query ? "No GIFs found" : "Search for GIFs"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

GifSearchPopover.displayName = "GifSearchPopover";
