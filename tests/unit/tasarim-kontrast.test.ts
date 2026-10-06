import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../helpers/contrast';

const TOKENS = [
  'bg',
  'surface',
  'surface-muted',
  'fg',
  'fg-muted',
  'border',
  'border-strong',
  'primary',
  'primary-hover',
  'primary-fg',
  'danger',
  'danger-fg',
  'danger-soft',
  'success',
  'success-soft',
  'warning',
  'warning-soft',
  'focus',
  // Saha yönünün üst bandı ve sarı işaret rengi (docs/TASARIM-SISTEMI.md).
  'band',
  'band-fg',
  'band-muted',
  'signal',
  'signal-fg',
] as const;

const TEXT_PAIRS: Array<[string, string]> = [
  ['fg', 'bg'],
  ['fg', 'surface'],
  ['fg', 'surface-muted'],
  ['fg-muted', 'bg'],
  ['fg-muted', 'surface'],
  ['primary-fg', 'primary'],
  ['primary-fg', 'primary-hover'],
  ['primary', 'bg'],
  ['primary', 'surface'],
  ['danger-fg', 'danger'],
  ['danger', 'surface'],
  ['danger', 'danger-soft'],
  ['success', 'success-soft'],
  ['warning', 'warning-soft'],
  ['band-fg', 'band'],
  ['band-muted', 'band'],
  ['signal-fg', 'signal'],
];
const UI_PAIRS: Array<[string, string]> = [
  ['border-strong', 'surface'],
  ['border-strong', 'bg'],
  ['focus', 'bg'],
  ['focus', 'surface'],
];

const css = readFileSync('src/app/globals.css', 'utf8');

function tokensOf(block: string | undefined): Record<string, string> {
  if (!block) return {};
  return Object.fromEntries(
    [...block.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m): [string, string] => [
      m[1]!,
      m[2]!,
    ]),
  );
}

const themes = {
  açık: tokensOf(css.match(/:root\s*\{([^}]*)\}/)?.[1]),
  koyu: tokensOf(
    css.match(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/)?.[1],
  ),
};

describe.each(Object.entries(themes))('%s tema', (_name, tokens) => {
  it("bütün token'lar 6 haneli hex olarak tanımlı", () => {
    expect(Object.keys(tokens).sort()).toEqual([...TOKENS].sort());
  });
  it.each(TEXT_PAIRS)('metin %s / zemin %s en az 4,5:1', (fg, bg) => {
    expect(contrastRatio(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(4.5);
  });
  it.each(UI_PAIRS)('arayüz parçası %s / %s en az 3:1', (fg, bg) => {
    expect(contrastRatio(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(3);
  });
});
