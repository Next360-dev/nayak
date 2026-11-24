
// Nayak mobile palette: matches the web app. Navy primary, soft blue accent, Indian tricolor marks (flag below).
export const palette = {
  light: {
    bg: '#F8FAFC', card: '#FFFFFF', text: '#0F172A', muted: '#64748B', border: '#E2E8F0', surface: '#F1F5F9',
    accent: '#0B2545', accentText: '#0B2545', accentBg: '#E8EEF8', onAccent: '#FFFFFF',
    ok: '#138808', okBg: '#E4F3EA', attention: '#9A6410', attentionBg: '#FBF0D9', danger: '#C23030', dangerBg: '#FBE7E7',
  },
  dark: {
    bg: '#0B132B', card: '#1C2541', text: '#F1F5F9', muted: '#94A3B8', border: '#2B3658', surface: '#243053',
    accent: '#8DB4F0', accentText: '#BBD3F7', accentBg: '#1E3A66', onAccent: '#0B132B',
    ok: '#4CC27E', okBg: '#16301F', attention: '#E8B04F', attentionBg: '#3A2B12', danger: '#F0746A', dangerBg: '#3B1A18',
  },
};

export type Colors = typeof palette.light;

// Selected state for segmented controls and progress: neutral ink, so gold stays reserved for actions.
export const ink = '#0B2545';

// Spacing is a 4-point grid. Corner rule: pills 999, cards 16, rows and inputs 12.
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { row: 14, card: 22, pill: 999, bar: 3, line: 2, dot: 5, badge: 9, tile: 12, tileLg: 16, summary: 20, avatar: 24, tabBar: 30, skeleton: 6, chip: 10, sheet: 28 };
export const type = {
  title: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.3 },
  headline: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 24 },
  caption: { fontSize: 12, fontWeight: '500' as const, lineHeight: 18 },
  stat: { fontSize: 26, fontWeight: '700' as const, fontVariant: ['tabular-nums' as const] },
  display: { fontSize: 22, fontWeight: '700' as const, lineHeight: 31, letterSpacing: -0.2 },
  reading: { fontSize: 16, fontWeight: '400' as const, lineHeight: 26 },
};

// Named accent tokens used outside the palette (quick-action tints, flag bars).
export const tints = { gold: '#C58B35', violet: '#7A4BC2', blue: '#2F6FD0', green: '#16834A' };
export const flag = { saffron: '#FF9933', green: '#138808' };
// Orange highlight the web uses for the AI / voice action.
export const highlight = '#F97316';
export const white = '#FFFFFF';

// Layering tokens (V0). L1 surfaces, borders, shadows, veil, dark banner.
export const surface = '#FFFFFF';
export const line = '#E2E8F0';
export const hairline = '#E2E8F0';
export const shadowCard = '0 1px 2px rgba(15,23,42,0.06), 0 6px 16px rgba(15,23,42,0.06)';
export const shadowBar = '0 -1px 0 rgba(23,23,23,0.04), 0 10px 28px rgba(23,23,23,0.14)';
export const veil = {
  colors: ['rgba(248,250,252,0.20)', 'rgba(248,250,252,0.93)', 'rgba(248,250,252,0.93)', 'rgba(248,250,252,0.45)'] as const,
  locations: [0, 0.22, 0.78, 1] as const,
};
export const banner = { text: 'rgba(255,255,255,0.85)', textSoft: 'rgba(255,255,255,0.80)', buttonBg: 'rgba(255,255,255,0.18)', buttonBorder: 'rgba(255,255,255,0.30)' };
export const bannerGradient = ['#0B132B', '#0B2545', '#1C3F73'] as const;
export const bannerAccent = '#FF9933';

export function useTheme(): { c: Colors; dark: boolean } {
  // Light only for now: the app sits on the shared background image.
  return { c: palette.light, dark: false };
}

// On a phone the screens sit on the shared backdrop picture, so scenes are transparent.
// In a browser, inactive screens stay mounted behind the active one (they are only z-indexed, never hidden),
// so a transparent scene lets the one below show through. On web only, make the active scene opaque.
export const sceneBackground = (typeof document !== 'undefined' ? palette.light.bg : 'transparent') as string;
