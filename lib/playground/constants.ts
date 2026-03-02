// Playground Feature Constants

import type { FontOption } from './types';

// ============================================
// Font Options
// ============================================

export const FONT_OPTIONS: FontOption[] = [
  // Nostalgic web fonts
  { value: 'Times New Roman, serif', label: 'Times New Roman (Default)' },
  { value: 'Comic Sans MS, cursive', label: 'Comic Sans MS' },
  { value: 'Papyrus, fantasy', label: 'Papyrus' },
  { value: 'Impact, sans-serif', label: 'Impact' },
  { value: 'Trebuchet MS, sans-serif', label: 'Trebuchet MS' },
  { value: 'Courier New, monospace', label: 'Courier New' },
  { value: 'Arial Black, sans-serif', label: 'Arial Black' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: 'Georgia, serif', label: 'Georgia' },
  // Modern options
  { value: 'Nunito, sans-serif', label: 'Nunito' },
  { value: 'system-ui, sans-serif', label: 'System UI' },
  { value: 'monospace', label: 'Monospace' },
];

export const FONT_VALUES = FONT_OPTIONS.map(f => f.value);

// ============================================
// Emoji Stickers
// ============================================

export const EMOJI_STICKERS = [
  // Hearts & Love
  '❤️', '💖', '💜', '💙', '💚', '💛', '🧡', '🖤', '💕', '💗',
  // Stars & Sparkles
  '⭐', '✨', '💫', '🌟', '⚡', '🔥', '💎', '🌈', '☀️', '🌙',
  // Nature
  '🌸', '🍀', '🌺', '🌻', '🌴', '🍄', '🦋', '🐝', '🌊', '☁️',
  // Fun
  '👀', '💀', '🤖', '👽', '🎃', '👻', '🎭', '🎨', '🎵', '🎀',
  // Animals
  '🐱', '🐶', '🦊', '🐸', '🐰', '🐻', '🦄', '🐲', '🦑', '🐙',
  // Food
  '🍕', '🍔', '🌮', '🍩', '🍪', '🍦', '🧁', '🍰', '☕', '🍷',
  // Objects
  '💻', '📱', '🎮', '🎸', '📸', '💡', '🔮', '🗝️', '🎁', '🏆',
];

// ============================================
// Shape Stickers (SVG names)
// ============================================

export const SHAPE_STICKERS = [
  { value: 'star', label: 'Star' },
  { value: 'heart', label: 'Heart' },
  { value: 'circle', label: 'Circle' },
  { value: 'square', label: 'Square' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'diamond', label: 'Diamond' },
];

// ============================================
// Border Styles
// ============================================

export const BORDER_STYLES = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
  { value: 'double', label: 'Double' },
  { value: 'groove', label: 'Groove' },
  { value: 'ridge', label: 'Ridge' },
  { value: 'inset', label: 'Inset' },
  { value: 'outset', label: 'Outset' },
];

// ============================================
// Text Alignment Options
// ============================================

export const TEXT_ALIGN_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
  { value: 'justify', label: 'Justify' },
];

// ============================================
// Layout Mode Options
// ============================================

export const LAYOUT_MODES = [
  { value: 'stack', label: 'Stack (Default)' },
  { value: 'centered', label: 'Centered' },
  { value: 'grid', label: 'Grid' },
];

// ============================================
// Preset Colors (Quick picks)
// ============================================

export const PRESET_COLORS = [
  '#000000', // Black
  '#FFFFFF', // White
  '#FF0000', // Red
  '#00FF00', // Green
  '#0000FF', // Blue
  '#FFFF00', // Yellow
  '#FF00FF', // Magenta
  '#00FFFF', // Cyan
  '#FFA500', // Orange
  '#800080', // Purple
  '#FFC0CB', // Pink
  '#808080', // Gray
  '#8B4513', // Brown
  '#000080', // Navy
  '#008080', // Teal
  '#90EE90', // Light Green
];

// ============================================
// Rate Limits
// ============================================

export const RATE_LIMITS = {
  STYLE_UPDATE_MS: 1000, // 1 update per second
  STICKER_ADD_PER_MINUTE: 10,
  WALL_POST_PER_MINUTE: 3,
  CURSOR_BROADCAST_MS: 33, // ~30fps
};

// ============================================
// Limits
// ============================================

export const LIMITS = {
  MAX_STICKERS: 100,
  MAX_WALL_POST_LENGTH: 280,
  MAX_POSTER_NAME_LENGTH: 50,
  STICKER_CLEANUP_THRESHOLD: 100, // FIFO when exceeded
  MAX_CURSOR_CHAT_LENGTH: 50,
  MAX_FLYING_REACTIONS: 20,
  REACTION_DURATION_MS: 4000,
  REACTION_COOLDOWN_MS: 500,
};

// ============================================
// Visitor Color Palette
// ============================================

export const VISITOR_COLORS = [
  '#2563EB', // blue-600
  '#FACC15', // yellow-400
  '#AD46FF', // purple-500
  '#EC4899', // pink-500
  '#DC2626', // red-600
  '#16A34A', // green-600
  '#64748B', // slate-500
  '#FB923C', // orange-400
];

// Yellow needs black text, all others use white
export const YELLOW_COLOR = '#FACC15';

// One Tailwind shade darker for chat bubble borders
export const VISITOR_BORDER_COLORS: Record<string, string> = {
  '#2563EB': '#1D4ED8', // blue-600 → blue-700
  '#FACC15': '#EAB308', // yellow-400 → yellow-500
  '#AD46FF': '#9333EA', // purple-500 → purple-600
  '#EC4899': '#DB2777', // pink-500 → pink-600
  '#DC2626': '#B91C1C', // red-600 → red-700
  '#16A34A': '#15803D', // green-600 → green-700
  '#64748B': '#475569', // slate-500 → slate-600
  '#FB923C': '#F97316', // orange-400 → orange-500
};

// ============================================
// Room Configuration (Multi-room support)
// ============================================

export const ROOM_CONFIG = {
  MAIN_ROOM_ID: "playground-main",
  OVERFLOW_PREFIX: "playground-overflow-",
  DEV_ROOM_ID: "playground-main",  // dev project's main room (mirrors prod data)
  MAX_CONNECTIONS_PER_ROOM: 45, // buffer below 50 hard limit
  MAX_OVERFLOW_ROOMS: 498,      // 498 overflow + 1 main + 1 dev = 500 rooms (Liveblocks free tier limit)
};
