/**
 * Design tokens from the Gradebook Ghana mockups (Nov 2026 redesign).
 *
 * The mockups are built around a per-school brand colour: every screen
 * sets `--brand` and derives buttons, the side rail, class-card bands and
 * focus rings from it. The default is the indigo used throughout the
 * mockups; a school can pick another colour at registration / in the
 * school profile. The backend has no colour field, so the choice is kept
 * in localStorage on this device (see gradebook-redesign notes).
 */

export const SCHOOL_COLOURS = [
  '#3647c9',
  '#0e7c86',
  '#8a2f4b',
  '#c2570c',
  '#2f6b3b',
  '#5b3a9d',
] as const;

export const DEFAULT_BRAND = '#3647c9';

const BRAND_KEY = 'gg_brand';
const MOTTO_KEY = 'gg_motto';
const CREST_KEY = 'gg_crest';

export function getStoredBrand(): string {
  const v = localStorage.getItem(BRAND_KEY);
  return v && (SCHOOL_COLOURS as readonly string[]).includes(v) ? v : DEFAULT_BRAND;
}

export function storeBrand(colour: string): void {
  localStorage.setItem(BRAND_KEY, colour);
}

export function getStoredMotto(): string {
  return localStorage.getItem(MOTTO_KEY) ?? '';
}

export function storeMotto(motto: string): void {
  if (motto) localStorage.setItem(MOTTO_KEY, motto);
  else localStorage.removeItem(MOTTO_KEY);
}

export function getStoredCrest(): boolean {
  return localStorage.getItem(CREST_KEY) === '1';
}

export function storeCrest(on: boolean): void {
  localStorage.setItem(CREST_KEY, on ? '1' : '0');
}

/** WAEC band for a total, with the remark and chip colour from the mockups. */
export function gradeBand(total: number): { letter: string; remark: string; bg: string } {
  if (total >= 90) return { letter: 'A1', remark: 'Excellent', bg: '#d4f0e2' };
  if (total >= 80) return { letter: 'B2', remark: 'Very Good', bg: '#e0f0d4' };
  if (total >= 70) return { letter: 'B3', remark: 'Good', bg: '#ecf3cf' };
  if (total >= 60) return { letter: 'C4', remark: 'Credit', bg: '#f8efc6' };
  if (total >= 55) return { letter: 'C5', remark: 'Credit', bg: '#f8efc6' };
  if (total >= 50) return { letter: 'C6', remark: 'Credit', bg: '#f8efc6' };
  if (total >= 45) return { letter: 'D7', remark: 'Pass', bg: '#fbe0c0' };
  if (total >= 40) return { letter: 'E8', remark: 'Pass', bg: '#fbe0c0' };
  return { letter: 'F9', remark: 'Fail', bg: '#f8d2cd' };
}

/** Chip background for a grade letter (falls back via gradeBand thresholds). */
export function gradeChipBg(letter: string | null | undefined): string {
  switch (letter) {
    case 'A1':
      return '#d4f0e2';
    case 'B2':
      return '#e0f0d4';
    case 'B3':
      return '#ecf3cf';
    case 'C4':
    case 'C5':
    case 'C6':
      return '#f8efc6';
    case 'D7':
    case 'E8':
      return '#fbe0c0';
    case 'F9':
      return '#f8d2cd';
    default:
      return 'transparent';
  }
}

/**
 * Short class code shown on the coloured card bands in the mockups:
 * "1 Science 1" -> "1S1", "2 Arts 1" -> "2A1", "1 General Arts 3" -> "1GA3",
 * "3 Business 2" -> "3B2". Falls back to the initials of the name.
 */
export function classCode(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 3 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[parts.length - 1])) {
    const middle = parts
      .slice(1, -1)
      .map((w) => w.charAt(0).toUpperCase())
      .join('');
    return `${parts[0]}${middle}${parts[parts.length - 1]}`;
  }
  return parts.map((w) => w.charAt(0).toUpperCase()).join('').slice(0, 4);
}

/** Card band shades cycled in the mockups: full brand, 45%, 32%. */
export const BAND_SHADES = [100, 45, 32] as const;

export function bandStyle(index: number): { background: string; color: string } {
  const shade = BAND_SHADES[index % BAND_SHADES.length];
  return {
    background: `color-mix(in srgb, var(--brand) ${shade}%, #fff)`,
    color: shade === 100 ? '#fff' : '#1d2347',
  };
}

/** A mark is valid when empty, or a whole number / one decimal from 0 to 100 (mockup rule). */
export function isValidMark(v: string): boolean {
  return v === '' || (/^\d{1,3}(\.\d)?$/.test(v) && Number(v) <= 100);
}
