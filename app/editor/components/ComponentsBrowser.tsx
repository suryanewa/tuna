"use client";

import React, { useState, useMemo } from "react";
import { useEditorMutations, useSelectedIds } from "./context";
import { useComposer } from "@/app/editor/provider/ComposerProvider";
import { cn } from "@/lib/utils";
import { SearchSmall, CloseFilled } from "@/components/icons/editor";
import { ChevronRight16, ComponentSmall16 } from "@/components/icons/editor-16";
import { ARTBOARD_LAYER_ID } from "@/lib/playground/store";

// ─── UDS Component Catalog ──────────────────────────────────────────────

interface UDSComponentDef {
  id: string;
  label: string;
  description: string;
}

interface UDSCategory {
  name: string;
  components: UDSComponentDef[];
}

const UDS_CATALOG: UDSCategory[] = [
  {
    name: "Actions",
    components: [
      { id: "Button", label: "Button", description: "Primary action trigger" },
      { id: "IconButton", label: "IconButton", description: "Icon-only button" },
      { id: "Link", label: "Link", description: "Navigation link" },
      { id: "Pressable", label: "Pressable", description: "Generic pressable area" },
    ],
  },
  {
    name: "Inputs",
    components: [
      { id: "Input", label: "Input", description: "Text input field" },
      { id: "Checkbox", label: "Checkbox", description: "Checkbox control" },
      { id: "Radio", label: "Radio", description: "Radio button" },
      { id: "Switch", label: "Switch", description: "Toggle switch" },
    ],
  },
  {
    name: "Data Display",
    components: [
      { id: "Avatar", label: "Avatar", description: "User profile image" },
      { id: "Badge", label: "Badge", description: "Status indicator" },
      { id: "Chip", label: "Chip", description: "Tag or filter chip" },
      { id: "Tooltip", label: "Tooltip", description: "Hover tooltip" },
    ],
  },
  {
    name: "Feedback",
    components: [
      { id: "Toast", label: "Toast", description: "Notification toast" },
      { id: "Divider", label: "Divider", description: "Visual separator" },
    ],
  },
  {
    name: "Surfaces",
    components: [
      { id: "Menu", label: "Menu", description: "Dropdown menu" },
      { id: "Screen", label: "Screen", description: "Screen wrapper" },
    ],
  },
  {
    name: "Media",
    components: [
      { id: "Image", label: "Image", description: "Image display" },
      { id: "Icon", label: "Icon", description: "Icon display" },
    ],
  },
];

// ─── Component ──────────────────────────────────────────────────────────

export function ComponentsBrowser() {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const { addElement, addCanvasElement, updateElement } = useEditorMutations();
  const { elements } = useComposer();
  const selectedIds = useSelectedIds();

  const filteredCatalog = useMemo(() => {
    if (!query.trim()) return UDS_CATALOG;
    const q = query.toLowerCase();
    return UDS_CATALOG
      .map((cat) => ({
        ...cat,
        components: cat.components.filter(
          (c) => c.label.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.components.length > 0);
  }, [query]);

  const handleInsert = (componentId: string) => {
    const selectedId = selectedIds?.[0];
    const selectedEl = selectedId ? elements[selectedId] : null;

    if (selectedId === ARTBOARD_LAYER_ID || selectedEl?.type === "container") {
      const parentId = selectedId === ARTBOARD_LAYER_ID ? null : selectedId;
      const newId = addElement("component", parentId, {
        styles: { width: "w-auto", height: "h-auto" },
      });
      if (newId) updateElement(newId, { mcpComponentId: componentId, name: componentId });
    } else if (selectedEl?.parentId && elements[selectedEl.parentId]) {
      const parent = elements[selectedEl.parentId];
      const siblingIndex = parent.children?.indexOf(selectedId!) ?? -1;
      const newId = addElement("component", selectedEl.parentId, {
        insertIndex: siblingIndex >= 0 ? siblingIndex + 1 : undefined,
        styles: { width: "w-auto", height: "h-auto" },
      });
      if (newId) updateElement(newId, { mcpComponentId: componentId, name: componentId });
    } else {
      const newId = addCanvasElement("component", 50, 50, { width: 200, height: 40 });
      if (newId) updateElement(newId, { mcpComponentId: componentId, name: componentId });
    }
  };

  const toggleCategory = (name: string) => {
    setCollapsed((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Search */}
      <div className="px-3 pt-2 pb-1 flex-shrink-0">
        <div className="flex items-center w-full bg-stone-100 dark:bg-stone-800 rounded-input px-1.5">
          <SearchSmall className="w-4 h-4 shrink-0 text-stone-400 dark:text-stone-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search components..."
            className="flex-1 h-7 bg-transparent text-[11px] tracking-[0.055px] text-stone-900 dark:text-stone-100 border-0 outline-none placeholder:text-stone-400 dark:placeholder:text-stone-500 pl-1"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="w-4 h-4 shrink-0 flex items-center justify-center text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300"
            >
              <CloseFilled className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto overscroll-none">
        {filteredCatalog.length === 0 ? (
          <div className="px-4 py-8 text-center text-[11px] text-stone-400 dark:text-stone-500">
            No components found
          </div>
        ) : (
          filteredCatalog.map((cat) => {
            const isCollapsed = collapsed[cat.name] && !query.trim();
            return (
              <div key={cat.name}>
                {/* Category header */}
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.name)}
                  className="flex items-center gap-1 w-full px-4 py-1.5 text-left hover:bg-stone-50 dark:hover:bg-stone-800/50"
                >
                  <ChevronRight16
                    className={cn(
                      "w-3 h-3 shrink-0 text-stone-400 dark:text-stone-500 transition-transform duration-150",
                      !isCollapsed && "rotate-90"
                    )}
                  />
                  <span className="text-[9px] font-medium tracking-[0.045px] text-stone-500 dark:text-stone-400 uppercase">
                    {cat.name}
                  </span>
                </button>

                {/* Component items */}
                {!isCollapsed && (
                  <div>
                    {cat.components.map((comp) => (
                      <button
                        key={comp.id}
                        type="button"
                        onClick={() => handleInsert(comp.id)}
                        className="flex items-center gap-2 w-full h-7 px-4 pl-7 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 group"
                      >
                        <ComponentSmall16 className="w-4 h-4 shrink-0 text-stone-400 dark:text-stone-500 group-hover:text-blue-500" />
                        <span className="text-[11px] font-[450] tracking-[0.055px] text-stone-700 dark:text-stone-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                          {comp.label}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

ComponentsBrowser.displayName = "ComponentsBrowser";
