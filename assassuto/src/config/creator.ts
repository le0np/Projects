/** Character creator options. Appearance is visual only (GDD 3). */
export const ageRange = { min: 16, max: 70, default: 22 };
export const heightRange = { min: 0.92, max: 1.08 };

export const hairColors: { name: string; hex: number }[] = [
  { name: 'Midnight', hex: 0x1d2146 },
  { name: 'Raven', hex: 0x17151a },
  { name: 'Chestnut', hex: 0x5a3422 },
  { name: 'Auburn', hex: 0x8a3a22 },
  { name: 'Honey', hex: 0xc9933f },
  { name: 'Platinum', hex: 0xe6dfcf },
  { name: 'Silver', hex: 0xb9bcc6 },
  { name: 'Rose', hex: 0xd77d93 },
  { name: 'Sky', hex: 0x6fa8e8 },
  { name: 'Moss', hex: 0x5f7f45 },
];

export const skinTones = [0xf6d5bd, 0xf1c8a8, 0xdcab83, 0xb97f57, 0x8a5a3b, 0x5e3b27];

/**
 * Hairstyles per body. A style needs a model to exist: the Tripo body ships with its own hair
 * ("signature"); extra styles arrive as separate Tripo hair meshes later.
 */
export const hairStyles: Record<'feminine' | 'masculine', { id: string; label: string }[]> = {
  feminine: [{ id: 'long', label: 'Long, flowing' }],
  masculine: [
    { id: 'short', label: 'Short' },
    { id: 'long', label: 'Long' },
    { id: 'ponytail', label: 'Ponytail' },
  ],
};

export const nameMaxLength = 18;

export const suggestedNames = {
  feminine: ['Aria', 'Liora', 'Senna', 'Mirae', 'Kaela', 'Ysolde', 'Nerys', 'Talia', 'Ilsa', 'Vela'],
  masculine: ['Kael', 'Rowan', 'Darian', 'Elric', 'Joren', 'Taren', 'Lucan', 'Soren', 'Aren', 'Cassian'],
};

export function validateName(raw: string): { ok: boolean; value: string; error?: string } {
  const value = raw.replace(/\s+/g, ' ').trim();
  if (value.length < 2) return { ok: false, value, error: 'Name must be at least 2 characters.' };
  if (value.length > nameMaxLength) return { ok: false, value, error: `Name can be at most ${nameMaxLength} characters.` };
  if (!/^[\p{L}][\p{L}\p{M}' -]*$/u.test(value)) return { ok: false, value, error: "Use letters, spaces, apostrophes or hyphens." };
  return { ok: true, value };
}
