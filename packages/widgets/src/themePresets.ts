import type { NsTheme, NsThemeMode } from './styles.js';

export const nsBrandPresets = {
  default: { label: 'Default', primaryHue: 198, accentHue: 258 },
  violet: { label: 'Violet', primaryHue: 258, accentHue: 198 },
  emerald: { label: 'Emerald', primaryHue: 157, accentHue: 210 },
  amber: { label: 'Amber', primaryHue: 38, accentHue: 258 },
  rose: { label: 'Rose', primaryHue: 349, accentHue: 258 },
  slate: { label: 'Slate', primaryHue: 222, accentHue: 198 }
} as const;

export type NsBrandPreset = keyof typeof nsBrandPresets;

function clampHue(hue: number) {
  const n = Number(hue) || 0;
  return ((n % 360) + 360) % 360;
}

function hsl(hue: number, sat: number, light: number, alpha?: number) {
  const h = clampHue(hue);
  if (alpha === undefined) return `hsl(${h} ${sat}% ${light}%)`;
  return `hsl(${h} ${sat}% ${light}% / ${alpha})`;
}

type CreateBrandThemeOpts = {
  mode: NsThemeMode;
  preset?: NsBrandPreset;
  primaryHue?: number;
  accentHue?: number;
};

export function createNsBrandTheme(opts: CreateBrandThemeOpts): NsTheme {
  const preset = opts.preset ? nsBrandPresets[opts.preset] : undefined;
  const primaryHue = clampHue(opts.primaryHue ?? preset?.primaryHue ?? 198);
  const accentHue = clampHue(opts.accentHue ?? preset?.accentHue ?? 258);
  const mode = opts.mode;
  const isDark = mode === 'dark';

  const primary = isDark ? hsl(primaryHue, 86, 62) : hsl(primaryHue, 85, 52);
  const primaryHover = isDark ? hsl(primaryHue, 88, 72) : hsl(primaryHue, 87, 42);
  const primarySubtle = isDark ? hsl(primaryHue, 80, 22, 0.7) : hsl(primaryHue, 95, 90);
  const accent = isDark ? hsl(accentHue, 85, 72) : hsl(accentHue, 82, 66);
  const accentSubtle = isDark ? hsl(accentHue, 84, 28, 0.55) : hsl(accentHue, 96, 90);
  const focusRing = isDark ? hsl(primaryHue, 88, 65, 0.45) : hsl(primaryHue, 85, 52, 0.55);

  return {
    mode,
    color: {
      primary,
      primaryHover,
      primarySubtle,
      accent,
      accentSubtle,
      focusRing
    }
  };
}
