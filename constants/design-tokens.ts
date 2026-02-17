import { Platform } from 'react-native';

// ─── Color Palette ────────────────────────────────────────────────────────────
export const Palette = {
  primary:       '#2563EB',
  primaryLight:  '#DBEAFE',
  background:    '#F8FAFC',
  surface:       '#FFFFFF',
  danger:        '#EF4444',
  warning:       '#F59E0B',
  success:       '#10B981',
  textPrimary:   '#1E293B',
  textSecondary: '#64748B',
  textTertiary:  '#94A3B8',
  border:        '#E2E8F0',
  divider:       '#F1F5F9',
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────────
export const Spacing = {
  page:         20,
  gap:          16,
  cardPad:      16,
  cardPadLarge: 20,
} as const;

// ─── Border Radius ────────────────────────────────────────────────────────────
export const Radius = {
  card:   16,
  button: 12,
  input:  12,
  badge:  20,
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────
// Soft diffuse shadow for cards
export const CardShadow = Platform.select({
  ios: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius:  12,
  },
  android: { elevation: 3 },
  default: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius:  12,
  },
}) as object;

// Heavier shadow for floating elements (review card)
export const CardShadowHeavy = Platform.select({
  ios: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius:  20,
  },
  android: { elevation: 6 },
  default: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius:  20,
  },
}) as object;
