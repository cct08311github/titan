import "@testing-library/jest-dom";

// Auto-mock @/auth for all tests (Auth.js v5 migration — Issue #200)
// Tests that need to control the session should override via:
//   jest.mock("@/auth", () => ({ auth: jest.fn().mockResolvedValue(...) }))
// or directly: (auth as jest.Mock).mockResolvedValue(...)
jest.mock("@/auth");
