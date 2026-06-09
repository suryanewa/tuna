import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEventHandler } from "react";
import type { Comment } from "../../engine/comment-store";
import { useCommentDictation } from "../use-comment-dictation";
import { AudioWaveform } from "./AudioWaveform";
import {
  CommentEditor,
  type CommentEditorApi,
  type CommentMention,
} from "./CommentEditor";
import {
  getCommentElementTargets,
  getMentionName,
  orderTargetsBySelectors,
  parseCommentTextIntoParts,
  SELECTION_COLORS,
} from "./comment-draft";

type DictationSnapshot = {
  text: string;
  mentionSelectors: string[];
};

export function CommentPopover({
  position,
  initialText,
  onSubmit,
  onCancel,
  onDelete,
  onTextChange,
  onMentionsChange,
  elementInfo,
  spanMentionCount,
  primarySelector,
}: {
  position: { x: number; y: number };
  initialText: string;
  onSubmit: (text: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onTextChange?: (text: string) => void;
  onMentionsChange?: (selectors: string[]) => void;
  elementInfo?: Comment["elementInfo"];
  /** Elements shown as colored @ spans before the input (frozen at draft open). */
  spanMentionCount?: number;
  /** Selector for single-element drafts without selectedElements. */
  primarySelector?: string;
}) {
  const [text, setText] = useState(initialText);
  const [hasUserText, setHasUserText] = useState(!!initialText.trim());
  const [dictationSeconds, setDictationSeconds] = useState(0);
  const editorRef = useRef<CommentEditorApi>(null);
  const dictationSnapshotRef = useRef<DictationSnapshot>({ text: "", mentionSelectors: [] });
  const isEdit = !!onDelete;

  const contentParts = useMemo(() => {
    if (!isEdit || !elementInfo) return undefined;
    const targets = getCommentElementTargets(elementInfo, primarySelector);
    return parseCommentTextIntoParts(initialText, targets);
  }, [elementInfo, initialText, isEdit, primarySelector]);

  const mentions = useMemo<CommentMention[]>(() => {
    if (contentParts) return [];
    if (!elementInfo) return [];
    const spanCount = spanMentionCount ?? 1;
    if (elementInfo.selectedElements) {
      return elementInfo.selectedElements.slice(0, spanCount).map((target, idx) => ({
        name: getMentionName(target.tagName, target.componentName),
        color: SELECTION_COLORS[idx % SELECTION_COLORS.length],
        selector: target.selector,
      }));
    }
    return [{
      name: getMentionName(elementInfo.tagName, elementInfo.componentName),
      color: SELECTION_COLORS[0],
      selector: primarySelector ?? "",
    }];
  }, [contentParts, elementInfo, primarySelector, spanMentionCount]);

  const handleEditorChange = useCallback((snapshot: { text: string; userText: string; mentionSelectors: string[] }) => {
    setText(snapshot.text);
    setHasUserText(snapshot.userText.trim().length > 0);
    onTextChange?.(snapshot.text);
    onMentionsChange?.(snapshot.mentionSelectors);
  }, [onMentionsChange, onTextChange]);

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
    dictationSnapshotRef.current = {
      text: editorRef.current?.getText() ?? "",
      mentionSelectors: editorRef.current?.getMentions() ?? [],
    };
    toggleDictation();
  }, [toggleDictation]);

  const handleCancelDictation = useCallback(() => {
    const snapshot = dictationSnapshotRef.current;
    cancelDictation();
    const targets = getCommentElementTargets(elementInfo, primarySelector);
    const orderedTargets = orderTargetsBySelectors(targets, snapshot.mentionSelectors);
    const restoredParts = parseCommentTextIntoParts(snapshot.text, orderedTargets);
    editorRef.current?.restoreContent(snapshot.text, orderedTargets);
    onMentionsChange?.(snapshot.mentionSelectors);
    onTextChange?.(snapshot.text);
    const restoredUserText = restoredParts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("")
      .trim();
    setText(snapshot.text);
    setHasUserText(restoredUserText.length > 0);
    editorRef.current?.focus();
  }, [cancelDictation, elementInfo, onMentionsChange, onTextChange, primarySelector]);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }, [onSubmit, text]);

  const handleCancel = useCallback(() => {
    if (isDictating) {
      handleCancelDictation();
      return;
    }
    onCancel();
  }, [handleCancelDictation, isDictating, onCancel]);

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

  const popoverWidth = 360;
  const isExpanded = hasUserText || isDictating;
  const popoverHeight = isExpanded ? 76 : 40;
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
    zIndex: 2147483647,
  };

  return (
    <div
      className={`retune-comment-popover${isExpanded ? " has-content" : ""}`}
      style={style}
      onPointerDownCapture={(e) => e.stopPropagation()}
      onClickCapture={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="retune-comment-top-row">
        <div
          className="retune-comment-input-wrap"
          onPointerDown={() => editorRef.current?.focus()}
        >
          <CommentEditor
            ref={editorRef}
            initialText={initialText}
            mentions={mentions}
            contentParts={contentParts}
            onChange={handleEditorChange}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </div>

        {!isExpanded && (
          <div className="retune-comment-pill-actions">
            {isEdit && (
              <button
                className="retune-comment-circular-btn delete"
                onPointerUp={onDelete}
                title="Delete comment"
              >
                <TrashIcon />
              </button>
            )}

            <DictationButton
              className={`retune-comment-circular-btn dictate-blue-circle${isTranscribing ? " transcribing" : isDictating ? " listening" : ""}`}
              isDictating={isDictating}
              title={dictationTitle}
              onPointerUp={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isDictating) {
                  confirmDictation();
                } else {
                  handleStartDictation();
                }
              }}
            />
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="retune-comment-bottom-row">
          {isDictating ? (
            <div className="retune-comment-dictation-status">
              <AudioWaveform
                isDictating={isDictating}
                mediaStream={usesWhisperFallback ? visualizationStream : null}
                useSharedMicOnly={usesWhisperFallback}
              />
              <span className="retune-comment-dictation-time">
                {formatTime(dictationSeconds)}
              </span>
            </div>
          ) : null}

          <div className="retune-comment-bottom-actions-right">
            {isDictating ? (
              <>
                <button
                  type="button"
                  className="retune-comment-circular-btn dictate-cancel"
                  onPointerUp={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCancelDictation();
                  }}
                  title="Cancel dictation"
                >
                  <XIcon />
                </button>
                <button
                  type="button"
                  className="retune-comment-circular-btn dictate-confirm"
                  onPointerUp={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    confirmDictation();
                  }}
                  title="Confirm dictation"
                >
                  <CheckIcon />
                </button>
              </>
            ) : (
              <>
                {isEdit && (
                  <button
                    className="retune-comment-circular-btn delete"
                    onPointerUp={onDelete}
                    title="Delete comment"
                  >
                    <TrashIcon />
                  </button>
                )}

                <DictationButton
                  className={`retune-comment-circular-btn dictate-icon-only${isTranscribing ? " transcribing" : isDictating ? " listening" : ""}`}
                  isDictating={isDictating}
                  title={dictationTitle}
                  onPointerUp={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isDictating) {
                      confirmDictation();
                    } else {
                      handleStartDictation();
                    }
                  }}
                />

                <button
                  className="retune-comment-circular-btn send"
                  onPointerUp={handleSubmit}
                  disabled={!text.trim()}
                  title="Send comment"
                >
                  <SendIcon />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DictationButton({
  className,
  isDictating,
  title,
  onPointerUp,
}: {
  className: string;
  isDictating: boolean;
  title: string;
  onPointerUp: PointerEventHandler<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      className={className}
      onPointerUp={onPointerUp}
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
      <path d="M8 6V4c0-1 1-2 2-2h8c1 0 2 1 2 2v2" />
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
