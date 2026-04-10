import "@testing-library/jest-dom";

// Use the __mocks__/isomorphic-dompurify.ts shim for all tests (#1326).
// isomorphic-dompurify bundles jsdom v29 which fails to initialise correctly
// inside Jest worker processes.  The shim creates a dedicated jsdom v26 window
// (already available via jest-environment-jsdom) and passes it to dompurify,
// giving every test environment a fully functional DOMPurify instance.
jest.mock("isomorphic-dompurify");

// Auto-mock @/auth for all tests (Auth.js v5 migration — Issue #200)
// Tests that need to control the session should override via:
//   jest.mock("@/auth", () => ({ auth: jest.fn().mockResolvedValue(...) }))
// or directly: (auth as jest.Mock).mockResolvedValue(...)
jest.mock("@/auth");

// Mock next/headers for all tests — Issue #1112
//
// requireAuth() calls `await headers()` to check for Bearer tokens.
// Next.js `headers()` requires a Request Store context that doesn't exist
// in Jest, causing `throwForMissingRequestStore` and 500 errors in all
// route handler tests.
//
// Default: return null for Authorization header → web session path (via @/auth mock above).
// Override per-test to simulate Bearer tokens:
//   (headers as jest.Mock).mockResolvedValue({ get: jest.fn().mockReturnValue("Bearer <token>") })
jest.mock("next/headers", () => ({
  headers: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue(null),
    has: jest.fn().mockReturnValue(false),
  }),
  cookies: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue(undefined),
    has: jest.fn().mockReturnValue(false),
    getAll: jest.fn().mockReturnValue([]),
  }),
}));
