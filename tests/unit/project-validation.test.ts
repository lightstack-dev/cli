import { describe, it, expect } from 'vitest';

// We need to extract the validation function to test it
// For now, let's test the validation logic directly
function isValidProjectName(name: string): boolean {
  // Same logic as in init.ts
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(name);
}

describe('Project Name Validation', () => {
  describe('valid project names', () => {
    it('should accept single character names', () => {
      expect(isValidProjectName('a')).toBe(true);
      expect(isValidProjectName('1')).toBe(true);
      expect(isValidProjectName('z')).toBe(true);
    });

    it('should accept names with hyphens', () => {
      expect(isValidProjectName('my-app')).toBe(true);
      expect(isValidProjectName('light-stack')).toBe(true);
      expect(isValidProjectName('web-app-2024')).toBe(true);
    });

    it('should accept names with numbers', () => {
      expect(isValidProjectName('app123')).toBe(true);
      expect(isValidProjectName('v1-api')).toBe(true);
      expect(isValidProjectName('2048-game')).toBe(true);
    });

    it('should accept common project patterns', () => {
      expect(isValidProjectName('nextjs-app')).toBe(true);
      expect(isValidProjectName('api-server')).toBe(true);
      expect(isValidProjectName('frontend')).toBe(true);
      expect(isValidProjectName('backend')).toBe(true);
    });
  });

  describe('invalid project names', () => {
    it('should reject names with uppercase letters', () => {
      expect(isValidProjectName('MyApp')).toBe(false);
      expect(isValidProjectName('UPPERCASE')).toBe(false);
      expect(isValidProjectName('camelCase')).toBe(false);
    });

    it('should reject names starting with hyphens', () => {
      expect(isValidProjectName('-myapp')).toBe(false);
      expect(isValidProjectName('-')).toBe(false);
    });

    it('should reject names ending with hyphens', () => {
      expect(isValidProjectName('myapp-')).toBe(false);
      expect(isValidProjectName('test-project-')).toBe(false);
    });

    it('should reject names with special characters', () => {
      expect(isValidProjectName('my_app')).toBe(false);
      expect(isValidProjectName('app.js')).toBe(false);
      expect(isValidProjectName('my@app')).toBe(false);
      expect(isValidProjectName('app space')).toBe(false);
    });

    it('should reject empty strings', () => {
      expect(isValidProjectName('')).toBe(false);
    });

    it('should allow names with consecutive hyphens (current regex behavior)', () => {
      // Note: Current regex allows consecutive hyphens - this documents actual behavior
      expect(isValidProjectName('my--app')).toBe(true);
      expect(isValidProjectName('test---project')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle very long names', () => {
      const longName = 'a'.repeat(100);
      expect(isValidProjectName(longName)).toBe(true);

      const longNameWithHyphens = 'a' + '-b'.repeat(50);
      expect(isValidProjectName(longNameWithHyphens)).toBe(true);
    });

    it('should handle names that look like version numbers', () => {
      expect(isValidProjectName('v1')).toBe(true);
      expect(isValidProjectName('2024')).toBe(true);
      expect(isValidProjectName('1-0-0')).toBe(true);
    });
  });
});