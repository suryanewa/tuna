"use client";

import * as React from "react";
import { SectionWrapper, SectionBody, SectionRow } from "./section-wrapper";
import { SectionHeader } from "../ui/section-header";
import { ComboInput, type ComboInputOption } from "../ui/combo-input";
import { Checkbox } from "../ui/checkbox";
import { IconButton } from "../ui/icon-button";
import { PlusSmall, MinusSmall, LinkSmall } from "@/components/icons/editor";
import { INTERNAL_LINK_PREFIX, isInternalLink, parseInternalLink, createInternalLink } from "@/lib/playground/link-utils";
import type { Page } from "@/lib/playground/store";

// ============================================================================
// Types
// ============================================================================

export type LinkTarget = "_self" | "_blank";

export interface LinkValue {
  url: string;
  target: LinkTarget;
}

export interface LinkSectionProps {
  link: LinkValue | null;
  onLinkChange: (link: LinkValue | null) => void;
  pages?: Page[];           // Available pages for internal linking
  currentPageId?: string;   // Current page (to exclude from picker)
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_LINK: LinkValue = { url: "", target: "_blank" };

// ============================================================================
// Component
// ============================================================================

export function LinkSection({
  link,
  onLinkChange,
  pages,
  currentPageId,
  disabled = false,
  className,
}: LinkSectionProps) {
  const handleAddLink = () => onLinkChange({ ...DEFAULT_LINK });
  const handleRemoveLink = () => onLinkChange(null);

  const handleTargetChange = (checked: boolean) => {
    if (!link) return;
    onLinkChange({ ...link, target: checked ? "_blank" : "_self" });
  };

  // Build page options for the combo dropdown
  const pageOptions: ComboInputOption[] = (pages ?? [])
    .filter(p => p.id !== currentPageId)
    .sort((a, b) => a.order - b.order)
    .map(p => ({ value: createInternalLink(p.id), label: p.name }));

  // Determine display value: show page name if internal link, otherwise the URL
  const displayValue = React.useMemo(() => {
    if (!link) return undefined;
    if (isInternalLink(link.url)) {
      const pageId = parseInternalLink(link.url);
      const page = (pages ?? []).find(p => p.id === pageId);
      return page ? page.name : undefined;
    }
    return link.url;
  }, [link, pages]);

  const handleChange = (value: string | undefined) => {
    if (!link) return;
    if (value === undefined || value === "") {
      onLinkChange({ ...link, url: "" });
      return;
    }
    // If the value matches an internal link option, it's already in internal:// format
    if (isInternalLink(value)) {
      onLinkChange({ url: value, target: "_self" });
    } else {
      onLinkChange({ ...link, url: value });
    }
  };

  // Check for broken page link
  const linkedPageId = link ? parseInternalLink(link.url) : null;
  const isBrokenPageLink =
    linkedPageId !== null &&
    linkedPageId !== "" &&
    !(pages ?? []).some(p => p.id === linkedPageId);

  return (
    <SectionWrapper className={className}>
      <SectionHeader
        title="Link"
        isEmpty={link === null}
        iconButton={
          link === null
            ? {
                icon: PlusSmall,
                onClick: handleAddLink,
                "aria-label": "Add link",
                disabled,
              }
            : undefined
        }
      />
      {link !== null && (
        <SectionBody>
          {/* Row 1: URL / Page combo input + Remove */}
          <SectionRow hasTrailingAction>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <ComboInput
                  value={displayValue}
                  selectedValue={link.url}
                  onChange={handleChange}
                  options={pageOptions}
                  leadIcon={LinkSmall}
                  placeholder="https://..."
                  disabled={disabled}
                  allowCustom
                />
              </div>
              <IconButton
                icon={MinusSmall}
                onClick={handleRemoveLink}
                disabled={disabled}
                aria-label="Remove link"
                className="flex-shrink-0"
              />
            </div>
          </SectionRow>

          {/* Broken link warning */}
          {isBrokenPageLink && (
            <SectionRow>
              <span className="text-[9px] font-medium text-red-500">
                Linked page was deleted
              </span>
            </SectionRow>
          )}

          {/* Row 2: Open in new tab checkbox */}
          <SectionRow>
            <Checkbox
              checked={link.target === "_blank"}
              onCheckedChange={handleTargetChange}
              label="Open in new tab"
              disabled={disabled}
            />
          </SectionRow>
        </SectionBody>
      )}
    </SectionWrapper>
  );
}

LinkSection.displayName = "LinkSection";
