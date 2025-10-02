import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getSupabasePorts } from '../../src/utils/supabase-config.js';

describe('Supabase Config Parser', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    // Create temporary test directory
    testDir = mkdtempSync(join(tmpdir(), 'lightstack-test-'));
    originalCwd = process.cwd();
    process.chdir(testDir);

    // Create supabase directory
    mkdirSync('supabase', { recursive: true });
  });

  afterEach(() => {
    // Restore original directory and cleanup
    process.chdir(originalCwd);
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should return default ports when config.toml does not exist', () => {
    const ports = getSupabasePorts();

    expect(ports).toEqual({
      api: 54321,
      studio: 54323,
    });
  });

  it('should parse custom ports from config.toml', () => {
    const config = `
[api]
enabled = true
port = 55000
schemas = ["public", "storage", "graphql_public"]

[studio]
enabled = true
port = 55001
api_url = "http://localhost:55000"
`;

    writeFileSync('supabase/config.toml', config);

    const ports = getSupabasePorts();

    expect(ports).toEqual({
      api: 55000,
      studio: 55001,
    });
  });

  it('should use default for API port when only studio port is custom', () => {
    const config = `
[api]
enabled = true
port = 54321

[studio]
enabled = true
port = 55001
`;

    writeFileSync('supabase/config.toml', config);

    const ports = getSupabasePorts();

    expect(ports).toEqual({
      api: 54321,
      studio: 55001,
    });
  });

  it('should use default for studio port when only API port is custom', () => {
    const config = `
[api]
enabled = true
port = 55000

[studio]
enabled = true
port = 54323
`;

    writeFileSync('supabase/config.toml', config);

    const ports = getSupabasePorts();

    expect(ports).toEqual({
      api: 55000,
      studio: 54323,
    });
  });

  it('should handle config with extra whitespace and comments', () => {
    const config = `
# This is a comment
[api]
enabled = true
# API port configuration
port   =   55000   # Custom port
schemas = ["public"]

# Studio configuration
[studio]
enabled = true
port=55001
`;

    writeFileSync('supabase/config.toml', config);

    const ports = getSupabasePorts();

    expect(ports).toEqual({
      api: 55000,
      studio: 55001,
    });
  });

  it('should handle config with additional sections between api and studio', () => {
    const config = `
[api]
port = 55000
enabled = true

[db]
port = 54322

[studio]
port = 55001
enabled = true
`;

    writeFileSync('supabase/config.toml', config);

    const ports = getSupabasePorts();

    expect(ports).toEqual({
      api: 55000,
      studio: 55001,
    });
  });

  it('should fall back to defaults if config cannot be parsed', () => {
    // Write invalid TOML that won't match our regex
    writeFileSync('supabase/config.toml', 'invalid content!!!');

    const ports = getSupabasePorts();

    expect(ports).toEqual({
      api: 54321,
      studio: 54323,
    });
  });

  it('should handle missing port fields gracefully', () => {
    const config = `
[api]
enabled = true
# No port specified

[studio]
enabled = true
# No port specified
`;

    writeFileSync('supabase/config.toml', config);

    const ports = getSupabasePorts();

    expect(ports).toEqual({
      api: 54321,
      studio: 54323,
    });
  });
});
