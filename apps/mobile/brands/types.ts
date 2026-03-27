export interface BrandColors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  secondary: string;
  secondaryDark: string;
  secondaryLight: string;
  surface: string;
  surfaceDark: string;
  muted: string;
  mutedDark: string;
  text: string;
  textSecondary: string;
  success: string;
  warning: string;
  error: string;
  gold: string;
  silver: string;
  bronze: string;
  tabBar: string;
  tabBarActive: string;
  tabBarInactive: string;
  border: string;
  overlay: string;
}

export interface BrandConfig {
  name: string;
  slug: string;
  scheme: string;
  bundleId: string;
  colors: BrandColors;
  /** If set, the app auto-joins this game instead of showing GameBrowser */
  defaultGameId?: string;
}
