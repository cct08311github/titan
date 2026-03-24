/**
 * Shared mock setup for API route tests.
 *
 * Import this file in each API test BEFORE any other imports
 * using jest.mock() factory pattern to avoid circular deps.
 */

// These are set up via jest.mock() inline factories in each test file.
// This module just exports commonly reused mock data / session shapes.

export const MEMBER_SESSION = {
  user: { id: "user-1", name: "Test User", email: "test@example.com", role: "MEMBER" },
  expires: "2099-01-01",
};

export const MANAGER_SESSION = {
  user: { id: "mgr-1", name: "Manager", email: "mgr@example.com", role: "MANAGER" },
  expires: "2099-01-01",
};
