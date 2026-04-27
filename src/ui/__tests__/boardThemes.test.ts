import { describe, expect, it } from 'vitest';
import { BOARD_PALETTES } from '../boardThemes';

describe('BOARD_PALETTES', () => {
  it('defines a (light, dark) pair for every BoardTheme key', () => {
    const keys: ('classic' | 'blue' | 'green' | 'gray')[] = [
      'classic',
      'blue',
      'green',
      'gray',
    ];
    for (const k of keys) {
      const palette = BOARD_PALETTES[k];
      expect(palette).toBeDefined();
      expect(palette.light).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(palette.dark).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('keeps light and dark distinct in every palette', () => {
    for (const palette of Object.values(BOARD_PALETTES)) {
      expect(palette.light.toLowerCase()).not.toBe(palette.dark.toLowerCase());
    }
  });
});
