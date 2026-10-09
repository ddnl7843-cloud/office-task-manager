import assert from 'node:assert/strict';
import test from 'node:test';
import { validateSignupRequest } from './signup';

test('signup requests create employee accounts that need admin approval', () => {
  assert.deepEqual(validateSignupRequest({
    name: '  Asha Patel ',
    email: ' ASHA@PAISAFIN.COM ',
    password: 'a-safe-password',
    role: 'ADMIN',
    status: 'ACTIVE',
  }).request, {
    name: 'Asha Patel',
    email: 'asha@paisafin.com',
    password: 'a-safe-password',
    role: 'EMPLOYEE',
    status: 'PENDING',
  });
});

test('signup rejects invalid addresses, short passwords, and oversized input', () => {
  assert.ok(validateSignupRequest({ name: 'Asha', email: 'invalid', password: 'a-safe-password' }).error);
  assert.ok(validateSignupRequest({ name: 'Asha', email: 'asha@example.com', password: 'short' }).error);
  assert.ok(validateSignupRequest({ name: 'x'.repeat(101), email: 'asha@example.com', password: 'a-safe-password' }).error);
});
