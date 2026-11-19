
// Nayak mobile palette (from the approved Home reference): warm ivory, charcoal, one muted-gold accent.
// accentText is a darker gold used for small text so it keeps AA contrast on ivory.
export const palette = {
  light: {
    bg: '#F8F6F2', card: '#FFFFFF', text: '#171717', muted: '#6B6B6B', border: '#ECE7DD', surface: '#F2EEE6',
    accent: '#C58B35', accentText: '#8A5A12', accentBg: '#F6E8CF', onAccent: '#171717',
    ok: '#16834A', okBg: '#E4F3EA', attention: '#9A6410', attentionBg: '#FBF0D9', danger: '#C23030', dangerBg: '#FBE7E7',
  },
  dark: {
    bg: '#12100D', card: '#1C1915', text: '#F4F1EA', muted: '#A59E92', border: '#2E2A23', surface: '#25211B',
    accent: '#D9A04C', accentText: '#E3B466', accentBg: '#3A2D16', onAccent: '#171717',
    ok: '#4CC27E', okBg: '#16301F', attention: '#E8B04F', attentionBg: '#3A2B12', danger: '#F0746A', dangerBg: '#3B1A18',
  },
};

export type Colors = typeof palette.light;

// Selected state on the News reference (scope tabs, Latest/Archive).
export const forest = '#14532D';

// Spacing is a 4-point grid. Corner rule: pills 999, cards 16, rows and inputs 12.
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { row: 14, card: 22, pill: 999, bar: 3, line: 2, dot: 5, badge: 9, tile: 12, tileLg: 16, summary: 20, avatar: 24, tabBar: 30, skeleton: 6, chip: 10, sheet: 28 };
export const type = {
  title: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.3 },
  headline: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
  stat: { fontSize: 26, fontWeight: '700' as const, fontVariant: ['tabular-nums' as const] },
  display: { fontSize: 22, fontWeight: '700' as const, lineHeight: 31, letterSpacing: -0.2 },
  reading: { fontSize: 16, fontWeight: '400' as const, lineHeight: 26 },
};

// Named accent tokens used outside the palette (quick-action tints, flag bars).
export const tints = { gold: '#C58B35', violet: '#7A4BC2', blue: '#2F6FD0', green: '#16834A' };
export const flag = { saffron: '#FF9933', green: '#138808' };
export const white = '#FFFFFF';

// Layering tokens (V0). L1 surfaces, borders, shadows, veil, dark banner.
export const surface = '#FFFFFF';
export const line = '#E4DED3';
export const hairline = '#ECE7DD';
export const shadowCard = '0 1px 2px rgba(23,23,23,0.06), 0 6px 16px rgba(23,23,23,0.06)';
export const shadowBar = '0 -1px 0 rgba(23,23,23,0.04), 0 10px 28px rgba(23,23,23,0.14)';
export const veil = {
  colors: ['rgba(248,246,242,0.20)', 'rgba(248,246,242,0.93)', 'rgba(248,246,242,0.93)', 'rgba(248,246,242,0.45)'] as const,
  locations: [0, 0.22, 0.78, 1] as const,
};
export const banner = { text: 'rgba(255,255,255,0.85)', textSoft: 'rgba(255,255,255,0.80)', buttonBg: 'rgba(255,255,255,0.18)', buttonBorder: 'rgba(255,255,255,0.30)' };
export const bannerGradient = ['#1B140D', '#3B2A14', '#7A5220'] as const;
export const bannerAccent = '#E3B466';

export function useTheme(): { c: Colors; dark: boolean } {
  // Light only for now: the app sits on the shared background image.
  return { c: palette.light, dark: false };
}
