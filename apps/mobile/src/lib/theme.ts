export const colors = {
  primary: '#FF6B35',
  primaryDark: '#E55A25',
  primaryLight: '#FF8C5A',
  secondary: '#1a1a2e',
  secondaryDark: '#0d0d1a',
  secondaryLight: '#2d2d4e',
  surface: '#FFFFFF',
  surfaceDark: '#F5F5F5',
  muted: '#9CA3AF',
  mutedDark: '#6B7280',
  text: '#111827',
  textSecondary: '#6B7280',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
  tabBar: '#FFFFFF',
  tabBarActive: '#FF6B35',
  tabBarInactive: '#9CA3AF',
  border: '#E5E7EB',
  overlay: 'rgba(0,0,0,0.5)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
} as const;

export const typography = {
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  fontWeight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
} as const;
