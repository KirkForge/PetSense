import { describe, it, expect } from 'vitest';
import manifest from '../static/manifest.json';

describe('PWA manifest', () => {
  it('has display: standalone', () => {
    expect(manifest.display).toBe('standalone');
  });

  it('has start_url and scope set to /', () => {
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
  });

  it('has icons with 192x192 and 512x512 sizes', () => {
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });

  it('has name and short_name', () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
  });
});