import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig({});
    expect(config.port).toBe(3001);
    expect(config.discogs.token).toBeUndefined();
  });

  it('treats an empty token as missing', () => {
    expect(loadConfig({ DISCOGS_TOKEN: '' }).discogs.token).toBeUndefined();
  });

  it('rejects an invalid port without echoing values', () => {
    expect(() => loadConfig({ PORT: 'abc', DISCOGS_TOKEN: 'secret' })).toThrow(/PORT/);
    expect(() => loadConfig({ PORT: 'abc', DISCOGS_TOKEN: 'secret' })).not.toThrow(/secret/);
  });
});
