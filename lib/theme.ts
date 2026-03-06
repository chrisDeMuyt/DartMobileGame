export const PIXEL_FONT = 'PressStart2P_400Regular';

// Sharp pixel-art drop shadow (0 blur = hard edge like pixel art)
export const pixelShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 4, height: 4 },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: 6,
} as const;

export const pixelShadowSm = {
  shadowColor: '#000000',
  shadowOffset: { width: 2, height: 2 },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: 4,
} as const;

export const COLORS = {
  bgDark:    '#0a1628',
  bgPanel:   '#0d2137',
  bgCard:    '#1a3a5c',
  cyan:      '#00d4ff',
  gold:      '#f5c518',
  red:       '#cc2200',
  bright:    '#ffffff',
  muted:     '#7ab3cc',
} as const;
