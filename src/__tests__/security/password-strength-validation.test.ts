import { describe, it, expect } from 'vitest';
import { validatePassword, getStrengthColor, getStrengthBarWidth, getStrengthBarColor } from '../../lib/passwordValidation';

describe('Password strength validation (fix-009)', () => {
  describe('validatePassword', () => {
    it('should reject empty password', () => {
      const result = validatePassword('');
      expect(result.isValid).toBe(false);
      expect(result.strength).toBe('weak');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject password shorter than 8 characters', () => {
      const result = validatePassword('Abc1!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters');
    });

    it('should reject password with only lowercase letters', () => {
      const result = validatePassword('abcdefghij');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password with no uppercase letters', () => {
      const result = validatePassword('abcdefg1!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password with no numbers', () => {
      const result = validatePassword('Abcdefgh!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should accept password meeting minimum requirements (length + lower + upper + number)', () => {
      const result = validatePassword('Abcdefg1');
      expect(result.isValid).toBe(true);
    });

    it('should rate strong password with all criteria plus length bonus', () => {
      const result = validatePassword('MyStr0ng!Pass99');
      expect(result.isValid).toBe(true);
      expect(result.strength).toBe('strong');
      expect(result.errors).toHaveLength(0);
    });

    it('should reject common weak passwords', () => {
      const weakPasswords = ['password', '12345678', 'qwerty123', 'abcdefgh'];
      for (const pw of weakPasswords) {
        const result = validatePassword(pw);
        expect(result.isValid).toBe(false);
      }
    });

    it('should treat special characters as optional but improve strength', () => {
      const withoutSpecial = validatePassword('Abcdefg1');
      const withSpecial = validatePassword('Abcdefg1!');
      expect(withSpecial.score).toBeGreaterThan(withoutSpecial.score);
    });
  });

  describe('strength display helpers', () => {
    it('should return correct color classes for each strength level', () => {
      expect(getStrengthColor('weak')).toContain('red');
      expect(getStrengthColor('fair')).toContain('orange');
      expect(getStrengthColor('good')).toContain('yellow');
      expect(getStrengthColor('strong')).toContain('green');
    });

    it('should return correct bar widths for each strength level', () => {
      expect(getStrengthBarWidth('weak')).toBe('w-1/4');
      expect(getStrengthBarWidth('fair')).toBe('w-2/4');
      expect(getStrengthBarWidth('good')).toBe('w-3/4');
      expect(getStrengthBarWidth('strong')).toBe('w-full');
    });

    it('should return correct bar colors for each strength level', () => {
      expect(getStrengthBarColor('weak')).toContain('red');
      expect(getStrengthBarColor('fair')).toContain('orange');
      expect(getStrengthBarColor('good')).toContain('yellow');
      expect(getStrengthBarColor('strong')).toContain('green');
    });
  });
});
