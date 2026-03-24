import { isPasswordExpired, daysUntilExpiry, PASSWORD_MAX_AGE_DAYS } from "../password-expiry";

describe("password-expiry", () => {
  describe("isPasswordExpired", () => {
    test("returns true for null date", () => {
      expect(isPasswordExpired(null)).toBe(true);
    });

    test("returns false for recently changed password", () => {
      expect(isPasswordExpired(new Date())).toBe(false);
    });

    test("returns true for password changed 91 days ago", () => {
      const old = new Date();
      old.setDate(old.getDate() - 91);
      expect(isPasswordExpired(old)).toBe(true);
    });

    test("returns false for password changed 89 days ago", () => {
      const recent = new Date();
      recent.setDate(recent.getDate() - 89);
      expect(isPasswordExpired(recent)).toBe(false);
    });
  });

  describe("daysUntilExpiry", () => {
    test("returns 0 for null date", () => {
      expect(daysUntilExpiry(null)).toBe(0);
    });

    test("returns ~90 for just-changed password", () => {
      const days = daysUntilExpiry(new Date());
      expect(days).toBeGreaterThanOrEqual(89);
      expect(days).toBeLessThanOrEqual(PASSWORD_MAX_AGE_DAYS);
    });

    test("returns 0 for expired password", () => {
      const old = new Date();
      old.setDate(old.getDate() - 100);
      expect(daysUntilExpiry(old)).toBe(0);
    });

    test("returns correct remaining days", () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const remaining = daysUntilExpiry(thirtyDaysAgo);
      expect(remaining).toBeGreaterThanOrEqual(59);
      expect(remaining).toBeLessThanOrEqual(61);
    });
  });
});
