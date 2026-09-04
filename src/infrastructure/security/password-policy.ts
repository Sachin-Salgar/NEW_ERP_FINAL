export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSymbol: true,
};

export function validatePassword(password: string, policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY): string[] {
  const issues: string[] = [];

  if (password.length < policy.minLength) {
    issues.push(`Password must be at least ${policy.minLength} characters long.`);
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    issues.push('Password must contain at least one uppercase character.');
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    issues.push('Password must contain at least one lowercase character.');
  }
  if (policy.requireNumber && !/\d/.test(password)) {
    issues.push('Password must contain at least one number.');
  }
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    issues.push('Password must contain at least one symbol.');
  }

  return issues;
}
