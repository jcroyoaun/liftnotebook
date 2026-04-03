import test from 'node:test';
import assert from 'node:assert/strict';

import { formatAPIError } from './client.js';

test('formatAPIError returns plain string errors unchanged', () => {
  assert.equal(formatAPIError('duplicate email'), 'duplicate email');
});

test('formatAPIError serializes validation objects into readable lines', () => {
  assert.equal(
    formatAPIError({
      email: 'must be unique',
      password: 'must be at least 8 characters',
    }),
    'email: must be unique\npassword: must be at least 8 characters',
  );
});

test('formatAPIError falls back for empty payloads', () => {
  assert.equal(formatAPIError(null), 'Request failed');
});
