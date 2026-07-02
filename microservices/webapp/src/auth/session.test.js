import test from 'node:test';
import assert from 'node:assert/strict';

// session.js expects browser globals; provide a minimal localStorage stub.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { isTokenValid, setSession, clearSession, getUser } = await import('./session.js');

function makeToken(payload) {
  const b64 = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.fake-signature`;
}

test('isTokenValid is false with no token', () => {
  clearSession();
  assert.equal(isTokenValid(), false);
});

test('isTokenValid is true for an unexpired token', () => {
  setSession(makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 }), { name: 'a' });
  assert.equal(isTokenValid(), true);
});

test('isTokenValid is false for an expired token', () => {
  setSession(makeToken({ exp: Math.floor(Date.now() / 1000) - 60 }), { name: 'a' });
  assert.equal(isTokenValid(), false);
});

test('isTokenValid is false for malformed tokens', () => {
  setSession('not-a-jwt', { name: 'a' });
  assert.equal(isTokenValid(), false);

  setSession(makeToken({ noExp: true }), { name: 'a' });
  assert.equal(isTokenValid(), false);
});

test('getUser survives corrupted storage', () => {
  localStorage.setItem('user', '{broken');
  assert.equal(getUser(), null);
});
