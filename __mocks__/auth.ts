/**
 * Auto-mock for @/auth (Auth.js v5 config) — Issue #200
 *
 * Bridges auth() to next-auth's getServerSession mock so existing tests
 * that control sessions via `mockGetServerSession` continue to work.
 */

// Import the (potentially mocked) getServerSession from next-auth
// This allows tests that jest.mock("next-auth") to control auth() behavior
const { getServerSession } = jest.requireMock("next-auth");

export const auth = (...args: unknown[]) => getServerSession(...args);
export const signIn = jest.fn();
export const signOut = jest.fn();
export const handlers = { GET: jest.fn(), POST: jest.fn() };

export default jest.fn(() => ({
  handlers,
  auth,
  signIn,
  signOut,
}));
