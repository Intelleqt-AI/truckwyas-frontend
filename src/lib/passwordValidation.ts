/**
 * Password strength validation utilities.
 * Enforces minimum length, complexity requirements, and provides user feedback.
 */

export interface PasswordValidationResult {
  isValid: boolean;
  strength: 'weak' | 'fair' | 'good' | 'strong';
  errors: string[];
  score: number; // 0-4
}

const MIN_LENGTH = 8;

const RULES: { test: (pw: string) => boolean; message: string }[] = [
  {
    test: (pw) => pw.length >= MIN_LENGTH,
    message: `Password must be at least ${MIN_LENGTH} characters`,
  },
  {
    test: (pw) => /[a-z]/.test(pw),
    message: 'Password must contain at least one lowercase letter',
  },
  {
    test: (pw) => /[A-Z]/.test(pw),
    message: 'Password must contain at least one uppercase letter',
  },
  {
    test: (pw) => /[0-9]/.test(pw),
    message: 'Password must contain at least one number',
  },
  {
    test: (pw) => /[^a-zA-Z0-9]/.test(pw),
    message: 'Password must contain at least one special character',
  },
];

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  let score = 0;

  for (const rule of RULES) {
    if (rule.test(password)) {
      score++;
    } else {
      errors.push(rule.message);
    }
  }

  // Bonus for length > 12
  if (password.length >= 12) {
    score = Math.min(score + 1, 5);
  }

  const strength = getStrengthLabel(score);
  // Valid requires at minimum: length + lowercase + uppercase + number (first 4 rules)
  const isValid = password.length >= MIN_LENGTH && /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password);

  return { isValid, strength, errors, score };
}

function getStrengthLabel(score: number): PasswordValidationResult['strength'] {
  if (score <= 2) return 'weak';
  if (score === 3) return 'fair';
  if (score === 4) return 'good';
  return 'strong';
}

export function getStrengthColor(strength: PasswordValidationResult['strength']): string {
  switch (strength) {
    case 'weak': return 'text-red-500';
    case 'fair': return 'text-orange-500';
    case 'good': return 'text-yellow-500';
    case 'strong': return 'text-green-500';
  }
}

export function getStrengthBarWidth(strength: PasswordValidationResult['strength']): string {
  switch (strength) {
    case 'weak': return 'w-1/4';
    case 'fair': return 'w-2/4';
    case 'good': return 'w-3/4';
    case 'strong': return 'w-full';
  }
}

export function getStrengthBarColor(strength: PasswordValidationResult['strength']): string {
  switch (strength) {
    case 'weak': return 'bg-red-500';
    case 'fair': return 'bg-orange-500';
    case 'good': return 'bg-yellow-500';
    case 'strong': return 'bg-green-500';
  }
}
