// Section wrapper components
export { SectionWrapper, SectionBody, SectionRow, SortableBody, SortableRow } from "./section-wrapper";

// Section components
export {
  AppearanceSection,
  type AppearanceSectionProps,
  type BlendMode,
  type OverflowValue,
} from "./appearance-section";

export {
  PositionSection,
  type PositionSectionProps,
  type PositionType,
  type PinState,
  type StickyEdge,
} from "./position-section";

export {
  LayoutSection,
  type LayoutSectionProps,
  type FlowDirection,
} from "./layout-section";

export {
  SizeSection,
  type SizeSectionProps,
} from "./size-section";

export {
  TypographySection,
  type TypographySectionProps,
  type TextAlignment,
  type VerticalAlignment,
  type FontWeightOption,
} from "./typography-section";

export {
  ShadowSection,
  type ShadowSectionProps,
  type ShadowValue,
  type ShadowType,
} from "./shadow-section";

export {
  generateBeautifulShadow,
  generateShadowLayers,
  type ShadowLayer,
} from "./shadow-utils";

export {
  BorderSection,
  type BorderSectionProps,
  type BorderValue,
  type BorderStyle,
  type BorderSide,
} from "./border-section";

export {
  FilterSection,
  type FilterSectionProps,
  type FilterItem,
  type FilterType,
  type FilterTarget,
} from "./filter-section";

export {
  FillSection,
  type FillSectionProps,
  type FillItem,
  type GradientFill,
  type GradientStop,
} from "./fill-section";

export {
  LinkSection,
  type LinkSectionProps,
  type LinkValue,
  type LinkTarget,
} from "./link-section";

export {
  ImageSection,
  type ImageSectionProps,
} from "./image-section";

export {
  VideoSection,
  type VideoSectionProps,
} from "./video-section";

export {
  GifSection,
  type GifSectionProps,
} from "./gif-section";

export {
  InteractionSection,
  type InteractionSectionProps,
  type EffectType,
  type PseudoGroup,
} from "./interaction-section";

export {
  HeaderSection,
  type HeaderSectionProps,
  type AvatarUser,
  type PanelTab,
} from "./header-section";

export {
  ReactEffectSection,
  type ReactEffectSectionProps,
} from "./react-effect-section";

export {
  ReactEffectDialog,
  type ReactEffectDialogProps,
} from "./react-effect-dialog";

// Re-export AlignmentPosition from alignment-grid-new for convenience
export type { AlignmentPosition } from "../ui/alignment-grid-new";

// Re-export spacing control types for convenience
export type { SpacingMode, SpacingSide } from "../ui/spacing-control";
