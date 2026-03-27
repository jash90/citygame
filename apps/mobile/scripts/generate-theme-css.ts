/**
 * Generates the @theme block in global.css from the active brand config.
 *
 * Usage: BRAND=adventura npx ts-node scripts/generate-theme-css.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import type { BrandConfig } from '../brands/types';

const BRAND = process.env.BRAND ?? 'citygame';
const brandConfig: BrandConfig =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require(`../brands/${BRAND}/config`).default;

const cssPath = path.resolve(__dirname, '../src/global.css');

const themeBlock = `@theme {
  --color-primary: ${brandConfig.colors.primary};
  --color-primary-dark: ${brandConfig.colors.primaryDark};
  --color-primary-light: ${brandConfig.colors.primaryLight};
  --color-secondary: ${brandConfig.colors.secondary};
  --color-secondary-dark: ${brandConfig.colors.secondaryDark};
  --color-secondary-light: ${brandConfig.colors.secondaryLight};
  --color-surface: ${brandConfig.colors.surface};
  --color-surface-dark: ${brandConfig.colors.surfaceDark};
  --color-muted: ${brandConfig.colors.muted};
  --color-muted-dark: ${brandConfig.colors.mutedDark};
  --color-success: ${brandConfig.colors.success};
  --color-warning: ${brandConfig.colors.warning};
  --color-error: ${brandConfig.colors.error};
  --color-gold: ${brandConfig.colors.gold};
  --color-silver: ${brandConfig.colors.silver};
  --color-bronze: ${brandConfig.colors.bronze};
  --color-border: ${brandConfig.colors.border};
  --color-overlay: ${brandConfig.colors.overlay};
}`;

const css = fs.readFileSync(cssPath, 'utf-8');

// Replace the @theme { ... } block
const updated = css.replace(/@theme\s*\{[^}]*\}/, themeBlock);

fs.writeFileSync(cssPath, updated, 'utf-8');

console.log(`✔ global.css updated with brand "${BRAND}" colors`);
