import { StyleSheet } from 'react-native-unistyles';
import { colors, spacing, typography, borderRadius, shadows } from './theme';

export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Tailwind gray palette (used extensively in the app)
export const gray = {
  50: '#F9FAFB',
  100: '#F3F4F6',
  200: '#E5E7EB',
  300: '#D1D5DB',
  400: '#9CA3AF',
  500: '#6B7280',
  600: '#4B5563',
  700: '#374151',
  800: '#1F2937',
  900: '#111827',
} as const;

export const green = {
  50: '#F0FDF4',
  100: '#DCFCE7',
  200: '#BBF7D0',
  700: '#15803D',
} as const;

export const amber = {
  50: '#FFFBEB',
  100: '#FEF3C7',
  200: '#FDE68A',
  600: '#D97706',
  700: '#B45309',
  800: '#92400E',
} as const;

export const red = {
  50: '#FEF2F2',
  100: '#FEE2E2',
  200: '#FECACA',
  400: '#F87171',
  500: '#EF4444',
  600: '#DC2626',
  700: '#B91C1C',
} as const;

export const orange = {
  50: '#FFF7ED',
  200: '#FED7AA',
  600: '#EA580C',
} as const;

const lightTheme = {
  colors: {
    ...colors,
    gray,
    green,
    amber,
    red,
    orange,
  },
  spacing,
  fontSize: typography.fontSize,
  fontWeight: typography.fontWeight,
  lineHeight: typography.lineHeight,
  borderRadius,
  shadows,
} as const;

type AppThemes = { light: typeof lightTheme };

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({
  themes: { light: lightTheme },
  settings: { initialTheme: 'light' },
});
