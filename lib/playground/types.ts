// Playground Feature Types

// ============================================
// Database Types
// ============================================

export interface PlaygroundStyles {
  id: string;

  // Colors
  background_color: string | null;
  text_color: string | null;

  // Typography
  font_family: string | null;
  line_height: number | null;

  // Spacing
  content_padding: number | null;
  element_gap: number | null;

  // Borders
  border_width: number | null;
  border_color: string | null;
  border_radius: number | null;
  border_style: string | null;

  // Effects
  shadow_intensity: number | null;
  shadow_color: string | null;
  background_blur: number | null;

  // Layout
  layout_mode: 'stack' | 'centered' | 'grid';
  max_width: number | null;
  text_align: string | null;

  // Gradient
  gradient_enabled: boolean;
  gradient_start: string | null;
  gradient_end: string | null;
  gradient_angle: number;

  // Meta
  total_edits: number;
  unique_contributors: number;
  created_at: string;
  updated_at: string;
  last_editor_id: string | null;
}

export interface PlaygroundSticker {
  id: string;
  x_position: number;
  y_position: number;
  z_index: number;
  sticker_type: 'emoji' | 'gif' | 'shape';
  content: string;
  scale: number;
  rotation: number;
  created_at: string;
  created_by: string | null;
}

export interface PlaygroundWallPost {
  id: string;
  text_content: string;
  emoji: string | null;
  gif_url: string | null;
  poster_name: string | null;
  poster_id: string;
  poster_color: string;
  is_approved: boolean;
  moderation_status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
}

export interface PlaygroundEditLog {
  id: string;
  editor_id: string;
  property_changed: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

// ============================================
// UI Types
// ============================================

export interface CursorData {
  id: string;
  x: number;
  y: number;
  color: string;
  editing: string | null;
  lastSeen: number;
}

export interface VisitorInfo {
  id: string;
  color: string;
}

export interface StyleUpdatePayload {
  [key: string]: string | number | boolean | null;
}

// ============================================
// Control Panel Types
// ============================================

export type ControlCategory =
  | 'colors'
  | 'typography'
  | 'spacing'
  | 'borders'
  | 'effects'
  | 'layout'
  | 'fun';

export interface FontOption {
  value: string;
  label: string;
}


// ============================================
// API Response Types
// ============================================

export interface StylesResponse {
  styles: PlaygroundStyles;
}

export interface StickersResponse {
  stickers: PlaygroundSticker[];
}

export interface WallPostsResponse {
  posts: PlaygroundWallPost[];
  hasMore: boolean;
}

export interface WallSubmitResponse {
  success: boolean;
  post?: PlaygroundWallPost;
  reason?: string;
}

export interface GifImage {
  id: string;
  title: string;
  url: string;
  preview_url: string;
  width: number;
  height: number;
  original_url: string;
  original_width: number;
  original_height: number;
}

export interface GifResponse {
  gifs: GifImage[];
}

// ============================================
// Context Types
// ============================================

export interface PlaygroundContextType {
  // Styles
  styles: PlaygroundStyles | null;
  isLoadingStyles: boolean;
  updateStyle: (updates: StyleUpdatePayload) => Promise<void>;

  // Stickers
  stickers: PlaygroundSticker[];
  isLoadingStickers: boolean;
  addSticker: (sticker: Omit<PlaygroundSticker, 'id' | 'created_at'>) => Promise<void>;
  updateSticker: (id: string, updates: Partial<PlaygroundSticker>) => Promise<void>;
  deleteSticker: (id: string) => Promise<void>;

  // Wall
  posts: PlaygroundWallPost[];
  isLoadingPosts: boolean;
  submitPost: (content: { text: string; emoji?: string; gif_url?: string; name?: string }) => Promise<WallSubmitResponse>;

  // Presence
  remoteCursors: Map<string, CursorData>;
  onlineCount: number;
  currentlyEditing: string | null;
  setCurrentlyEditing: (category: string | null) => void;

  // Visitor
  visitorId: string;
  visitorColor: string;
}
