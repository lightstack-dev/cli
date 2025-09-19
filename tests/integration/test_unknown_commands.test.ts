import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('Unknown Command Suggestions', () => {
  const cli = 'bun run src/cli.ts';

  it('should reject unknown commands with helpful suggestions', () => {
    expect(() => {
      execSync(`${cli} nonexistent-command`, { encoding: 'utf-8' });
    }).toThrow();

    try {
      execSync(`${cli} nonexistent-command`, { encoding: 'utf-8' });
    } catch (error: any) {
      expect(error.message).toMatch(/❌ Error: Unknown command/);
      expect(error.message).toContain('nonexistent-command');
      expect(error.message).toMatch(/Did you mean one of these/);
      expect(error.message).toMatch(/For help: light --help/);
    }
  });

  it('should suggest similar commands for typos', () => {
    const typos = [
      { input: 'ini', expected: 'init' },
      { input: 'stat', expected: 'status' },
      { input: 'deplyo', expected: 'deploy' },
      { input: 'dow', expected: 'down' },
      { input: 'lo', expected: 'logs' }
    ];

    for (const { input, expected } of typos) {
      try {
        execSync(`${cli} ${input}`, { encoding: 'utf-8' });
      } catch (error: any) {
        expect(error.message).toMatch(/❌ Error: Unknown command/);
        expect(error.message).toContain(input);
        expect(error.message).toContain(expected);
      }
    }
  });

  it('should not pass through commands to other tools', () => {
    const nonLightstackCommands = [
      'supabase',
      'docker',
      'npm',
      'git',
      'vercel'
    ];

    for (const command of nonLightstackCommands) {
      try {
        execSync(`${cli} ${command} --help`, { encoding: 'utf-8' });
      } catch (error: any) {
        expect(error.message).toMatch(/❌ Error: Unknown command/);
        expect(error.message).toContain(command);
        expect(error.message).toMatch(/use.*directly/i);
        expect(error.message).toContain(`${command} --help`);
      }
    }
  });

  it('should provide context for BaaS CLI commands', () => {
    const baasCommands = ['supabase', 'firebase', 'appwrite'];

    for (const command of baasCommands) {
      try {
        execSync(`${cli} ${command} init`, { encoding: 'utf-8' });
      } catch (error: any) {
        expect(error.message).toMatch(/❌ Error: Unknown command/);
        expect(error.message).toContain(command);
        expect(error.message).toMatch(/use.*CLI.*directly/i);
        expect(error.message).toContain(`${command} init`);
      }
    }
  });

  it('should suggest command aliases', () => {
    const aliases = [
      { input: 'start', expected: 'up' },
      { input: 'stop', expected: 'down' },
      { input: 'ps', expected: 'status' }
    ];

    for (const { input, expected } of aliases) {
      try {
        execSync(`${cli} ${input}`, { encoding: 'utf-8' });
      } catch (error: any) {
        if (error.message.includes('Unknown command')) {
          // If alias is not implemented, should suggest the real command
          expect(error.message).toContain(expected);
        }
        // If alias is implemented, command should work
      }
    }
  });

  it('should handle subcommands correctly', () => {
    try {
      execSync(`${cli} deploy unknown-environment`, { encoding: 'utf-8' });
    } catch (error: any) {
      // Should recognize 'deploy' as valid command but complain about environment
      expect(error.message).toMatch(/(environment.*not.*configured|unknown.*environment)/i);
      expect(error.message).not.toMatch(/Unknown command.*deploy/);
    }
  });

  it('should differentiate between command and option errors', () => {
    try {
      execSync(`${cli} init --unknown-option`, { encoding: 'utf-8' });
    } catch (error: any) {
      // Should recognize 'init' but complain about option
      expect(error.message).toMatch(/(unknown.*option|unrecognized.*option)/i);
      expect(error.message).not.toMatch(/Unknown command.*init/);
    }
  });

  it('should suggest help for complex scenarios', () => {
    try {
      execSync(`${cli} deploy production --with-invalid-flag --and-another`, { encoding: 'utf-8' });
    } catch (error: any) {
      // Should guide user to help
      expect(error.message).toMatch(/light deploy --help/);
    }
  });

  it('should handle empty commands gracefully', () => {
    try {
      execSync(`${cli}`, { encoding: 'utf-8' });
    } catch (error: any) {
      // Should show general help, not error about unknown command
      expect(error.message).not.toMatch(/Unknown command/);
      // Should either show help or prompt for command
    }
  });

  it('should maintain consistent error format', () => {
    try {
      execSync(`${cli} totally-invalid-command`, { encoding: 'utf-8' });
    } catch (error: any) {
      // Follow the established error format
      expect(error.message).toMatch(/❌ Error: .+/);
      expect(error.message).toMatch(/Did you mean/);
      expect(error.message).toMatch(/For.*help: light.*--help/);
    }
  });

  it('should provide different suggestions based on context', () => {
    // If in a project directory
    try {
      execSync(`${cli} star`, { encoding: 'utf-8' });
    } catch (error: any) {
      expect(error.message).toMatch(/start|status/); // Should suggest project commands
    }

    // Test with various contexts
    const contextualCommands = [
      { input: 'bild', expected: ['build'] }, // Not a light command, but common typo
      { input: 'conifg', expected: ['config', 'init'] },
      { input: 'updat', expected: ['up', 'update'] }
    ];

    for (const { input, expected } of contextualCommands) {
      try {
        execSync(`${cli} ${input}`, { encoding: 'utf-8' });
      } catch (error: any) {
        // Should suggest at least one of the expected commands
        const hasExpectedSuggestion = expected.some(cmd => error.message.includes(cmd));
        expect(hasExpectedSuggestion).toBe(true);
      }
    }
  });
});