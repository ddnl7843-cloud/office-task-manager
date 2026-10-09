export interface SignupRequest {
  name: string;
  email: string;
  password: string;
  role: 'EMPLOYEE';
  status: 'PENDING';
}

export function validateSignupRequest(input: unknown): { request?: SignupRequest; error?: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'Enter your name, email address, and password' };
  }
  const body = input as Record<string, unknown>;
  const { name, email, password } = body;
  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' ||
    !name.trim() || !email.trim() || !password) {
    return { error: 'Enter your name, email address, and password' };
  }
  const normalizedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedName.length > 100) return { error: 'Name must be 100 characters or fewer' };
  if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { error: 'Enter a valid email address' };
  }
  if (password.length < 10 || password.length > 128) {
    return { error: 'Password must be between 10 and 128 characters' };
  }
  return {
    request: {
      name: normalizedName,
      email: normalizedEmail,
      password,
      role: 'EMPLOYEE',
      status: 'PENDING',
    },
  };
}
