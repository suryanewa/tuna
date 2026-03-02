"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useYjsEditor } from "./YjsEditorContext";
import {
  useEditingElementId,
  useEditorMutations,
  useSelectedIds,
  usePanelTab,
  useViewMode,
  useDevice,
  useIsAdmin,
} from "./context";
import { useTiptapEditor } from "./tiptap/TiptapProvider";
import {
  useTiptapSelectionStyles,
  cssFontSizeToDisplay,
  displayFontSizeToCss,
  cssLetterSpacingToDisplay,
  displayLetterSpacingToCss,
  cssFontWeightToDisplay,
  displayFontWeightToCss,
} from "./tiptap/tiptap-utils";
import { useCamera } from "./CameraContext";
import { zoomAtPoint } from "./camera-utils";
import { type TailwindStyles, getEffectiveStyles } from "@/lib/playground/editor-types";
import { ARTBOARD_LAYER_ID, type CanvasElement, type PageStyles, type Page } from "@/lib/playground/store";
import type { GradientFill } from "./ui/color-input";
import {
  EyeSmall,
  HiddenSmall,
  ShieldSmall,
  Rotation,
  Rotate,
  FlipHorizontalSmall,
  FlipVertical,
  LayoutAlignLeft,
  LayoutAlignHorizontalCenter,
  LayoutAlignRight,
  LayoutAlignTop,
  LayoutAlignVerticalCenter,
  LayoutAlignBottom,
} from "@/components/icons/editor";
import { ButtonGroup, type ButtonGroupItem } from "./ui/button-group";
import { IconButton } from "./ui/icon-button";
import { NumberInput } from "./ui/number-input";
import { SectionWrapper, SectionBody, SectionRow } from "./sections-v2/section-wrapper";
import { SectionHeader } from "./ui/section-header";
import {
  LayoutSection,
  SizeSection,
  PositionSection,
  TypographySection,
  AppearanceSection,
  FillSection,
  BorderSection,
  ShadowSection,
  FilterSection,
  LinkSection,
  ImageSection,
  VideoSection,
  GifSection,
  HeaderSection,
  type PanelTab,
  type SpacingMode,
  type SpacingSide,
  type AlignmentPosition,
  type FlowDirection,
  type BlendMode,
  type OverflowValue,
  type PositionType,
  type PinState,
  type StickyEdge,
  type TextAlignment,
  type VerticalAlignment,
  type ShadowValue,
  type BorderValue,
  type FillItem,
  type FilterItem,
  type LinkValue,
} from "./sections-v2";
import { UnifiedAnimationSection } from "./sections-v2/animation-section";
import { ShaderConfigSection } from "./sections-v2/shader-config-section";
import { ShaderLayerSection } from "./sections-v2/shader-layer-section";
import {
  // Layout
  readDirection, writeDirection,
  readAlignment, writeAlignment,
  readSpaceBetween, writeSpaceBetween,
  readGap, writeGap,
  readPaddingMode, readPaddingValues, writePadding,
  readMarginMode, readMarginValues, writeMargin,
  // Size
  readSize, writeWidth, writeHeight, writeMinWidth, writeMinHeight, writeMaxWidth, writeMaxHeight,
  // Position
  readPositionType, writePositionType,
  readConstraint, writeConstraint,
  readPins,
  readRotation, writeRotation,
  readFlipHorizontal, writeFlipHorizontal,
  readFlipVertical, writeFlipVertical,
  readStickyEdge, readStickyValue,
  // Typography
  readFontFamily, writeFontFamily,
  readFontWeight, writeFontWeight, getFontWeightOptions,
  readFontSize, writeFontSize,
  readLineHeight, writeLineHeight,
  readLetterSpacing, writeLetterSpacing,
  readTextAlign, writeTextAlign,
  readVerticalAlign, writeVerticalAlign,
  readTextDecoration, writeTextDecoration,
  readFontStyle, writeFontStyle,
  readTextTransform, writeTextTransform,
  readTextWrap, writeTextWrap,
  readListStyleType, writeListStyleType,
  readLineClamp, writeLineClamp,
  // Appearance
  readOpacity, writeOpacity,
  readBlendMode, writeBlendMode,
  readZIndex, writeZIndex,
  readCornerRadius, writeCornerRadius,
  readIndividualCornerRadius, writeIndividualCornerRadius,
  readOverflow, writeOverflow,
  readOverflowAxis, writeOverflowAxis,
  // Fill
  readFills, writeFills,
  readTextFills, writeTextFills,
  // Border
  readBorder, writeBorder,
  // Shadow
  readShadow, writeShadow,
  // Filter
  readFilters, writeFilters,
  // Page converter
  pageStylesToTailwind, applyTailwindToPageStyles,
  type TextDecorationValue,
} from "./adapters";
import { getWeightsForFont, hasItalicForFont } from "./font-picker/font-weights";

// ============================================================================
// Element type helpers
// ============================================================================

const TEXT_ELEMENTS = new Set(["heading", "text", "button", "badge"]);
const CONTAINER_ELEMENTS = new Set(["container"]);

function isTextElement(type: string) {
  return TEXT_ELEMENTS.has(type);
}

function isContainerElement(type: string) {
  return CONTAINER_ELEMENTS.has(type);
}

function showSection(elementType: string) {
  const isText = isTextElement(elementType);
  const isContainer = isContainerElement(elementType);
  const isDivider = elementType === "divider";
  const isShape = ['rectangle', 'circle', 'star'].includes(elementType);
  const isComponent = elementType === "component";
  const isShader = elementType === "shader";

  return {
    layout: isContainer,
    size: true,
    position: true,
    typography: isText && !isComponent,
    appearance: true,
    fill: !isDivider && !isText && !isShader,
    shaderLayers: !isDivider && !isShader,
    border: true,
    shadow: !isDivider,
    filter: !isDivider,
    link: !isDivider && !isShape && !isComponent && !isShader,
    image: elementType === "image",
    video: elementType === "video",
    gif: elementType === "gif",
    shader: isShader,
    interactions: !isDivider && !isShader,
  };
}

// ============================================================================
// Bridge Components — Element (TailwindStyles)
// ============================================================================

interface BridgeProps {
  styles: TailwindStyles;
  onUpdate: (updates: Partial<TailwindStyles>) => void;
  disabled?: boolean;
}

function LayoutBridge({ styles, onUpdate, disabled }: BridgeProps) {
  const [paddingMode, setPaddingMode] = useState<SpacingMode>(() => readPaddingMode(styles));
  const [marginMode, setMarginMode] = useState<SpacingMode>(() => readMarginMode(styles));

  const padValues = readPaddingValues(styles);
  const marValues = readMarginValues(styles);

  return (
    <LayoutSection
      direction={readDirection(styles)}
      onDirectionChange={(d) => onUpdate(writeDirection(d))}
      alignment={readAlignment(styles, readDirection(styles))}
      onAlignmentChange={(a) => {
        const update = writeAlignment(a, readDirection(styles));
        if (readSpaceBetween(styles)) {
          // In space-between mode, only update cross-axis (alignItems), preserve justify-between
          onUpdate({ alignItems: update.alignItems });
        } else {
          onUpdate(update);
        }
      }}
      spaceBetween={readSpaceBetween(styles)}
      onSpaceBetweenChange={(sb) => onUpdate(writeSpaceBetween(sb))}
      gap={readGap(styles)}
      onGapChange={(v) => onUpdate(writeGap(v))}
      paddingMode={paddingMode}
      paddingX={padValues.paddingX}
      paddingY={padValues.paddingY}
      paddingTop={padValues.paddingTop}
      paddingRight={padValues.paddingRight}
      paddingBottom={padValues.paddingBottom}
      paddingLeft={padValues.paddingLeft}
      onPaddingModeChange={(newMode) => {
        if (newMode === "individual" && paddingMode === "xy") {
          // Carry XY values to individual sides
          onUpdate({
            ...writePadding("top", padValues.paddingTop, "individual"),
            ...writePadding("right", padValues.paddingRight, "individual"),
            ...writePadding("bottom", padValues.paddingBottom, "individual"),
            ...writePadding("left", padValues.paddingLeft, "individual"),
            paddingX: undefined, paddingY: undefined, padding: undefined,
          });
        } else if (newMode === "xy" && paddingMode === "individual") {
          // Carry individual values — if sides match, collapse to axis
          const patch: Partial<TailwindStyles> = {
            paddingTop: undefined, paddingRight: undefined,
            paddingBottom: undefined, paddingLeft: undefined,
          };
          if (padValues.paddingLeft === padValues.paddingRight) {
            Object.assign(patch, writePadding("x", padValues.paddingLeft, "xy"));
          }
          if (padValues.paddingTop === padValues.paddingBottom) {
            Object.assign(patch, writePadding("y", padValues.paddingTop, "xy"));
          }
          // If sides don't match, keep individual values for comma display
          if (padValues.paddingLeft !== padValues.paddingRight) {
            delete patch.paddingLeft; delete patch.paddingRight;
          }
          if (padValues.paddingTop !== padValues.paddingBottom) {
            delete patch.paddingTop; delete patch.paddingBottom;
          }
          onUpdate(patch);
        }
        setPaddingMode(newMode);
      }}
      onPaddingChange={(side, value) => onUpdate(writePadding(side, value, paddingMode))}
      onPaddingCommaChange={(axis, v1, v2) => {
        if (axis === "x") {
          onUpdate({
            ...writePadding("left", v1, "individual"),
            ...writePadding("right", v2, "individual"),
            paddingX: undefined, padding: undefined,
          });
        } else {
          onUpdate({
            ...writePadding("top", v1, "individual"),
            ...writePadding("bottom", v2, "individual"),
            paddingY: undefined, padding: undefined,
          });
        }
      }}
      marginMode={marginMode}
      marginX={marValues.marginX}
      marginY={marValues.marginY}
      marginTop={marValues.marginTop}
      marginRight={marValues.marginRight}
      marginBottom={marValues.marginBottom}
      marginLeft={marValues.marginLeft}
      onMarginModeChange={(newMode) => {
        if (newMode === "individual" && marginMode === "xy") {
          onUpdate({
            ...writeMargin("top", marValues.marginTop, "individual"),
            ...writeMargin("right", marValues.marginRight, "individual"),
            ...writeMargin("bottom", marValues.marginBottom, "individual"),
            ...writeMargin("left", marValues.marginLeft, "individual"),
            marginX: undefined, marginY: undefined, margin: undefined,
          });
        } else if (newMode === "xy" && marginMode === "individual") {
          const patch: Partial<TailwindStyles> = {
            marginTop: undefined, marginRight: undefined,
            marginBottom: undefined, marginLeft: undefined,
          };
          if (marValues.marginLeft === marValues.marginRight) {
            Object.assign(patch, writeMargin("x", marValues.marginLeft, "xy"));
          }
          if (marValues.marginTop === marValues.marginBottom) {
            Object.assign(patch, writeMargin("y", marValues.marginTop, "xy"));
          }
          if (marValues.marginLeft !== marValues.marginRight) {
            delete patch.marginLeft; delete patch.marginRight;
          }
          if (marValues.marginTop !== marValues.marginBottom) {
            delete patch.marginTop; delete patch.marginBottom;
          }
          onUpdate(patch);
        }
        setMarginMode(newMode);
      }}
      onMarginChange={(side, value) => onUpdate(writeMargin(side, value, marginMode))}
      onMarginCommaChange={(axis, v1, v2) => {
        if (axis === "x") {
          onUpdate({
            ...writeMargin("left", v1, "individual"),
            ...writeMargin("right", v2, "individual"),
            marginX: undefined, margin: undefined,
          });
        } else {
          onUpdate({
            ...writeMargin("top", v1, "individual"),
            ...writeMargin("bottom", v2, "individual"),
            marginY: undefined, margin: undefined,
          });
        }
      }}
      disabled={disabled}
    />
  );
}

function SizeBridge({ styles, onUpdate, disabled }: BridgeProps) {
  const size = readSize(styles);
  const [showMinSize, setShowMinSize] = useState(() => !!(size.minWidth || size.minHeight));
  const [showMaxSize, setShowMaxSize] = useState(() => !!(size.maxWidth || size.maxHeight));

  return (
    <SizeSection
      width={size.width}
      onWidthChange={(v) => onUpdate(writeWidth(v))}
      height={size.height}
      onHeightChange={(v) => onUpdate(writeHeight(v))}
      showMinSize={showMinSize}
      onShowMinSizeChange={setShowMinSize}
      minWidth={size.minWidth}
      onMinWidthChange={(v) => onUpdate(writeMinWidth(v))}
      minHeight={size.minHeight}
      onMinHeightChange={(v) => onUpdate(writeMinHeight(v))}
      showMaxSize={showMaxSize}
      onShowMaxSizeChange={setShowMaxSize}
      maxWidth={size.maxWidth}
      onMaxWidthChange={(v) => onUpdate(writeMaxWidth(v))}
      maxHeight={size.maxHeight}
      onMaxHeightChange={(v) => onUpdate(writeMaxHeight(v))}
      disabled={disabled}
    />
  );
}

function PositionBridge({ styles, onUpdate, disabled }: BridgeProps) {
  const rotation = readRotation(styles);
  const posType = readPositionType(styles);
  const isPositioned = posType === "absolute" || posType === "fixed";

  // Centered = 50% offset + translate -50% (works regardless of parent size)
  const isCenteredH = styles.left === "left-[50%]" && styles.translateX === "-translate-x-1/2";
  const isCenteredV = styles.top === "top-[50%]" && styles.translateY === "-translate-y-1/2";
  const isCentered = isCenteredH && isCenteredV;

  const centerHStyles: Partial<TailwindStyles> = {
    left: "left-[50%]",
    right: undefined,
    translateX: "-translate-x-1/2",
  };

  const centerVStyles: Partial<TailwindStyles> = {
    top: "top-[50%]",
    bottom: undefined,
    translateY: "-translate-y-1/2",
  };

  const clearCenterStyles: Partial<TailwindStyles> = {
    translateX: undefined,
    translateY: undefined,
  };

  return (
    <PositionSection
      positionType={posType}
      onPositionTypeChange={(t) => onUpdate(writePositionType(t))}
      top={readConstraint(styles, "top") ?? 0}
      right={readConstraint(styles, "right") ?? 0}
      bottom={readConstraint(styles, "bottom") ?? 0}
      left={readConstraint(styles, "left") ?? 0}
      onConstraintChange={(side, value) => onUpdate(writeConstraint(side, value))}
      pins={readPins(styles)}
      onPinChange={(side, pinned) => {
        if (pinned) {
          onUpdate({ ...writeConstraint(side, 0), ...clearCenterStyles });
        } else {
          onUpdate({ ...writeConstraint(side, undefined), ...clearCenterStyles });
        }
      }}
      centered={isCentered}
      onCenterChange={(centered) => {
        if (centered) {
          onUpdate({
            ...centerHStyles,
            ...centerVStyles,
          });
        } else {
          onUpdate({
            ...writeConstraint("top", undefined),
            ...writeConstraint("right", undefined),
            ...writeConstraint("bottom", undefined),
            ...writeConstraint("left", undefined),
            ...clearCenterStyles,
          });
        }
      }}
      stickyEdge={readStickyEdge(styles)}
      stickyValue={readStickyValue(styles)}
      onStickyEdgeChange={(edge) => {
        const val = readStickyValue(styles);
        onUpdate({
          ...writeConstraint("top", undefined),
          ...writeConstraint("right", undefined),
          ...writeConstraint("bottom", undefined),
          ...writeConstraint("left", undefined),
          ...writeConstraint(edge, val),
        });
      }}
      onStickyValueChange={(value) => {
        const edge = readStickyEdge(styles);
        onUpdate(writeConstraint(edge, value));
      }}
      rotation={rotation}
      onRotationChange={(v) => onUpdate(writeRotation(v))}
      onRotate90={() => onUpdate(writeRotation((rotation + 90) % 360))}
      onFlipHorizontal={() => onUpdate(writeFlipHorizontal(!readFlipHorizontal(styles)))}
      onFlipVertical={() => onUpdate(writeFlipVertical(!readFlipVertical(styles)))}
      alignmentEnabled={isPositioned}
      onAlignLeft={() => onUpdate({ ...writeConstraint("left", 0), ...writeConstraint("right", undefined), translateX: undefined })}
      onAlignCenterH={() => onUpdate({ ...centerHStyles })}
      onAlignRight={() => onUpdate({ ...writeConstraint("right", 0), ...writeConstraint("left", undefined), translateX: undefined })}
      onAlignTop={() => onUpdate({ ...writeConstraint("top", 0), ...writeConstraint("bottom", undefined), translateY: undefined })}
      onAlignCenterV={() => onUpdate({ ...centerVStyles })}
      onAlignBottom={() => onUpdate({ ...writeConstraint("bottom", 0), ...writeConstraint("top", undefined), translateY: undefined })}
      disabled={disabled}
    />
  );
}

function TypographyBridge({ styles, onUpdate, disabled }: BridgeProps) {
  const editingElementId = useEditingElementId();
  const editor = useTiptapEditor();
  const selStyles = useTiptapSelectionStyles(editor);
  const isInlineMode = editingElementId != null && editor != null && selStyles != null;

  // --- Inline property readers (Tiptap selection → display values) ---
  const fontFamily = isInlineMode
    ? (selStyles.fontFamily?.split(",")[0]?.trim() ?? readFontFamily(styles))
    : readFontFamily(styles);

  const fontWeight = isInlineMode
    ? (selStyles.isBold ? "700" : cssFontWeightToDisplay(selStyles.fontWeight) ?? readFontWeight(styles))
    : readFontWeight(styles);

  const fontSize = isInlineMode
    ? (cssFontSizeToDisplay(selStyles.fontSize) ?? readFontSize(styles))
    : readFontSize(styles);

  const letterSpacing = isInlineMode
    ? (cssLetterSpacingToDisplay(selStyles.letterSpacing) ?? readLetterSpacing(styles))
    : readLetterSpacing(styles);

  const textDecoration: TextDecorationValue = isInlineMode
    ? (selStyles.isUnderline ? "underline" : selStyles.isStrike ? "line-through" : "none")
    : readTextDecoration(styles);

  const fontStyle = isInlineMode
    ? (selStyles.isItalic ? "italic" as const : "normal" as const)
    : readFontStyle(styles);

  const textFills = readTextFills(styles);
  const textFill = textFills.length > 0 ? textFills[0] : null;
  const elementTextColor = textFill?.color ?? "#000000";
  const elementTextColorOpacity = textFill?.opacity ?? 100;
  const textColor = isInlineMode ? (selStyles.color ?? elementTextColor) : elementTextColor;
  const textColorOpacity = isInlineMode ? 100 : elementTextColorOpacity;

  const supportedWeights = useMemo(() => getWeightsForFont(fontFamily), [fontFamily]);
  const hasItalic = useMemo(() => hasItalicForFont(fontFamily), [fontFamily]);

  // --- Inline property writers ---
  const handleFontFamilyChange = (v: string) => {
    const newWeights = getWeightsForFont(v);
    const currentWeight = parseInt(fontWeight) || 400;
    const needsWeightCorrection = newWeights.length > 0 && !newWeights.includes(currentWeight);
    const nearestWeight = needsWeightCorrection
      ? newWeights.reduce((a, b) => (Math.abs(b - currentWeight) < Math.abs(a - currentWeight) ? b : a))
      : currentWeight;
    const needsItalicReset = fontStyle === "italic" && !hasItalicForFont(v);

    if (isInlineMode) {
      let chain = editor.chain().focus().setFontFamily(v || "");
      if (needsWeightCorrection) {
        chain = chain.setMark("textStyle", { fontWeight: displayFontWeightToCss(String(nearestWeight)) });
      }
      if (needsItalicReset) {
        chain = chain.unsetItalic();
      }
      chain.run();
    } else {
      onUpdate(writeFontFamily(v));
      if (needsWeightCorrection) {
        onUpdate(writeFontWeight(String(nearestWeight)));
      }
      if (needsItalicReset) {
        onUpdate(writeFontStyle("normal"));
      }
    }
  };

  const handleFontStyleChange = (v: "normal" | "italic") => {
    if (isInlineMode) {
      editor.chain().focus().toggleItalic().run();
    } else {
      onUpdate(writeFontStyle(v));
    }
  };

  const handleFontWeightChange = (v: string) => {
    if (isInlineMode) {
      if (selStyles.isBold) editor.chain().focus().unsetBold().run();
      editor.chain().focus().setMark("textStyle", { fontWeight: displayFontWeightToCss(v) }).run();
    } else {
      onUpdate(writeFontWeight(v));
    }
  };

  const handleFontSizeChange = (v: string) => {
    if (isInlineMode) {
      const css = displayFontSizeToCss(v);
      editor.chain().focus().setMark("textStyle", { fontSize: css }).run();
    } else {
      onUpdate(writeFontSize(v));
    }
  };

  const handleLetterSpacingChange = (v: string) => {
    if (isInlineMode) {
      const css = displayLetterSpacingToCss(v);
      editor.chain().focus().setMark("textStyle", { letterSpacing: css }).run();
    } else {
      onUpdate(writeLetterSpacing(v));
    }
  };

  const handleTextDecorationChange = (v: TextDecorationValue) => {
    if (isInlineMode) {
      const wantUnderline = v?.includes("underline") ?? false;
      const wantStrike = v?.includes("line-through") ?? false;
      if (wantUnderline !== selStyles.isUnderline) editor.chain().focus().toggleUnderline().run();
      if (wantStrike !== selStyles.isStrike) editor.chain().focus().toggleStrike().run();
    } else {
      onUpdate(writeTextDecoration(v));
    }
  };

  const handleTextColorChange = (color: string) => {
    if (isInlineMode) {
      editor.chain().focus().setColor(color).run();
    } else {
      onUpdate(writeTextFills([{ id: "fill-text-0", color, opacity: textColorOpacity, visible: true }]));
    }
  };

  const handleTextColorOpacityChange = (opacity: number) => {
    // Opacity is always element-level (Tiptap Color extension doesn't support opacity)
    onUpdate(writeTextFills([{ id: "fill-text-0", color: elementTextColor, opacity, visible: true }]));
  };

  const handleTextGradientChange = (gradient: GradientFill | undefined) => {
    onUpdate(writeTextFills([{ id: "fill-text-0", color: elementTextColor, opacity: elementTextColorOpacity, visible: true, gradient }]));
  };

  return (
    <TypographySection
      fontFamily={fontFamily}
      onFontFamilyChange={handleFontFamilyChange}
      fontWeight={fontWeight}
      onFontWeightChange={handleFontWeightChange}
      fontWeightOptions={getFontWeightOptions(supportedWeights)}
      fontSize={fontSize}
      onFontSizeChange={handleFontSizeChange}
      lineHeight={readLineHeight(styles)}
      onLineHeightChange={(v) => onUpdate(writeLineHeight(v))}
      letterSpacing={letterSpacing}
      onLetterSpacingChange={handleLetterSpacingChange}
      textAlign={readTextAlign(styles)}
      onTextAlignChange={(v) => onUpdate(writeTextAlign(v))}
      verticalAlign={readVerticalAlign(styles)}
      onVerticalAlignChange={(v) => onUpdate(writeVerticalAlign(v))}
      textDecoration={textDecoration}
      onTextDecorationChange={handleTextDecorationChange}
      fontStyle={fontStyle}
      onFontStyleChange={handleFontStyleChange}
      hasItalic={hasItalic}
      textTransform={readTextTransform(styles)}
      onTextTransformChange={(v) => onUpdate(writeTextTransform(v))}
      textWrap={readTextWrap(styles)}
      onTextWrapChange={(v) => onUpdate(writeTextWrap(v))}
      listStyle={readListStyleType(styles)}
      onListStyleChange={(v) => onUpdate(writeListStyleType(v))}
      truncation={readLineClamp(styles) !== undefined}
      onTruncationChange={(on) => onUpdate(writeLineClamp(on ? 3 : undefined))}
      maxLines={readLineClamp(styles)}
      onMaxLinesChange={(n) => onUpdate(writeLineClamp(n))}
      textColor={textColor}
      onTextColorChange={handleTextColorChange}
      textColorOpacity={textColorOpacity}
      onTextColorOpacityChange={handleTextColorOpacityChange}
      textGradient={textFill?.gradient}
      onTextGradientChange={handleTextGradientChange}
      disabled={disabled}
    />
  );
}

function AppearanceBridge({ styles, onUpdate, disabled, elementType }: BridgeProps & { elementType?: string }) {
  const [showIndividualCorners, setShowIndividualCorners] = useState(false);
  const [showIndividualOverflow, setShowIndividualOverflow] = useState(false);

  return (
    <AppearanceSection
      opacity={readOpacity(styles)}
      onOpacityChange={(v) => onUpdate(writeOpacity(v))}
      blendMode={readBlendMode(styles)}
      onBlendModeChange={(v) => onUpdate(writeBlendMode(v))}
      zIndex={readZIndex(styles)}
      onZIndexChange={(v) => onUpdate(writeZIndex(v))}
      cornerRadius={readCornerRadius(styles)}
      onCornerRadiusChange={(v) => onUpdate(writeCornerRadius(v))}
      showIndividualCorners={showIndividualCorners}
      onShowIndividualCornersChange={setShowIndividualCorners}
      cornerRadiusTopLeft={readIndividualCornerRadius(styles, "TopLeft")}
      onCornerRadiusTopLeftChange={(v) => onUpdate(writeIndividualCornerRadius("TopLeft", v))}
      cornerRadiusTopRight={readIndividualCornerRadius(styles, "TopRight")}
      onCornerRadiusTopRightChange={(v) => onUpdate(writeIndividualCornerRadius("TopRight", v))}
      cornerRadiusBottomLeft={readIndividualCornerRadius(styles, "BottomLeft")}
      onCornerRadiusBottomLeftChange={(v) => onUpdate(writeIndividualCornerRadius("BottomLeft", v))}
      cornerRadiusBottomRight={readIndividualCornerRadius(styles, "BottomRight")}
      onCornerRadiusBottomRightChange={(v) => onUpdate(writeIndividualCornerRadius("BottomRight", v))}
      overflow={readOverflow(styles)}
      onOverflowChange={(v) => onUpdate(writeOverflow(v))}
      showIndividualOverflow={showIndividualOverflow}
      onShowIndividualOverflowChange={setShowIndividualOverflow}
      overflowX={readOverflowAxis(styles, "X")}
      onOverflowXChange={(v) => onUpdate(writeOverflowAxis("X", v))}
      overflowY={readOverflowAxis(styles, "Y")}
      onOverflowYChange={(v) => onUpdate(writeOverflowAxis("Y", v))}
      cornerRadiusDisabled={elementType ? isTextElement(elementType) : false}
      disabled={disabled}
    />
  );
}

function FillBridge({ styles, onUpdate, disabled, elementType }: BridgeProps & { elementType?: string }) {
  const isText = elementType ? isTextElement(elementType) : false;
  return (
    <FillSection
      fills={isText ? readTextFills(styles) : readFills(styles)}
      onFillsChange={(fills) => onUpdate(isText ? writeTextFills(fills) : writeFills(fills))}
      disabled={disabled}
    />
  );
}

function BorderBridge({ styles, onUpdate, disabled }: BridgeProps) {
  return (
    <BorderSection
      border={readBorder(styles)}
      onBorderChange={(b) => onUpdate(writeBorder(b))}
      disabled={disabled}
    />
  );
}

function ShadowBridge({ styles, onUpdate, disabled }: BridgeProps) {
  return (
    <ShadowSection
      shadow={readShadow(styles)}
      onShadowChange={(s) => onUpdate(writeShadow(s))}
      disabled={disabled}
    />
  );
}

function FilterBridge({ styles, onUpdate, disabled }: BridgeProps) {
  return (
    <FilterSection
      filters={readFilters(styles)}
      onFiltersChange={(f) => onUpdate(writeFilters(f))}
      disabled={disabled}
    />
  );
}

function LinkBridge({ element, onLinkChange, disabled, pages, activePageId }: {
  element: CanvasElement;
  onLinkChange: (link: LinkValue | null) => void;
  disabled?: boolean;
  pages: Page[];
  activePageId: string;
}) {
  const editingElementId = useEditingElementId();
  const editor = useTiptapEditor();
  const selStyles = useTiptapSelectionStyles(editor);
  const isInlineMode = editingElementId != null && editor != null && selStyles != null;

  const link: LinkValue | null = isInlineMode
    ? (selStyles.link ? { url: selStyles.link.href, target: (selStyles.link.target as "_self" | "_blank") || "_blank" } : null)
    : (element.link ?? null);

  const handleLinkChange = (newLink: LinkValue | null) => {
    if (isInlineMode) {
      // Don't use .focus() — that steals focus from the panel's URL input.
      // ProseMirror maintains selection internally, so marks apply correctly.
      if (newLink) {
        editor.chain().setLink({ href: newLink.url, target: newLink.target }).run();
      } else {
        editor.chain().unsetLink().run();
      }
    } else {
      onLinkChange(newLink);
    }
  };

  return (
    <LinkSection
      link={link}
      onLinkChange={handleLinkChange}
      pages={pages}
      currentPageId={activePageId}
      disabled={disabled}
    />
  );
}

function ImageBridge({ element, onElementUpdate, styles, onStylesUpdate, disabled, urlDisabled }: {
  element: CanvasElement;
  onElementUpdate: (updates: Partial<CanvasElement>) => void;
  styles: TailwindStyles;
  onStylesUpdate: (updates: Partial<TailwindStyles>) => void;
  disabled?: boolean;
  urlDisabled?: boolean;
}) {
  const isVideo = !!element.content?.match(/\.(mp4|mov|webm|ogg)$/i);
  return (
    <ImageSection
      url={element.content || ""}
      onUrlChange={() => {}}
      onUrlBlur={(url) => onElementUpdate({ content: url })}
      fit={styles.objectFit || "object-cover"}
      onFitChange={(fit) => onStylesUpdate({ objectFit: fit })}
      position={styles.objectPosition || "object-center"}
      onPositionChange={(pos) => onStylesUpdate({ objectPosition: pos })}
      alt={element.alt || ""}
      onAltChange={(alt) => onElementUpdate({ alt })}
      isVideo={isVideo}
      urlDisabled={urlDisabled}
      disabled={disabled}
    />
  );
}

function VideoBridge({ element, onElementUpdate, styles, onStylesUpdate, disabled, urlDisabled }: {
  element: CanvasElement;
  onElementUpdate: (updates: Partial<CanvasElement>) => void;
  styles: TailwindStyles;
  onStylesUpdate: (updates: Partial<TailwindStyles>) => void;
  disabled?: boolean;
  urlDisabled?: boolean;
}) {
  return (
    <VideoSection
      url={element.content || ""}
      onUrlChange={() => {}}
      onUrlBlur={(url) => onElementUpdate({ content: url })}
      autoplay={element.videoAutoplay ?? true}
      onAutoplayChange={(v) => onElementUpdate({ videoAutoplay: v })}
      loop={element.videoLoop ?? true}
      onLoopChange={(v) => onElementUpdate({ videoLoop: v })}
      controls={element.videoControls ?? false}
      onControlsChange={(v) => onElementUpdate({ videoControls: v })}
      muted={element.videoMuted ?? true}
      onMutedChange={(v) => onElementUpdate({ videoMuted: v })}
      fit={styles.objectFit || "object-cover"}
      onFitChange={(fit) => onStylesUpdate({ objectFit: fit })}
      urlDisabled={urlDisabled}
      disabled={disabled}
    />
  );
}

function GifBridge({ element, onElementUpdate, styles, onStylesUpdate, disabled, onReplace }: {
  element: CanvasElement;
  onElementUpdate: (updates: Partial<CanvasElement>) => void;
  styles: TailwindStyles;
  onStylesUpdate: (updates: Partial<TailwindStyles>) => void;
  disabled?: boolean;
  onReplace: () => void;
}) {
  return (
    <GifSection
      fit={styles.objectFit || "object-contain"}
      onFitChange={(fit) => onStylesUpdate({ objectFit: fit })}
      alt={element.alt || ""}
      onAltChange={(alt) => onElementUpdate({ alt })}
      onReplace={onReplace}
      disabled={disabled}
    />
  );
}

// ============================================================================
// Canvas Position Bridge — absolute X/Y/W/H for canvas-placed elements
// ============================================================================

interface CanvasPositionBridgeProps {
  element: CanvasElement;
  onUpdate: (updates: Partial<CanvasElement>) => void;
  styles: TailwindStyles;
  onStylesUpdate: (patch: Partial<TailwindStyles>) => void;
  disabled?: boolean;
}

function CanvasPositionBridge({ element, onUpdate, styles, onStylesUpdate, disabled }: CanvasPositionBridgeProps) {
  const rotation = readRotation(styles);

  // Local state for rotation input to handle degree symbol
  const [rotationInput, setRotationInput] = useState(`${rotation}°`);
  const [isEditingRotation, setIsEditingRotation] = useState(false);
  const rotationDisplay = isEditingRotation ? rotationInput : `${rotation}°`;

  const handleRotationInputChange = (value: string | undefined) => {
    setIsEditingRotation(true);
    setRotationInput(value ?? "");
    // Update canvas in real time as the user types
    const cleaned = (value ?? "").replace(/°/g, "").trim();
    const numValue = Number(cleaned);
    if (cleaned !== "" && !isNaN(numValue)) {
      onStylesUpdate(writeRotation(numValue));
    }
  };

  const handleRotationBlur = (value: string | undefined) => {
    setIsEditingRotation(false);
    const cleaned = (value ?? "").replace(/°/g, "").trim();
    const numValue = cleaned === "" ? 0 : Number(cleaned);
    const finalValue = isNaN(numValue) ? rotation : numValue;
    onStylesUpdate(writeRotation(finalValue));
    setRotationInput(`${finalValue}°`);
  };

  const alignHorizontalButtons: ButtonGroupItem[] = [
    { icon: LayoutAlignLeft, label: "Align left", disabled: true },
    { icon: LayoutAlignHorizontalCenter, label: "Align center", disabled: true },
    { icon: LayoutAlignRight, label: "Align right", disabled: true },
  ];

  const alignVerticalButtons: ButtonGroupItem[] = [
    { icon: LayoutAlignTop, label: "Align top", disabled: true },
    { icon: LayoutAlignVerticalCenter, label: "Align middle", disabled: true },
    { icon: LayoutAlignBottom, label: "Align bottom", disabled: true },
  ];

  const transformButtons: ButtonGroupItem[] = [
    {
      icon: Rotate,
      onClick: () => onStylesUpdate(writeRotation((rotation + 90) % 360)),
      label: "Rotate 90 degrees",
    },
    {
      icon: FlipHorizontalSmall,
      onClick: () => onStylesUpdate(writeFlipHorizontal(!readFlipHorizontal(styles))),
      label: "Flip horizontal",
    },
    {
      icon: FlipVertical,
      onClick: () => onStylesUpdate(writeFlipVertical(!readFlipVertical(styles))),
      label: "Flip vertical",
    },
  ];

  return (
    <SectionWrapper>
      <SectionHeader title="Position" />
      <SectionBody>
        {/* Alignment */}
        <SectionRow>
          <div className="flex flex-col">
            <span className="text-[9px] font-medium leading-4 tracking-[0.045px] text-stone-500 dark:text-stone-400">
              Alignment
            </span>
            <div className="flex gap-1">
              <ButtonGroup items={alignHorizontalButtons} disabled={disabled} />
              <ButtonGroup items={alignVerticalButtons} disabled={disabled} />
            </div>
          </div>
        </SectionRow>

        {/* Position X/Y */}
        <SectionRow>
          <div className="flex flex-col">
            <span className="text-[9px] font-medium leading-4 tracking-[0.045px] text-stone-500 dark:text-stone-400">
              Position
            </span>
            <div className="flex gap-1">
              <NumberInput
                property="X"
                value={Math.round(element.x)}
                onChange={(v) => {
                  const num = v !== undefined ? parseFloat(v) : 0;
                  if (!isNaN(num)) onUpdate({ x: num });
                }}
                step={1}
                disabled={disabled}
              />
              <NumberInput
                property="Y"
                value={Math.round(element.y)}
                onChange={(v) => {
                  const num = v !== undefined ? parseFloat(v) : 0;
                  if (!isNaN(num)) onUpdate({ y: num });
                }}
                step={1}
                disabled={disabled}
              />
            </div>
          </div>
        </SectionRow>

        {/* Rotation + Transform */}
        <SectionRow>
          <div className="flex flex-col">
            <span className="text-[9px] font-medium leading-4 tracking-[0.045px] text-stone-500 dark:text-stone-400">
              Rotation
            </span>
            <div className="flex items-center gap-2">
              <NumberInput
                leadIcon={Rotation}
                value={rotationDisplay}
                onChange={handleRotationInputChange}
                onBlur={handleRotationBlur}
                step={1}
                disabled={disabled}
                className="flex-1"
              />
              <ButtonGroup items={transformButtons} disabled={disabled} />
            </div>
          </div>
        </SectionRow>
      </SectionBody>
    </SectionWrapper>
  );
}

// Canvas Size bridge (W/H + min/max for canvas-placed elements)
interface CanvasSizeBridgeProps {
  element: CanvasElement;
  onUpdate: (updates: Partial<CanvasElement>) => void;
  styles: TailwindStyles;
  onStylesUpdate: (updates: Partial<TailwindStyles>) => void;
  disabled?: boolean;
}

function CanvasSizeBridge({ element, onUpdate, styles, onStylesUpdate, disabled }: CanvasSizeBridgeProps) {
  const size = readSize(styles);
  const [showMinSize, setShowMinSize] = useState(() => !!(size.minWidth || size.minHeight));
  const [showMaxSize, setShowMaxSize] = useState(() => !!(size.maxWidth || size.maxHeight));

  return (
    <SizeSection
      width={element.width !== undefined ? String(element.width) : size.width}
      onWidthChange={(v) => {
        if (v === "auto" || v === "hug" || v === "fill" || v === "viewport") {
          onUpdate({ width: undefined });
          onStylesUpdate(writeWidth(v));
        } else {
          const num = v !== undefined ? parseFloat(v) : undefined;
          if (num !== undefined && !isNaN(num) && num > 0) {
            onUpdate({ width: num });
            onStylesUpdate(writeWidth(v));
          }
        }
      }}
      height={element.height !== undefined ? String(element.height) : size.height}
      onHeightChange={(v) => {
        if (v === "auto" || v === "hug" || v === "fill" || v === "viewport") {
          onUpdate({ height: undefined });
          onStylesUpdate(writeHeight(v));
        } else {
          const num = v !== undefined ? parseFloat(v) : undefined;
          if (num !== undefined && !isNaN(num) && num > 0) {
            onUpdate({ height: num });
            onStylesUpdate(writeHeight(v));
          }
        }
      }}
      hiddenOptions={element.parentId ? [] : ["fill", "viewport"]}
      showMinSize={showMinSize}
      onShowMinSizeChange={setShowMinSize}
      minWidth={size.minWidth}
      onMinWidthChange={(v) => onStylesUpdate(writeMinWidth(v))}
      minHeight={size.minHeight}
      onMinHeightChange={(v) => onStylesUpdate(writeMinHeight(v))}
      showMaxSize={showMaxSize}
      onShowMaxSizeChange={setShowMaxSize}
      maxWidth={size.maxWidth}
      onMaxWidthChange={(v) => onStylesUpdate(writeMaxWidth(v))}
      maxHeight={size.maxHeight}
      onMaxHeightChange={(v) => onStylesUpdate(writeMaxHeight(v))}
      disabled={disabled}
    />
  );
}

// ============================================================================
// Multi-Select Helpers & Bridges
// ============================================================================

function getMixed<T>(
  allStyles: TailwindStyles[],
  getter: (s: TailwindStyles) => T
): T | undefined {
  const values = allStyles.map(getter);
  const first = values[0];
  return values.every((v) => v === first) ? first : undefined;
}

function showSectionsMulti(elementTypes: string[]) {
  const allText = elementTypes.every(isTextElement);
  const noDividers = elementTypes.every((t) => t !== "divider");
  const hasFillElements = elementTypes.some((t) => !isTextElement(t) && t !== "divider");
  return {
    size: true,
    position: true,
    typography: allText,
    appearance: true,
    fill: hasFillElements,
    border: true,
    shadow: noDividers,
    filter: noDividers,
  };
}

interface MultiBridgeProps {
  allStyles: TailwindStyles[];
  onUpdate: (updates: Partial<TailwindStyles>) => void;
  disabled?: boolean;
}

function MultiSizeBridge({ allStyles, onUpdate, disabled }: MultiBridgeProps) {
  const sizes = allStyles.map((s) => readSize(s));
  const width = sizes.every((s) => s.width === sizes[0].width) ? sizes[0].width : undefined;
  const height = sizes.every((s) => s.height === sizes[0].height) ? sizes[0].height : undefined;
  const minWidth = getMixed(allStyles, (s) => readSize(s).minWidth);
  const minHeight = getMixed(allStyles, (s) => readSize(s).minHeight);
  const maxWidth = getMixed(allStyles, (s) => readSize(s).maxWidth);
  const maxHeight = getMixed(allStyles, (s) => readSize(s).maxHeight);
  const [showMinSize, setShowMinSize] = useState(() => sizes.some((s) => !!(s.minWidth || s.minHeight)));
  const [showMaxSize, setShowMaxSize] = useState(() => sizes.some((s) => !!(s.maxWidth || s.maxHeight)));

  return (
    <SizeSection
      width={width}
      onWidthChange={(v) => onUpdate(writeWidth(v))}
      height={height}
      onHeightChange={(v) => onUpdate(writeHeight(v))}
      showMinSize={showMinSize}
      onShowMinSizeChange={setShowMinSize}
      minWidth={minWidth}
      onMinWidthChange={(v) => onUpdate(writeMinWidth(v))}
      minHeight={minHeight}
      onMinHeightChange={(v) => onUpdate(writeMinHeight(v))}
      showMaxSize={showMaxSize}
      onShowMaxSizeChange={setShowMaxSize}
      maxWidth={maxWidth}
      onMaxWidthChange={(v) => onUpdate(writeMaxWidth(v))}
      maxHeight={maxHeight}
      onMaxHeightChange={(v) => onUpdate(writeMaxHeight(v))}
      disabled={disabled}
      mixedPlaceholder="Mixed"
    />
  );
}

function MultiPositionBridge({ allStyles, onUpdate, disabled }: MultiBridgeProps) {
  const positionType = getMixed(allStyles, readPositionType);
  const rotation = getMixed(allStyles, readRotation);

  return (
    <PositionSection
      positionType={positionType}
      onPositionTypeChange={(t) => onUpdate(writePositionType(t))}
      top={undefined}
      right={undefined}
      bottom={undefined}
      left={undefined}
      onConstraintChange={() => {}}
      pins={{ top: false, right: false, bottom: false, left: false }}
      onPinChange={() => {}}
      rotation={rotation ?? 0}
      onRotationChange={(v) => onUpdate(writeRotation(v))}
      onRotate90={() => onUpdate(writeRotation(((rotation ?? 0) + 90) % 360))}
      onFlipHorizontal={() => onUpdate(writeFlipHorizontal(!getMixed(allStyles, readFlipHorizontal)))}
      onFlipVertical={() => onUpdate(writeFlipVertical(!getMixed(allStyles, readFlipVertical)))}
      disabled={disabled}
    />
  );
}

interface MultiCanvasPositionBridgeProps {
  allStyles: TailwindStyles[];
  onUpdate: (updates: Partial<TailwindStyles>) => void;
  selectedElements: CanvasElement[];
  onElementUpdate: (id: string, updates: Partial<CanvasElement>) => void;
  disabled?: boolean;
}

function MultiCanvasPositionBridge({ allStyles, onUpdate, selectedElements, onElementUpdate, disabled }: MultiCanvasPositionBridgeProps) {
  const rotation = getMixed(allStyles, readRotation);

  // Local state for rotation input
  const [rotationInput, setRotationInput] = useState(`${rotation ?? 0}°`);
  const [isEditingRotation, setIsEditingRotation] = useState(false);
  const rotationDisplay = isEditingRotation ? rotationInput : `${rotation !== undefined ? rotation : "Mixed"}${rotation !== undefined ? "°" : ""}`;

  const handleRotationInputChange = (value: string | undefined) => {
    setIsEditingRotation(true);
    setRotationInput(value ?? "");
    const cleaned = (value ?? "").replace(/°/g, "").trim();
    const numValue = Number(cleaned);
    if (cleaned !== "" && !isNaN(numValue)) {
      onUpdate(writeRotation(numValue));
    }
  };

  const handleRotationBlur = (value: string | undefined) => {
    setIsEditingRotation(false);
    const cleaned = (value ?? "").replace(/°/g, "").trim();
    const numValue = cleaned === "" ? 0 : Number(cleaned);
    const finalValue = isNaN(numValue) ? (rotation ?? 0) : numValue;
    onUpdate(writeRotation(finalValue));
    setRotationInput(`${finalValue}°`);
  };

  // X/Y values — show value if all match, undefined for "Mixed"
  const xValues = selectedElements.map((el) => Math.round(el.x));
  const yValues = selectedElements.map((el) => Math.round(el.y));
  const xMixed = xValues.every((v) => v === xValues[0]) ? xValues[0] : undefined;
  const yMixed = yValues.every((v) => v === yValues[0]) ? yValues[0] : undefined;

  // Alignment handlers
  const alignHorizontalButtons: ButtonGroupItem[] = [
    {
      icon: LayoutAlignLeft,
      label: "Align left",
      onClick: () => {
        const minX = Math.min(...selectedElements.map((el) => el.x));
        for (const el of selectedElements) onElementUpdate(el.id, { x: minX });
      },
    },
    {
      icon: LayoutAlignHorizontalCenter,
      label: "Align center",
      onClick: () => {
        const centers = selectedElements.map((el) => el.x + (el.width ?? 0) / 2);
        const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
        for (const el of selectedElements) onElementUpdate(el.id, { x: Math.round(avgCenter - (el.width ?? 0) / 2) });
      },
    },
    {
      icon: LayoutAlignRight,
      label: "Align right",
      onClick: () => {
        const maxRight = Math.max(...selectedElements.map((el) => el.x + (el.width ?? 0)));
        for (const el of selectedElements) onElementUpdate(el.id, { x: Math.round(maxRight - (el.width ?? 0)) });
      },
    },
  ];

  const alignVerticalButtons: ButtonGroupItem[] = [
    {
      icon: LayoutAlignTop,
      label: "Align top",
      onClick: () => {
        const minY = Math.min(...selectedElements.map((el) => el.y));
        for (const el of selectedElements) onElementUpdate(el.id, { y: minY });
      },
    },
    {
      icon: LayoutAlignVerticalCenter,
      label: "Align middle",
      onClick: () => {
        const centers = selectedElements.map((el) => el.y + (el.height ?? 0) / 2);
        const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
        for (const el of selectedElements) onElementUpdate(el.id, { y: Math.round(avgCenter - (el.height ?? 0) / 2) });
      },
    },
    {
      icon: LayoutAlignBottom,
      label: "Align bottom",
      onClick: () => {
        const maxBottom = Math.max(...selectedElements.map((el) => el.y + (el.height ?? 0)));
        for (const el of selectedElements) onElementUpdate(el.id, { y: Math.round(maxBottom - (el.height ?? 0)) });
      },
    },
  ];

  const transformButtons: ButtonGroupItem[] = [
    {
      icon: Rotate,
      onClick: () => onUpdate(writeRotation(((rotation ?? 0) + 90) % 360)),
      label: "Rotate 90 degrees",
    },
    {
      icon: FlipHorizontalSmall,
      onClick: () => onUpdate(writeFlipHorizontal(!getMixed(allStyles, readFlipHorizontal))),
      label: "Flip horizontal",
    },
    {
      icon: FlipVertical,
      onClick: () => onUpdate(writeFlipVertical(!getMixed(allStyles, readFlipVertical))),
      label: "Flip vertical",
    },
  ];

  return (
    <SectionWrapper>
      <SectionHeader title="Position" />
      <SectionBody>
        {/* Alignment */}
        <SectionRow>
          <div className="flex flex-col">
            <span className="text-[9px] font-medium leading-4 tracking-[0.045px] text-stone-500 dark:text-stone-400">
              Alignment
            </span>
            <div className="flex gap-1">
              <ButtonGroup items={alignHorizontalButtons} disabled={disabled} />
              <ButtonGroup items={alignVerticalButtons} disabled={disabled} />
            </div>
          </div>
        </SectionRow>

        {/* Position X/Y */}
        <SectionRow>
          <div className="flex flex-col">
            <span className="text-[9px] font-medium leading-4 tracking-[0.045px] text-stone-500 dark:text-stone-400">
              Position
            </span>
            <div className="flex gap-1">
              <NumberInput
                property="X"
                value={xMixed !== undefined ? xMixed : undefined}
                onChange={(v) => {
                  const num = v !== undefined ? parseFloat(v) : undefined;
                  if (num !== undefined && !isNaN(num)) {
                    for (const el of selectedElements) onElementUpdate(el.id, { x: num });
                  }
                }}
                step={1}
                disabled={disabled}
                placeholder={xMixed === undefined ? "Mixed" : undefined}
              />
              <NumberInput
                property="Y"
                value={yMixed !== undefined ? yMixed : undefined}
                onChange={(v) => {
                  const num = v !== undefined ? parseFloat(v) : undefined;
                  if (num !== undefined && !isNaN(num)) {
                    for (const el of selectedElements) onElementUpdate(el.id, { y: num });
                  }
                }}
                step={1}
                disabled={disabled}
                placeholder={yMixed === undefined ? "Mixed" : undefined}
              />
            </div>
          </div>
        </SectionRow>

        {/* Rotation + Transform */}
        <SectionRow>
          <div className="flex flex-col">
            <span className="text-[9px] font-medium leading-4 tracking-[0.045px] text-stone-500 dark:text-stone-400">
              Rotation
            </span>
            <div className="flex items-center gap-2">
              <NumberInput
                leadIcon={Rotation}
                value={rotationDisplay}
                onChange={handleRotationInputChange}
                onBlur={handleRotationBlur}
                step={1}
                disabled={disabled}
                className="flex-1"
              />
              <ButtonGroup items={transformButtons} disabled={disabled} />
            </div>
          </div>
        </SectionRow>
      </SectionBody>
    </SectionWrapper>
  );
}

function MultiTypographyBridge({ allStyles, onUpdate, disabled }: MultiBridgeProps) {
  const fontFamily = getMixed(allStyles, readFontFamily);
  const fontWeight = getMixed(allStyles, readFontWeight);
  const fontSize = getMixed(allStyles, readFontSize);
  const lineHeight = getMixed(allStyles, readLineHeight);
  const letterSpacing = getMixed(allStyles, readLetterSpacing);
  const textAlign = getMixed(allStyles, readTextAlign);
  const verticalAlign = getMixed(allStyles, readVerticalAlign);
  const textDecoration = getMixed(allStyles, readTextDecoration);
  const fontStyleMixed = getMixed(allStyles, readFontStyle);
  const textTransform = getMixed(allStyles, readTextTransform);
  const textWrap = getMixed(allStyles, readTextWrap);
  const listStyle = getMixed(allStyles, readListStyleType);

  // Text color
  const textFillsList = allStyles.map((s) => readTextFills(s));
  const textColors = textFillsList.map((fills) => fills.length > 0 ? fills[0].color : "#000000");
  const textColor = textColors.every((c) => c === textColors[0]) ? textColors[0] : undefined;
  const textOpacities = textFillsList.map((fills) => fills.length > 0 ? fills[0].opacity : 100);
  const textColorOpacity = textOpacities.every((o) => o === textOpacities[0]) ? textOpacities[0] : 100;
  const textGradients = textFillsList.map((fills) => fills.length > 0 ? fills[0].gradient : undefined);
  const textGradient = textGradients.every((g) => JSON.stringify(g) === JSON.stringify(textGradients[0])) ? textGradients[0] : undefined;

  // When all selected elements share a font, show only that font's weights/italic.
  // When fonts differ (fontFamily is undefined from getMixed), show all weights.
  const supportedWeights = useMemo(() => getWeightsForFont(fontFamily ?? undefined), [fontFamily]);
  const hasItalic = useMemo(() => hasItalicForFont(fontFamily ?? undefined), [fontFamily]);

  return (
    <TypographySection
      fontFamily={fontFamily ?? ""}
      onFontFamilyChange={(v) => onUpdate(writeFontFamily(v))}
      fontWeight={fontWeight}
      onFontWeightChange={(v) => onUpdate(writeFontWeight(v))}
      fontWeightOptions={getFontWeightOptions(supportedWeights)}
      fontSize={fontSize ?? ""}
      onFontSizeChange={(v) => onUpdate(writeFontSize(v))}
      lineHeight={lineHeight ?? ""}
      onLineHeightChange={(v) => onUpdate(writeLineHeight(v))}
      letterSpacing={letterSpacing ?? ""}
      onLetterSpacingChange={(v) => onUpdate(writeLetterSpacing(v))}
      textAlign={textAlign}
      onTextAlignChange={(v) => onUpdate(writeTextAlign(v))}
      verticalAlign={verticalAlign}
      onVerticalAlignChange={(v) => onUpdate(writeVerticalAlign(v))}
      textDecoration={textDecoration ?? "none"}
      onTextDecorationChange={(v) => onUpdate(writeTextDecoration(v))}
      fontStyle={fontStyleMixed ?? "normal"}
      onFontStyleChange={(v) => onUpdate(writeFontStyle(v))}
      hasItalic={hasItalic}
      textTransform={textTransform ?? "none"}
      onTextTransformChange={(v) => onUpdate(writeTextTransform(v))}
      textWrap={textWrap ?? "wrap"}
      onTextWrapChange={(v) => onUpdate(writeTextWrap(v))}
      listStyle={listStyle ?? "none"}
      onListStyleChange={(v) => onUpdate(writeListStyleType(v))}
      truncation={allStyles.every((s) => readLineClamp(s) !== undefined)}
      onTruncationChange={(on) => onUpdate(writeLineClamp(on ? 3 : undefined))}
      maxLines={getMixed(allStyles, readLineClamp)}
      onMaxLinesChange={(n) => onUpdate(writeLineClamp(n))}
      textColor={textColor}
      onTextColorChange={(color) => onUpdate(writeTextFills([{ id: "fill-text-0", color, opacity: textColorOpacity, visible: true, gradient: textGradient }]))}
      textColorOpacity={textColorOpacity}
      onTextColorOpacityChange={(opacity) => onUpdate(writeTextFills([{ id: "fill-text-0", color: textColor ?? "#000000", opacity, visible: true, gradient: textGradient }]))}
      textGradient={textGradient}
      onTextGradientChange={(gradient) => onUpdate(writeTextFills([{ id: "fill-text-0", color: textColor ?? "#000000", opacity: textColorOpacity, visible: true, gradient }]))}
      disabled={disabled}
      mixedPlaceholder="Mixed"
    />
  );
}

function MultiAppearanceBridge({ allStyles, onUpdate, disabled, elementTypes }: MultiBridgeProps & { elementTypes?: string[] }) {
  const opacity = getMixed(allStyles, readOpacity);
  const blendMode = getMixed(allStyles, readBlendMode);
  const zIndex = getMixed(allStyles, readZIndex);
  const cornerRadius = getMixed(allStyles, readCornerRadius);
  const overflow = getMixed(allStyles, readOverflow);
  const allText = elementTypes ? elementTypes.every(isTextElement) : false;
  const [showIndividualCorners, setShowIndividualCorners] = useState(() =>
    allStyles.some((s) => !!(s as any).borderRadiusTopLeft || !!(s as any).borderRadiusTopRight || !!(s as any).borderRadiusBottomLeft || !!(s as any).borderRadiusBottomRight)
  );
  const [showIndividualOverflow, setShowIndividualOverflow] = useState(() =>
    allStyles.some((s) => !!(s as any).overflowX || !!(s as any).overflowY)
  );

  return (
    <AppearanceSection
      opacity={opacity ?? 100}
      onOpacityChange={(v) => onUpdate(writeOpacity(v))}
      blendMode={blendMode}
      onBlendModeChange={(v) => onUpdate(writeBlendMode(v))}
      zIndex={zIndex}
      onZIndexChange={(v) => onUpdate(writeZIndex(v))}
      cornerRadius={cornerRadius}
      onCornerRadiusChange={(v) => onUpdate(writeCornerRadius(v))}
      showIndividualCorners={showIndividualCorners}
      onShowIndividualCornersChange={setShowIndividualCorners}
      cornerRadiusTopLeft={getMixed(allStyles, (s) => readIndividualCornerRadius(s, "TopLeft"))}
      onCornerRadiusTopLeftChange={(v) => onUpdate(writeIndividualCornerRadius("TopLeft", v))}
      cornerRadiusTopRight={getMixed(allStyles, (s) => readIndividualCornerRadius(s, "TopRight"))}
      onCornerRadiusTopRightChange={(v) => onUpdate(writeIndividualCornerRadius("TopRight", v))}
      cornerRadiusBottomLeft={getMixed(allStyles, (s) => readIndividualCornerRadius(s, "BottomLeft"))}
      onCornerRadiusBottomLeftChange={(v) => onUpdate(writeIndividualCornerRadius("BottomLeft", v))}
      cornerRadiusBottomRight={getMixed(allStyles, (s) => readIndividualCornerRadius(s, "BottomRight"))}
      onCornerRadiusBottomRightChange={(v) => onUpdate(writeIndividualCornerRadius("BottomRight", v))}
      overflow={overflow}
      onOverflowChange={(v) => onUpdate(writeOverflow(v))}
      showIndividualOverflow={showIndividualOverflow}
      onShowIndividualOverflowChange={setShowIndividualOverflow}
      overflowX={getMixed(allStyles, (s) => readOverflowAxis(s, "X")) ?? "visible"}
      onOverflowXChange={(v) => onUpdate(writeOverflowAxis("X", v))}
      overflowY={getMixed(allStyles, (s) => readOverflowAxis(s, "Y")) ?? "visible"}
      onOverflowYChange={(v) => onUpdate(writeOverflowAxis("Y", v))}
      disabled={disabled}
      cornerRadiusDisabled={allText}
      mixedPlaceholder="Mixed"
    />
  );
}

function MultiBorderBridge({ allStyles, onUpdate, disabled }: MultiBridgeProps) {
  // If all have same border state, show it; otherwise show null (Add state)
  const borders = allStyles.map((s) => readBorder(s));
  const allSame = borders.every(
    (b) => JSON.stringify(b) === JSON.stringify(borders[0])
  );
  return (
    <BorderSection
      border={allSame ? borders[0] : null}
      onBorderChange={(b) => onUpdate(writeBorder(b))}
      disabled={disabled}
    />
  );
}

function MultiShadowBridge({ allStyles, onUpdate, disabled }: MultiBridgeProps) {
  const shadows = allStyles.map((s) => readShadow(s));
  const allSame = shadows.every(
    (s) => JSON.stringify(s) === JSON.stringify(shadows[0])
  );
  return (
    <ShadowSection
      shadow={allSame ? shadows[0] : null}
      onShadowChange={(s) => onUpdate(writeShadow(s))}
      disabled={disabled}
    />
  );
}

interface MultiFillBridgeProps extends MultiBridgeProps {
  elementTypes: string[];
  onUpdateFiltered: (filter: (type: string) => boolean, updates: Partial<TailwindStyles>) => void;
}

function MultiFillBridge({ allStyles, elementTypes, onUpdateFiltered, disabled }: MultiFillBridgeProps) {
  // Only read fills from elements that support bg fills (non-text, non-divider)
  const eligibleIndices = elementTypes
    .map((t, i) => (!isTextElement(t) && t !== "divider" ? i : -1))
    .filter((i) => i !== -1);
  const eligibleFills = eligibleIndices.map((i) => readFills(allStyles[i]));
  const allSame = eligibleFills.every(
    (f) => JSON.stringify(f) === JSON.stringify(eligibleFills[0])
  );
  const fillFilter = (type: string) => !isTextElement(type) && type !== "divider";
  return (
    <FillSection
      fills={allSame ? eligibleFills[0] ?? [] : []}
      onFillsChange={(fills) => onUpdateFiltered(fillFilter, writeFills(fills))}
      disabled={disabled}
    />
  );
}

function MultiFilterBridge({ allStyles, onUpdate, disabled }: MultiBridgeProps) {
  const filters = allStyles.map((s) => readFilters(s));
  const allSame = filters.every(
    (f) => JSON.stringify(f) === JSON.stringify(filters[0])
  );
  return (
    <FilterSection
      filters={allSame ? filters[0] : []}
      onFiltersChange={(f) => onUpdate(writeFilters(f))}
      disabled={disabled}
    />
  );
}

// ============================================================================
// Bridge Components — Page Position (artboard world position)
// ============================================================================

function PagePositionBridge() {
  const { pageStyles } = useYjsEditor();
  const { updatePageStyles } = useEditorMutations();
  return (
    <SectionWrapper>
      <SectionHeader title="Position" />
      <SectionBody>
        <SectionRow>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <NumberInput
                value={Math.round(pageStyles?.artboardX ?? 0)}
                onChange={(v) => {
                  const n = v !== undefined ? parseFloat(v) : 0;
                  updatePageStyles({ artboardX: isNaN(n) ? 0 : n });
                }}
                property="X"
                step={1}
              />
            </div>
            <div className="flex-1 min-w-0">
              <NumberInput
                value={Math.round(pageStyles?.artboardY ?? 0)}
                onChange={(v) => {
                  const n = v !== undefined ? parseFloat(v) : 0;
                  updatePageStyles({ artboardY: isNaN(n) ? 0 : n });
                }}
                property="Y"
                step={1}
              />
            </div>
          </div>
        </SectionRow>
      </SectionBody>
    </SectionWrapper>
  );
}

// Bridge Components — Page (PageStyles)
// ============================================================================

interface PageBridgeProps {
  pageStyles: PageStyles;
  onUpdate: (updates: Partial<PageStyles>) => void;
  disabled?: boolean;
}

function PageLayoutBridge({ pageStyles, onUpdate, disabled }: PageBridgeProps) {
  const tw = pageStylesToTailwind(pageStyles) as TailwindStyles;
  const dir = readDirection(tw);
  const padValues = readPaddingValues(tw);
  const [paddingMode, setPaddingMode] = useState<SpacingMode>(() => readPaddingMode(tw));

  return (
    <LayoutSection
      direction={dir}
      onDirectionChange={(d) => onUpdate(applyTailwindToPageStyles(writeDirection(d), pageStyles))}
      alignment={readAlignment(tw, dir)}
      onAlignmentChange={(a) => onUpdate(applyTailwindToPageStyles(writeAlignment(a, dir), pageStyles))}
      spaceBetween={readSpaceBetween(tw)}
      onSpaceBetweenChange={(sb) => onUpdate(applyTailwindToPageStyles(writeSpaceBetween(sb), pageStyles))}
      gap={readGap(tw)}
      onGapChange={(v) => onUpdate(applyTailwindToPageStyles(writeGap(v), pageStyles))}
      paddingMode={paddingMode}
      paddingX={padValues.paddingX}
      paddingY={padValues.paddingY}
      paddingTop={padValues.paddingTop}
      paddingRight={padValues.paddingRight}
      paddingBottom={padValues.paddingBottom}
      paddingLeft={padValues.paddingLeft}
      onPaddingModeChange={(newMode) => {
        if (newMode === "individual" && paddingMode === "xy") {
          onUpdate(applyTailwindToPageStyles({
            ...writePadding("top", padValues.paddingTop, "individual"),
            ...writePadding("right", padValues.paddingRight, "individual"),
            ...writePadding("bottom", padValues.paddingBottom, "individual"),
            ...writePadding("left", padValues.paddingLeft, "individual"),
            paddingX: undefined, paddingY: undefined, padding: undefined,
          }, pageStyles));
        } else if (newMode === "xy" && paddingMode === "individual") {
          const patch: Partial<TailwindStyles> = {
            paddingTop: undefined, paddingRight: undefined,
            paddingBottom: undefined, paddingLeft: undefined,
          };
          if (padValues.paddingLeft === padValues.paddingRight) {
            Object.assign(patch, writePadding("x", padValues.paddingLeft, "xy"));
          }
          if (padValues.paddingTop === padValues.paddingBottom) {
            Object.assign(patch, writePadding("y", padValues.paddingTop, "xy"));
          }
          if (padValues.paddingLeft !== padValues.paddingRight) {
            delete patch.paddingLeft; delete patch.paddingRight;
          }
          if (padValues.paddingTop !== padValues.paddingBottom) {
            delete patch.paddingTop; delete patch.paddingBottom;
          }
          onUpdate(applyTailwindToPageStyles(patch, pageStyles));
        }
        setPaddingMode(newMode);
      }}
      onPaddingChange={(side, value) => onUpdate(applyTailwindToPageStyles(writePadding(side, value, paddingMode), pageStyles))}
      onPaddingCommaChange={(axis, v1, v2) => {
        if (axis === "x") {
          onUpdate(applyTailwindToPageStyles({
            ...writePadding("left", v1, "individual"),
            ...writePadding("right", v2, "individual"),
            paddingX: undefined, padding: undefined,
          }, pageStyles));
        } else {
          onUpdate(applyTailwindToPageStyles({
            ...writePadding("top", v1, "individual"),
            ...writePadding("bottom", v2, "individual"),
            paddingY: undefined, padding: undefined,
          }, pageStyles));
        }
      }}
      marginMode="xy"
      marginX={undefined}
      marginY={undefined}
      marginTop={undefined}
      marginRight={undefined}
      marginBottom={undefined}
      marginLeft={undefined}
      onMarginModeChange={() => {}}
      onMarginChange={() => {}}
      showMargin={false}
      disabled={disabled}
    />
  );
}


function PageFillBridge({ pageStyles, onUpdate, disabled }: PageBridgeProps) {
  const tw = pageStylesToTailwind(pageStyles) as TailwindStyles;
  return (
    <FillSection
      fills={readFills(tw)}
      onFillsChange={(fills) => onUpdate(applyTailwindToPageStyles(writeFills(fills), pageStyles))}
      disabled={disabled}
    />
  );
}

function PageBorderBridge({ pageStyles, onUpdate, disabled }: PageBridgeProps) {
  const tw = pageStylesToTailwind(pageStyles) as TailwindStyles;
  return (
    <BorderSection
      border={readBorder(tw)}
      onBorderChange={(b) => onUpdate(applyTailwindToPageStyles(writeBorder(b), pageStyles))}
      disabled={disabled}
    />
  );
}


// ============================================================================
// PropertyPanel (unified)
// ============================================================================

export function PropertyPanel() {
  // DATA — from Liveblocks storage (re-renders when storage changes)
  const {
    elements,
    pageStyles,
    others,
    localUser,
    pages,
    activePageId,
    homepageId,
  } = useYjsEditor();

  // MUTATIONS — stable proxy, never changes identity
  const {
    updatePageStyles,
    updateElement,
    updateStyles,
    updateResponsiveStyles,
    toggleCore,
    toggleVisibility,
    setViewMode,
    updatePage,
    setHomepage,
    setPanelTab,
  } = useEditorMutations();

  // GRANULAR UI STATE — each subscribes independently
  const selectedIds = useSelectedIds();
  const panelTab = usePanelTab();
  const viewMode = useViewMode();
  const device = useDevice();
  const isAdmin = useIsAdmin();

  const { camera, cameraRef, applyCamera } = useCamera();

  // Bridge integer zoom (5–1600) to float camera zoom (0.05–16.0)
  const handleZoomChange = useCallback((intZoom: number) => {
    const newZoom = intZoom / 100;
    // Zoom centered on viewport — we don't have canvasRef here, so zoom at camera center
    applyCamera(zoomAtPoint(cameraRef.current, newZoom, 0, 0), true);
  }, [applyCamera, cameraRef]);

  const activePage = pages.find(p => p.id === activePageId);

  const selectionCount = selectedIds.length;
  const isPage = selectedIds.includes(ARTBOARD_LAYER_ID);
  const isEmpty = selectionCount === 0;
  const isMulti = selectionCount > 1 && !isPage;
  const isSingle = selectionCount === 1 && !isPage;

  // Page props — always safe to construct
  const pageStylesCopy: PageStyles = pageStyles ? { ...pageStyles } : ({} as PageStyles);
  const pageProps: PageBridgeProps = { pageStyles: pageStylesCopy, onUpdate: updatePageStyles };

  // Page animation proxy — lets animation sections treat the page like an element
  const pageAnimationProxy = isPage ? {
    type: "page" as const,
    cssAnimations: pageStylesCopy.cssAnimations,
    effectLayers: pageStylesCopy.effectLayers,
  } as unknown as CanvasElement : undefined;

  // Page shader proxy — lets ShaderLayerSection treat the page like an element
  const pageShaderProxy = isPage ? {
    type: "page" as const,
    shaderLayers: pageStylesCopy.shaderLayers,
  } as unknown as CanvasElement : undefined;

  // Single-element props — guarded, bundled into nullable object
  const firstSelectedId = isSingle ? selectedIds[0]! : undefined;
  const selectedElement = firstSelectedId ? elements[firstSelectedId] : undefined;

  const singleProps = (() => {
    if (!isSingle || !selectedElement || !firstSelectedId) return null;
    const currentDevice = device;
    const baseStyles: TailwindStyles = selectedElement.tailwindStyles
      ? { ...selectedElement.tailwindStyles }
      : {};
    const responsive = selectedElement.responsiveStyles
      ? { ...selectedElement.responsiveStyles }
      : undefined;
    const effectiveStyles = getEffectiveStyles(baseStyles, responsive, currentDevice);
    const handleUpdateStyles = (updates: Partial<TailwindStyles>) => {
      if (currentDevice === "desktop") updateStyles(firstSelectedId, updates);
      else updateResponsiveStyles(firstSelectedId, currentDevice, updates);
    };
    const handleContentChange = (content: string) => {
      updateElement(firstSelectedId, { content });
    };
    return {
      element: selectedElement,
      sections: showSection(selectedElement.type),
      bridgeProps: { styles: effectiveStyles, onUpdate: handleUpdateStyles } as BridgeProps,
      id: firstSelectedId,
      currentDevice,
      canDelete: !selectedElement.isCore || isAdmin,
      handleContentChange,
    };
  })();

  // Multi-selection derived state — guarded
  const selectedElements = isMulti
    ? selectedIds.map((id) => elements[id]).filter((el): el is CanvasElement => el !== undefined)
    : [];

  // Multi-select property editing props
  const multiProps = (() => {
    if (!isMulti || selectedElements.length < 2) return null;
    const currentDevice = device;
    const allStyles = selectedElements.map((el) => {
      const base: TailwindStyles = el.tailwindStyles ? { ...el.tailwindStyles } : {};
      const responsive = el.responsiveStyles ? { ...el.responsiveStyles } : undefined;
      return getEffectiveStyles(base, responsive, currentDevice);
    });
    const elementTypes = selectedElements.map((el) => el.type);
    const sections = showSectionsMulti(elementTypes);
    const handleUpdate = (updates: Partial<TailwindStyles>) => {
      for (const id of selectedIds) {
        if (currentDevice === "desktop") updateStyles(id, updates);
        else updateResponsiveStyles(id, currentDevice, updates);
      }
    };
    const handleUpdateFiltered = (filter: (type: string) => boolean, updates: Partial<TailwindStyles>) => {
      for (const el of selectedElements) {
        if (!filter(el.type)) continue;
        if (currentDevice === "desktop") updateStyles(el.id, updates);
        else updateResponsiveStyles(el.id, currentDevice, updates);
      }
    };
    const allCanvasPlaced = selectedElements.every((el) => el.placement === "canvas");
    return { allStyles, elementTypes, sections, onUpdate: handleUpdate, onUpdateFiltered: handleUpdateFiltered, selectedElements, allCanvasPlaced };
  })();

  return (
    <div data-editor-panel className="w-[259px] flex-shrink-0 bg-white dark:bg-stone-900 border-l border-stone-200 dark:border-stone-700 flex flex-col overflow-hidden select-none">
      {/* Always visible */}
      <HeaderSection
        localUser={localUser}
        others={others}
        zoom={Math.round(camera.zoom * 100)}
        onZoomChange={handleZoomChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        panelTab={panelTab}
        onPanelTabChange={setPanelTab}
      />

      {/* Element section — page (root frame), design tab only */}
      {isPage && panelTab === "design" && (
        <div className="border-b border-stone-200 dark:border-stone-700 flex-shrink-0 py-2">
          <div className="flex items-center justify-between pl-4 pr-2 py-1">
            <span className="text-[13px] leading-4 font-semibold text-stone-900 dark:text-stone-100 min-w-0 flex-1">
              Page
            </span>
          </div>
        </div>
      )}


      {/* Element section — single selection, design tab only */}
      {singleProps && panelTab === "design" && (
        <div className="border-b border-stone-200 dark:border-stone-700 flex-shrink-0 py-2">
          {/* Section Header */}
          <div className="flex items-center justify-between pl-4 pr-2 py-1">
            <span className="text-[13px] leading-4 font-semibold text-stone-900 dark:text-stone-100 min-w-0 flex-1">
              {singleProps.element.type === "component" && singleProps.element.name
                ? singleProps.element.name
                : singleProps.element.type.charAt(0).toUpperCase() + singleProps.element.type.slice(1)}
            </span>
            <div className="flex items-center gap-1">
              {isAdmin && (
                <IconButton
                  icon={ShieldSmall}
                  toggled={singleProps.element.isCore}
                  onToggle={() => toggleCore(singleProps.id)}
                  aria-label={singleProps.element.isCore ? "Remove core protection" : "Mark as core"}
                />
              )}
              <IconButton
                icon={singleProps.element.hidden ? HiddenSmall : EyeSmall}
                toggled={!!singleProps.element.hidden}
                onToggle={() => toggleVisibility(singleProps.id)}
                aria-label={singleProps.element.hidden ? "Show element" : "Hide element"}
              />
            </div>
          </div>
          {/* Section Body — guest only, protected elements */}
          {!isAdmin && (singleProps.element.isCore || singleProps.element.textLocked) && (
            <div className="pb-2">
              <div className="px-4 pr-10">
                <p className="text-[11px] font-[450] leading-4 tracking-[0.045px] text-stone-500 dark:text-stone-400">
                  {singleProps.element.isCore
                    ? ["heading", "text", "button", "badge"].includes(singleProps.element.type)
                      ? "This element can\u2019t be deleted, and its text isn\u2019t editable."
                      : "This element can\u2019t be deleted."
                    : "This element\u2019s text isn\u2019t editable, but it can be deleted."}
                </p>
              </div>
            </div>
          )}
        </div>
      )}


      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overscroll-none">
        {isEmpty ? (
          <div className="flex items-center justify-center py-12 px-4">
            <span className="text-[11px] font-[450] tracking-[0.045px] text-stone-400 dark:text-stone-500 text-center">
              {panelTab === "design" ? "Select an element to inspect" : "Select an element to add animations"}
            </span>
          </div>
        ) : panelTab === "design" ? (
          <>
            {/* Multi-selection header */}
            {isMulti && (
              <div className="border-b border-stone-200 dark:border-stone-700 py-2">
                <div className="flex items-center justify-between pl-4 pr-2 py-1">
                  <span className="text-[13px] leading-4 font-semibold text-stone-900 dark:text-stone-100 min-w-0 flex-1">
                    {selectedIds.length} selected
                  </span>
                  <div className="flex items-center gap-1">
                    {isAdmin && (
                      <IconButton
                        icon={ShieldSmall}
                        toggled={selectedElements.every((el) => el.isCore)}
                        onToggle={() => {
                          for (const id of selectedIds) toggleCore(id);
                        }}
                        aria-label="Toggle core protection"
                      />
                    )}
                    <IconButton
                      icon={selectedElements.every((el) => el.hidden) ? HiddenSmall : EyeSmall}
                      toggled={selectedElements.every((el) => el.hidden)}
                      onToggle={() => {
                        for (const id of selectedIds) toggleVisibility(id);
                      }}
                      aria-label="Toggle visibility"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Multi-select property sections */}
            {multiProps && (() => {
              const multiKey = selectedIds.slice().sort().join(",");
              return (
                <>
                  {multiProps.sections.position && (
                    multiProps.allCanvasPlaced ? (
                      <MultiCanvasPositionBridge
                        allStyles={multiProps.allStyles}
                        onUpdate={multiProps.onUpdate}
                        selectedElements={multiProps.selectedElements}
                        onElementUpdate={updateElement}
                      />
                    ) : (
                      <MultiPositionBridge allStyles={multiProps.allStyles} onUpdate={multiProps.onUpdate} />
                    )
                  )}
                  {multiProps.sections.size && (
                    <MultiSizeBridge key={`size-${multiKey}`} allStyles={multiProps.allStyles} onUpdate={multiProps.onUpdate} />
                  )}
                  {multiProps.sections.typography && (
                    <MultiTypographyBridge allStyles={multiProps.allStyles} onUpdate={multiProps.onUpdate} />
                  )}
                  {multiProps.sections.appearance && (
                    <MultiAppearanceBridge key={`appearance-${multiKey}`} allStyles={multiProps.allStyles} onUpdate={multiProps.onUpdate} elementTypes={multiProps.elementTypes} />
                  )}
                  {multiProps.sections.fill && (
                    <MultiFillBridge allStyles={multiProps.allStyles} onUpdate={multiProps.onUpdate} onUpdateFiltered={multiProps.onUpdateFiltered} elementTypes={multiProps.elementTypes} />
                  )}
                  {multiProps.sections.border && (
                    <MultiBorderBridge allStyles={multiProps.allStyles} onUpdate={multiProps.onUpdate} />
                  )}
                  {multiProps.sections.shadow && (
                    <MultiShadowBridge allStyles={multiProps.allStyles} onUpdate={multiProps.onUpdate} />
                  )}
                  {multiProps.sections.filter && (
                    <MultiFilterBridge allStyles={multiProps.allStyles} onUpdate={multiProps.onUpdate} />
                  )}
                </>
              );
            })()}

            {/* Section stack — Link, Position, Layout, Size, Typography, Appearance, Fill, Border, Shadow, Filter */}

            {/* Link — single only, admin only */}
            {isAdmin && singleProps?.sections.link && (
              <LinkBridge
                element={singleProps.element}
                onLinkChange={(link) => updateElement(singleProps.id, { link })}
                disabled={singleProps.bridgeProps.disabled}
                pages={pages}
                activePageId={activePageId}
              />
            )}

            {/* Image — single image elements only */}
            {singleProps?.sections.image && (
              <ImageBridge
                element={singleProps.element}
                onElementUpdate={(updates) => updateElement(singleProps.id, updates)}
                styles={singleProps.bridgeProps.styles}
                onStylesUpdate={singleProps.bridgeProps.onUpdate}
                urlDisabled={singleProps.element.isCore && !isAdmin}
                disabled={singleProps.bridgeProps.disabled}
              />
            )}

            {/* Video — single video elements only */}
            {singleProps?.sections.video && (
              <VideoBridge
                element={singleProps.element}
                onElementUpdate={(updates) => updateElement(singleProps.id, updates)}
                styles={singleProps.bridgeProps.styles}
                onStylesUpdate={singleProps.bridgeProps.onUpdate}
                urlDisabled={singleProps.element.isCore && !isAdmin}
                disabled={singleProps.bridgeProps.disabled}
              />
            )}

            {/* GIF — single gif elements only */}
            {singleProps?.sections.gif && (
              <GifBridge
                element={singleProps.element}
                onElementUpdate={(updates) => updateElement(singleProps.id, updates)}
                styles={singleProps.bridgeProps.styles}
                onStylesUpdate={singleProps.bridgeProps.onUpdate}
                disabled={singleProps.bridgeProps.disabled}
                onReplace={() => {
                  window.dispatchEvent(new CustomEvent("open-gif-search", { detail: { elementId: singleProps.id } }));
                }}
              />
            )}

            {/* Position + Size — canvas-placed elements get split Position + Size bridges */}
            {singleProps?.element.placement === "canvas" && !singleProps.element.parentId ? (
              <>
                <CanvasPositionBridge
                  element={singleProps.element}
                  onUpdate={(updates) => updateElement(singleProps.id, updates)}
                  styles={singleProps.bridgeProps.styles}
                  onStylesUpdate={singleProps.bridgeProps.onUpdate}
                  disabled={singleProps.bridgeProps.disabled}
                />
                {singleProps.sections.layout && <LayoutBridge key={singleProps.id} {...singleProps.bridgeProps} />}
                <CanvasSizeBridge
                  element={singleProps.element}
                  onUpdate={(updates) => updateElement(singleProps.id, updates)}
                  styles={singleProps.bridgeProps.styles}
                  onStylesUpdate={singleProps.bridgeProps.onUpdate}
                  disabled={singleProps.bridgeProps.disabled}
                />
              </>
            ) : (
              <>
                {/* Position — page or single element */}
                {isPage && <PagePositionBridge />}
                {singleProps?.sections.position && <PositionBridge {...singleProps.bridgeProps} />}

                {/* Layout — canvas OR single container */}
                {isPage && <PageLayoutBridge {...pageProps} />}
                {singleProps?.sections.layout && <LayoutBridge key={singleProps.id} {...singleProps.bridgeProps} />}

                {/* Size — elements only (page width/height controlled by editor) */}
                {singleProps?.sections.size && <SizeBridge {...singleProps.bridgeProps} />}
              </>
            )}

            {/* Shader — single shader elements only (after position + size) */}
            {singleProps?.sections.shader && (
              <ShaderConfigSection
                element={singleProps.element}
                elementId={singleProps.id}
                disabled={singleProps.bridgeProps.disabled}
              />
            )}

            {/* Typography — single text only */}
            {singleProps?.sections.typography && <TypographyBridge {...singleProps.bridgeProps} />}

            {/* Appearance — elements only (page has no opacity/blend/zIndex/overflow) */}
            {singleProps?.sections.appearance && <AppearanceBridge {...singleProps.bridgeProps} elementType={singleProps.element.type} />}

            {/* Fill */}
            {isPage && <PageFillBridge {...pageProps} />}
            {singleProps?.sections.fill && <FillBridge {...singleProps.bridgeProps} elementType={singleProps.element.type} />}

            {/* Shader Layers (Design tab shader fills) */}
            {isPage && pageShaderProxy && (
              <ShaderLayerSection
                element={pageShaderProxy}
                elementId={ARTBOARD_LAYER_ID}
              />
            )}
            {singleProps?.sections.shaderLayers && (
              <ShaderLayerSection
                element={singleProps.element}
                elementId={singleProps.id}
                disabled={singleProps.bridgeProps.disabled}
              />
            )}

            {/* Border */}
            {isPage && <PageBorderBridge {...pageProps} />}
            {singleProps?.sections.border && <BorderBridge {...singleProps.bridgeProps} />}

            {/* Shadow */}
            {singleProps?.sections.shadow && <ShadowBridge {...singleProps.bridgeProps} />}

            {/* Filter — single only */}
            {singleProps?.sections.filter && <FilterBridge {...singleProps.bridgeProps} />}
          </>
        ) : (
          /* Animate tab */
          isPage && pageAnimationProxy ? (
            <UnifiedAnimationSection
              element={pageAnimationProxy}
              elementId={ARTBOARD_LAYER_ID}
            />
          ) : singleProps?.sections.interactions ? (
            <UnifiedAnimationSection
              element={singleProps.element}
              elementId={singleProps.id}
              disabled={singleProps.bridgeProps.disabled}
            />
          ) : (
            <div className="flex items-center justify-center py-12 px-4">
              <span className="text-[11px] font-[450] tracking-[0.045px] text-stone-400 dark:text-stone-500 text-center">
                Select an element to add animations
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

PropertyPanel.displayName = "PropertyPanel";
