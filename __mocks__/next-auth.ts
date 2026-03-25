/**
 * Mock next-auth for tests — supports both v4 and v5 patterns.
 *
 * Auth.js v5 migration (Issue #200):
 * - getServerSession is kept for backward compatibility with existing tests
 * - The @/auth mock (__mocks__/auth.ts) delegates to this getServerSession
 */
const mockSession = {
  user: {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    role: "MEMBER",
  },
  expires: "2099-01-01",
};

export const getServerSession = jest.fn(() => Promise.resolve(mockSession));

// Client-side exports (next-auth/react)
export const useSession = jest.fn(() => ({
  data: mockSession,
  status: "authenticated",
}));

export const signIn = jest.fn();
export const signOut = jest.fn();

export default {
  getServerSession,
  useSession,
  signIn,
  signOut,
};
