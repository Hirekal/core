import { dummyUsers } from '../data/dummyUsers';

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

const AUTH_KEY = 'hirekal_auth';
const LEGACY_AUTH_KEY = 'talently_auth';
const resetTokensStore = new Map();

function createResetToken() {
  return `reset-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function login(email, password) {
  await delay(500);
  const user = dummyUsers.find((u) => u.email === email);
  if (!user || password.length < 4) {
    throw new Error('Invalid email or password');
  }
  const session = { user, token: `mock-token-${Date.now()}` };
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  return session;
}

export async function signUp(name, email, password) {
  await delay(500);
  if (!name || !email || password.length < 8) {
    throw new Error('Please fill in all fields correctly');
  }
  const user = { id: `user-${Date.now()}`, name, email, role: 'admin', organization: 'My Organization', theme: 'light' };
  const session = { user, token: `mock-token-${Date.now()}` };
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  return session;
}

export async function requestPasswordReset(email) {
  await delay(500);
  if (!email) throw new Error('Email is required');

  const normalizedEmail = email.trim().toLowerCase();
  const token = createResetToken();

  resetTokensStore.set(normalizedEmail, {
    token,
    createdAt: Date.now(),
  });

  const resetUrl = `/reset-password?email=${encodeURIComponent(normalizedEmail)}&token=${encodeURIComponent(token)}`;
  void resetUrl;

  return {
    success: true,
    message: 'Reset link sent to your email',
  };
}

export async function verifyResetToken(token, email) {
  await delay(300);
  if (!token || !email) throw new Error('Invalid or expired reset link');

  const stored = resetTokensStore.get(email.trim().toLowerCase());
  if (!stored || stored.token !== token) {
    throw new Error('Invalid or expired reset link');
  }

  return { valid: true };
}

export async function resetPassword(token, password, email) {
  await delay(500);
  if (!token || !email || password.length < 8) throw new Error('Invalid request');

  const normalizedEmail = email.trim().toLowerCase();
  const stored = resetTokensStore.get(normalizedEmail);
  if (!stored || stored.token !== token) {
    throw new Error('Invalid or expired reset link');
  }

  resetTokensStore.delete(normalizedEmail);
  return { success: true };
}

export async function getCurrentUser() {
  await delay(100);
  let stored = localStorage.getItem(AUTH_KEY);
  if (!stored) {
    const legacy = localStorage.getItem(LEGACY_AUTH_KEY);
    if (legacy) {
      localStorage.setItem(AUTH_KEY, legacy);
      localStorage.removeItem(LEGACY_AUTH_KEY);
      stored = legacy;
    }
  }
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export async function logout() {
  await delay(100);
  localStorage.removeItem(AUTH_KEY);
}

export async function updateProfile(userId, data) {
  await delay(400);
  void userId;
  const stored = localStorage.getItem(AUTH_KEY);
  if (!stored) throw new Error('Not authenticated');
  const session = JSON.parse(stored);
  session.user = { ...session.user, ...data };
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  return session.user;
}

export async function changePassword(currentPassword, newPassword) {
  await delay(400);
  if (!currentPassword || newPassword.length < 8) {
    throw new Error('Please provide valid passwords');
  }
  return { success: true };
}
