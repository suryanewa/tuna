import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEventHandler } from "react";
import type { Comment } from "../../engine/comment-store";
import { IconCrossMedium } from "../../ui/icons";
import { useCommentDictation } from "../use-comment-dictation";
import { AudioWaveform } from "./AudioWaveform";
import {
  CommentEditor,
  type CommentEditorApi,
  type CommentMention,
} from "./CommentEditor";
import {
  cloneDoc,
  createDocFromTargets,
  docToLexicalParts,
  docToPlainText,
  docToUserText,
  getDoc,
  type CommentDoc,
} from "./comment-doc";
import {
  getCommentElementTargets,
  getMentionColorForTarget,
  getMentionNameForTarget,
} from "./comment-draft";

const DEFAULT_POPOVER_WIDTH = 360;
const COLLAPSED_POPOVER_WIDTH = 320;
// Fixed chrome around the editor in the collapsed pill: left/right padding (20),
// close button (20), dictation pill (24), and the two 6px top-row gaps (12).
const COLLAPSED_CHROME_PX = 76;
const COLLAPSED_CONTENT_MAX_PX = COLLAPSED_POPOVER_WIDTH - COLLAPSED_CHROME_PX;
const COLLAPSED_MEASURER_STYLE =
  "position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;font-size:13px;font-weight:400;line-height:1.4;letter-spacing:-0.005em;font-family:InterVariable,Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;";
const POINTER_CLICK_MOVE_THRESHOLD_PX = 3;

/** Only activate on pointer-up when pointer-down started on the same control (not drag-release). */
function usePointerClickHandlers(onAction: () => void) {
  const pressedRef = useRef(false);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  const onPointerDown = useCallback<PointerEventHandler<HTMLButtonElement>>((e) => {
    if (e.button !== 0) return;
    pressedRef.current = true;
    originRef.current = { x: e.clientX, y: e.clientY };
    e.stopPropagation();
  }, []);

  const onPointerUp = useCallback<PointerEventHandler<HTMLButtonElement>>((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const origin = originRef.current;
    const pressed = pressedRef.current;
    pressedRef.current = false;
    originRef.current = null;
    if (!pressed || !origin) return;
    if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > POINTER_CLICK_MOVE_THRESHOLD_PX) return;
    onActionRef.current();
  }, []);

  const onPointerCancel = useCallback(() => {
    pressedRef.current = false;
    originRef.current = null;
  }, []);

  return { onPointerDown, onPointerUp, onPointerCancel };
}

function isPopoverButtonTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("button") != null;
}

function isCloseButtonTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(".tuna-comment-close") != null;
}

function collapsedContentWouldOverflow(text: string): boolean {
  if (!text.trim() || typeof document === "undefined") return false;
  const measurer = document.createElement("span");
  measurer.textContent = text;
  measurer.style.cssText = COLLAPSED_MEASURER_STYLE;
  document.body.appendChild(measurer);
  const contentWidth = measurer.offsetWidth;
  measurer.remove();
  return contentWidth > COLLAPSED_CONTENT_MAX_PX;
}

export function CommentPopover({
  position,
  initialText,
  initialContent,
  onSubmit,
  onCancel,
  onDelete,
  onDocChange,
  elementInfo,
  spanMentionCount,
  primarySelector,
  registerCommentComposerFocus,
}: {
  position: { x: number; y: number };
  initialText: string;
  initialContent?: CommentDoc;
  onSubmit: (doc: CommentDoc) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onDocChange?: (doc: CommentDoc) => void;
  elementInfo?: Comment["elementInfo"];
  /** Elements shown as colored @ spans before the input (frozen at draft open). */
  spanMentionCount?: number;
  /** Selector for single-element drafts without selectedElements. */
  primarySelector?: string;
  registerCommentComposerFocus?: (focus: () => void) => void;
}) {
  const targets = useMemo(
    () => getCommentElementTargets(elementInfo, primarySelector),
    [elementInfo, primarySelector],
  );

  const seedDoc = useMemo((): CommentDoc => {
    if (initialContent) return initialContent;
    if (initialText.trim()) {
      return getDoc({
        text: initialText,
        elementInfo,
        selector: primarySelector,
      } as Comment);
    }
    return createDocFromTargets(targets, spanMentionCount ?? 1, "");
  }, [elementInfo, initialContent, initialText, primarySelector, spanMentionCount, targets]);

  const [doc, setDoc] = useState<CommentDoc>(seedDoc);
  const hasUserText = docToUserText(doc).trim().length > 0;
  const [dictationSeconds, setDictationSeconds] = useState(0);
  const editorRef = useRef<CommentEditorApi>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const closePressRef = useRef<{ x: number; y: number } | null>(null);
  const closeDismissHandledRef = useRef(false);
  const dictationSnapshotRef = useRef<CommentDoc>(cloneDoc(seedDoc));
  const isEdit = !!onDelete;
  const mentionSelectorsRef = useRef("");

  const contentParts = useMemo(() => {
    if (!isEdit) return undefined;
    return docToLexicalParts(seedDoc);
  }, [isEdit, seedDoc]);

  const mentions = useMemo<CommentMention[]>(() => {
    if (contentParts) return [];
    if (!elementInfo) return [];
    const spanCount = spanMentionCount ?? 1;
    if (elementInfo.selectedElements) {
      return elementInfo.selectedElements.slice(0, spanCount).map((target, idx) => ({
        name: getMentionNameForTarget(target, elementInfo.selectedElements ?? []),
        color: getMentionColorForTarget(target, idx),
        selector: target.selector,
      }));
    }
    const target = {
      tagName: elementInfo.tagName,
      selector: primarySelector ?? "",
      componentName: elementInfo.componentName,
      componentPath: elementInfo.componentPath,
      classes: elementInfo.classes,
      textContent: elementInfo.textContent,
      mentionColor: undefined,
    };
    return [{
      name: getMentionNameForTarget(target),
      color: getMentionColorForTarget(target, 0),
      selector: primarySelector ?? "",
    }];
  }, [contentParts, elementInfo, primarySelector, spanMentionCount]);

  useEffect(() => {
    registerCommentComposerFocus?.(() => {
      editorRef.current?.focus();
    });
  }, [registerCommentComposerFocus]);

  useEffect(() => {
    const signature = mentions.map((mention) => mention.selector).join("\0");
    const previous = mentionSelectorsRef.current;
    const grew = signature.length > previous.length && signature.startsWith(previous);
    mentionSelectorsRef.current = signature;
    if (!grew || isEdit) return;
    editorRef.current?.focus();
  }, [isEdit, mentions]);

  const handleEditorChange = useCallback((nextDoc: CommentDoc) => {
    setDoc(nextDoc);
    onDocChange?.(nextDoc);
  }, [onDocChange]);

  const handleDictationDelta = useCallback((spokenText: string) => {
    editorRef.current?.insertText(spokenText);
  }, []);

  const {
    isDictating,
    isTranscribing,
    usesWhisperFallback,
    dictationError,
    visualizationStream,
    toggleDictation,
    confirmDictation,
    cancelDictation,
  } = useCommentDictation(handleDictationDelta);

  const handleStartDictation = useCallback(() => {
    dictationSnapshotRef.current = cloneDoc(editorRef.current?.getDoc() ?? doc);
    toggleDictation();
  }, [doc, toggleDictation]);

  const handleCancelDictation = useCallback(() => {
    const snapshot = dictationSnapshotRef.current;
    cancelDictation();
    editorRef.current?.restoreDoc(snapshot);
    setDoc(snapshot);
    onDocChange?.(snapshot);
    editorRef.current?.focus();
  }, [cancelDictation, onDocChange]);

  const handleSubmit = useCallback(() => {
    const trimmed = docToPlainText(doc).trim();
    if (!trimmed) return;
    onSubmit(doc);
  }, [doc, onSubmit]);

  const handleCancel = useCallback(() => {
    if (isDictating) {
      handleCancelDictation();
      return;
    }
    onCancel();
  }, [handleCancelDictation, isDictating, onCancel]);

  const handleDismiss = useCallback(() => {
    if (isDictating) {
      cancelDictation();
    }
    onCancel();
  }, [cancelDictation, isDictating, onCancel]);

  const runCloseDismiss = useCallback(() => {
    if (closeDismissHandledRef.current) return;
    closeDismissHandledRef.current = true;
    handleDismiss();
  }, [handleDismiss]);

  useEffect(() => {
    if (!isDictating) {
      setDictationSeconds(0);
      return;
    }
    const interval = window.setInterval(() => {
      setDictationSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isDictating]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const dictationTitle = dictationError
    ?? (isTranscribing
      ? "Transcribing..."
      : usesWhisperFallback
        ? (isDictating ? "Stop recording" : "Record comment (Whisper)")
        : (isDictating ? "Stop dictation" : "Dictate comment"));

  // Text that the collapsed pill must show before the user types: the mention
  // chips (each rendered as "@name ") for a fresh draft, or the seeded content
  // when editing an existing comment.
  const collapsedContentText = useMemo(() => {
    if (contentParts) {
      return contentParts
        .map((part) => (part.type === "mention" ? `@${part.mention.name}` : part.text))
        .join("");
    }
    return mentions.map((m) => `@${m.name}`).join("");
  }, [contentParts, mentions]);

  // When pre-selected elements are too wide to fit the collapsed pill on one
  // line, open in the taller layout immediately. Text measurement gives a good
  // first-render guess; a layout pass after Lexical seeds mention chips catches
  // cases where fonts or chip layout differ from the hidden measurer.
  const textOverflows = useMemo(
    () => collapsedContentWouldOverflow(collapsedContentText),
    [collapsedContentText],
  );
  const [domOverflows, setDomOverflows] = useState(false);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (hasUserText || isDictating || textOverflows) {
      setDomOverflows(false);
      return;
    }
    const editor = popoverRef.current?.querySelector(".tuna-comment-editor");
    if (!(editor instanceof HTMLElement)) {
      setDomOverflows(false);
      return;
    }
    // Collapsed layout uses a single short row; chips can wrap or clip vertically
    // even when scrollWidth matches clientWidth.
    const overflows = editor.scrollWidth > editor.clientWidth + 1
      || editor.scrollHeight > editor.clientHeight + 1;
    setDomOverflows(overflows);
  }, [collapsedContentText, hasUserText, isDictating, mentions, textOverflows]);

  const popoverWidth = DEFAULT_POPOVER_WIDTH;
  const isExpanded = hasUserText || isDictating || textOverflows || domOverflows;

  useLayoutEffect(() => {
    const el = popoverRef.current;
    if (!el) return;
    setMeasuredHeight(el.offsetHeight);
  }, [isExpanded, collapsedContentText, hasUserText, isDictating, mentions, doc]);

  const popoverHeight = measuredHeight ?? (isExpanded ? 76 : 40);
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = position.x + 16;
  let top = position.y - 8;

  if (left + popoverWidth > vw - 12) {
    left = position.x - popoverWidth - 16;
  }
  if (left < 12) left = 12;

  if (top + popoverHeight > vh - 12) {
    top = position.y - popoverHeight - 8;
  }
  if (top < 12) top = 12;

  const style: CSSProperties = {
    position: "fixed",
    left,
    top,
    width: popoverWidth,
    zIndex: 2147483647,
  };

  const plainText = docToPlainText(doc);
  const deleteClick = usePointerClickHandlers(() => onDelete?.());
  const dictationCancelClick = usePointerClickHandlers(handleCancelDictation);
  const dictationConfirmClick = usePointerClickHandlers(() => {
    confirmDictation();
    requestAnimationFrame(() => editorRef.current?.focus());
  });
  const collapsedDictationClick = usePointerClickHandlers(() => {
    if (isDictating) {
      confirmDictation();
      requestAnimationFrame(() => editorRef.current?.focus());
    } else {
      handleStartDictation();
    }
  });
  const expandedDictationClick = usePointerClickHandlers(() => {
    if (isDictating) {
      confirmDictation();
      requestAnimationFrame(() => editorRef.current?.focus());
    } else {
      handleStartDictation();
    }
  });
  const sendClick = usePointerClickHandlers(handleSubmit);

  return (
    <div
      ref={popoverRef}
      className={`tuna-comment-popover${isExpanded ? " has-content" : ""}`}
      style={style}
      onPointerDownCapture={(e) => {
        if (e.button === 0 && isCloseButtonTarget(e.target)) {
          closePressRef.current = { x: e.clientX, y: e.clientY };
          return;
        }
        closePressRef.current = null;
        if (isPopoverButtonTarget(e.target)) return;
        e.stopPropagation();
      }}
      onPointerUpCapture={(e) => {
        if (e.button !== 0) return;
        const press = closePressRef.current;
        if (!press) return;
        if (!isCloseButtonTarget(e.target)) return;
        closePressRef.current = null;
        if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > POINTER_CLICK_MOVE_THRESHOLD_PX) return;
        e.preventDefault();
        e.stopPropagation();
        runCloseDismiss();
      }}
      onPointerCancelCapture={() => {
        closePressRef.current = null;
      }}
      onClickCapture={(e) => {
        if (isPopoverButtonTarget(e.target)) return;
        e.stopPropagation();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="tuna-comment-top-row">
        <button
          type="button"
          className="tuna-comment-close"
          aria-label="Close"
          title="Close"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            closePressRef.current = null;
            runCloseDismiss();
          }}
        >
          <IconCrossMedium size={14} />
        </button>
        <div
          ref={inputWrapRef}
          className="tuna-comment-input-wrap"
          onPointerDown={(e) => {
            editorRef.current?.focus();
            const target = e.target instanceof HTMLElement
              ? e.target
              : e.target instanceof Text
                ? e.target.parentElement
                : null;
            if (!target?.closest(".tuna-comment-editor")) {
              editorRef.current?.placeSelectionAtPoint(e.clientX, e.clientY);
            }
          }}
        >
          <CommentEditor
            ref={editorRef}
            initialText={initialText}
            mentions={mentions}
            contentParts={contentParts}
            targets={targets}
            onChange={handleEditorChange}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </div>

        {!isExpanded && (
          <div className="tuna-comment-pill-actions">
            <DictationButton
              className={`tuna-comment-circular-btn dictate-blue-circle${isTranscribing ? " transcribing" : isDictating ? " listening" : ""}`}
              isDictating={isDictating}
              title={dictationTitle}
              {...collapsedDictationClick}
            />
          </div>
        )}
      </div>

      {(isExpanded || isEdit) && (
        <div className={`tuna-comment-bottom-row${isEdit ? " has-edit-actions" : ""}`}>
          {isEdit && (
            <div className="tuna-comment-bottom-actions-left">
              <button
                type="button"
                className="tuna-comment-circular-btn delete"
                {...deleteClick}
                title="Delete comment"
              >
                <TrashIcon />
              </button>
            </div>
          )}

          {isExpanded && isDictating ? (
            <div className="tuna-comment-dictation-status">
              <AudioWaveform
                isDictating={isDictating}
                mediaStream={usesWhisperFallback ? visualizationStream : null}
                useSharedMicOnly={usesWhisperFallback}
              />
              <span className="tuna-comment-dictation-time">
                {formatTime(dictationSeconds)}
              </span>
            </div>
          ) : null}

          {isExpanded && (
          <div className="tuna-comment-bottom-actions-right">
            {isDictating ? (
              <>
                <button
                  type="button"
                  className="tuna-comment-circular-btn dictate-cancel"
                  {...dictationCancelClick}
                  title="Cancel dictation"
                >
                  <XIcon />
                </button>
                <button
                  type="button"
                  className="tuna-comment-circular-btn dictate-confirm"
                  {...dictationConfirmClick}
                  title="Confirm dictation"
                >
                  <CheckIcon />
                </button>
              </>
            ) : (
              <>
                <DictationButton
                  className={`tuna-comment-circular-btn dictate-icon-only${isTranscribing ? " transcribing" : isDictating ? " listening" : ""}`}
                  isDictating={isDictating}
                  title={dictationTitle}
                  {...expandedDictationClick}
                />

                <button
                  className="tuna-comment-circular-btn send"
                  {...sendClick}
                  disabled={!plainText.trim()}
                  title="Send comment"
                >
                  <SendIcon />
                </button>
              </>
            )}
          </div>
          )}
        </div>
      )}
    </div>
  );
}

function DictationButton({
  className,
  isDictating,
  title,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
}: {
  className: string;
  isDictating: boolean;
  title: string;
  onPointerDown: PointerEventHandler<HTMLButtonElement>;
  onPointerUp: PointerEventHandler<HTMLButtonElement>;
  onPointerCancel: () => void;
}) {
  return (
    <button
      type="button"
      className={className}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      title={title}
      aria-pressed={isDictating}
      aria-label={title}
    >
      <MicIcon />
    </button>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}
