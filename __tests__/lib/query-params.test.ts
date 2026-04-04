import {
  InvalidParamError,
  parseYear,
  parseYearOptional,
  parseMonth,
  parseQuarter,
  parsePage,
  parseLimit,
  parseOffset,
} from "@/lib/query-params";

// ─── InvalidParamError ────────────────────────────────────────────────────────

describe("InvalidParamError", () => {
  it("is an instance of Error", () => {
    const err = new InvalidParamError("year", "abc", "hint");
    expect(err).toBeInstanceOf(Error);
  });

  it("has the correct name", () => {
    const err = new InvalidParamError("year", "abc", "hint");
    expect(err.name).toBe("InvalidParamError");
  });

  it("exposes param and value properties", () => {
    const err = new InvalidParamError("month", "99", "hint");
    expect(err.param).toBe("month");
    expect(err.value).toBe("99");
  });

  it("message contains 參數 (Chinese)", () => {
    const err = new InvalidParamError("page", "-1", "hint");
    expect(err.message).toContain("參數");
  });

  it("message includes the param name and value", () => {
    const err = new InvalidParamError("limit", "999", "some hint");
    expect(err.message).toContain("limit");
    expect(err.message).toContain("999");
  });
});

// ─── parseYear ────────────────────────────────────────────────────────────────

describe("parseYear", () => {
  const currentYear = new Date().getFullYear();

  describe("absent / empty input → default", () => {
    it("returns current year for null", () => {
      expect(parseYear(null)).toBe(currentYear);
    });

    it("returns current year for undefined", () => {
      expect(parseYear(undefined)).toBe(currentYear);
    });

    it("returns current year for empty string", () => {
      expect(parseYear("")).toBe(currentYear);
    });

    it("returns custom fallback for null when fallback provided", () => {
      expect(parseYear(null, 2023)).toBe(2023);
    });

    it("returns custom fallback for undefined when fallback provided", () => {
      expect(parseYear(undefined, 2030)).toBe(2030);
    });

    it("returns custom fallback for empty string when fallback provided", () => {
      expect(parseYear("", 2025)).toBe(2025);
    });
  });

  describe("valid input → parsed number", () => {
    it("parses lower boundary 2000", () => {
      expect(parseYear("2000")).toBe(2000);
    });

    it("parses upper boundary 2100", () => {
      expect(parseYear("2100")).toBe(2100);
    });

    it("parses a mid-range year", () => {
      expect(parseYear("2024")).toBe(2024);
    });
  });

  describe("invalid input → throws InvalidParamError", () => {
    it("throws for year below 2000", () => {
      expect(() => parseYear("1999")).toThrow(InvalidParamError);
    });

    it("throws for year above 2100", () => {
      expect(() => parseYear("2101")).toThrow(InvalidParamError);
    });

    it("throws for non-numeric string", () => {
      expect(() => parseYear("abc")).toThrow(InvalidParamError);
    });

    it("throws for year 0", () => {
      expect(() => parseYear("0")).toThrow(InvalidParamError);
    });

    it("thrown error carries correct param", () => {
      try {
        parseYear("1999");
      } catch (e) {
        expect(e).toBeInstanceOf(InvalidParamError);
        expect((e as InvalidParamError).param).toBe("year");
      }
    });

    it("thrown error carries the raw value", () => {
      try {
        parseYear("abc");
      } catch (e) {
        expect((e as InvalidParamError).value).toBe("abc");
      }
    });
  });
});

// ─── parseYearOptional ────────────────────────────────────────────────────────

describe("parseYearOptional", () => {
  describe("absent / empty input → undefined", () => {
    it("returns undefined for null", () => {
      expect(parseYearOptional(null)).toBeUndefined();
    });

    it("returns undefined for undefined", () => {
      expect(parseYearOptional(undefined)).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
      expect(parseYearOptional("")).toBeUndefined();
    });
  });

  describe("valid input → parsed number", () => {
    it("parses lower boundary 2000", () => {
      expect(parseYearOptional("2000")).toBe(2000);
    });

    it("parses upper boundary 2100", () => {
      expect(parseYearOptional("2100")).toBe(2100);
    });

    it("parses a mid-range year", () => {
      expect(parseYearOptional("2026")).toBe(2026);
    });
  });

  describe("invalid input → throws InvalidParamError", () => {
    it("throws for year 1999", () => {
      expect(() => parseYearOptional("1999")).toThrow(InvalidParamError);
    });

    it("throws for year 2101", () => {
      expect(() => parseYearOptional("2101")).toThrow(InvalidParamError);
    });

    it("throws for non-numeric string", () => {
      expect(() => parseYearOptional("xyz")).toThrow(InvalidParamError);
    });
  });
});

// ─── parseMonth ───────────────────────────────────────────────────────────────

describe("parseMonth", () => {
  describe("absent / empty input → undefined", () => {
    it("returns undefined for null", () => {
      expect(parseMonth(null)).toBeUndefined();
    });

    it("returns undefined for undefined", () => {
      expect(parseMonth(undefined)).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
      expect(parseMonth("")).toBeUndefined();
    });
  });

  describe("valid input → parsed number", () => {
    it("parses lower boundary 1", () => {
      expect(parseMonth("1")).toBe(1);
    });

    it("parses upper boundary 12", () => {
      expect(parseMonth("12")).toBe(12);
    });

    it("parses a mid-range month", () => {
      expect(parseMonth("6")).toBe(6);
    });
  });

  describe("invalid input → throws InvalidParamError", () => {
    it("throws for month 0 (below range)", () => {
      expect(() => parseMonth("0")).toThrow(InvalidParamError);
    });

    it("throws for month 13 (above range)", () => {
      expect(() => parseMonth("13")).toThrow(InvalidParamError);
    });

    it("throws for negative month", () => {
      expect(() => parseMonth("-1")).toThrow(InvalidParamError);
    });

    it("throws for non-numeric string", () => {
      expect(() => parseMonth("jan")).toThrow(InvalidParamError);
    });

    it("thrown error carries correct param name", () => {
      try {
        parseMonth("0");
      } catch (e) {
        expect((e as InvalidParamError).param).toBe("month");
      }
    });

    it("thrown error carries raw value", () => {
      try {
        parseMonth("13");
      } catch (e) {
        expect((e as InvalidParamError).value).toBe("13");
      }
    });
  });
});

// ─── parseQuarter ─────────────────────────────────────────────────────────────

describe("parseQuarter", () => {
  describe("absent / empty input → default", () => {
    it("returns 1 (default) for null", () => {
      expect(parseQuarter(null)).toBe(1);
    });

    it("returns 1 (default) for undefined", () => {
      expect(parseQuarter(undefined)).toBe(1);
    });

    it("returns 1 (default) for empty string", () => {
      expect(parseQuarter("")).toBe(1);
    });

    it("returns custom fallback for null", () => {
      expect(parseQuarter(null, 3)).toBe(3);
    });

    it("returns custom fallback for empty string", () => {
      expect(parseQuarter("", 2)).toBe(2);
    });
  });

  describe("valid input → parsed number", () => {
    it("parses lower boundary 1", () => {
      expect(parseQuarter("1")).toBe(1);
    });

    it("parses upper boundary 4", () => {
      expect(parseQuarter("4")).toBe(4);
    });

    it("parses mid-range value 2", () => {
      expect(parseQuarter("2")).toBe(2);
    });

    it("parses mid-range value 3", () => {
      expect(parseQuarter("3")).toBe(3);
    });
  });

  describe("invalid input → throws InvalidParamError", () => {
    it("throws for quarter 0 (below range)", () => {
      expect(() => parseQuarter("0")).toThrow(InvalidParamError);
    });

    it("throws for quarter 5 (above range)", () => {
      expect(() => parseQuarter("5")).toThrow(InvalidParamError);
    });

    it("throws for negative value", () => {
      expect(() => parseQuarter("-1")).toThrow(InvalidParamError);
    });

    it("throws for non-numeric string", () => {
      expect(() => parseQuarter("Q1")).toThrow(InvalidParamError);
    });

    it("thrown error carries correct param name", () => {
      try {
        parseQuarter("5");
      } catch (e) {
        expect((e as InvalidParamError).param).toBe("quarter");
      }
    });
  });
});

// ─── parsePage ────────────────────────────────────────────────────────────────

describe("parsePage", () => {
  describe("absent / empty input → default 1", () => {
    it("returns 1 for null", () => {
      expect(parsePage(null)).toBe(1);
    });

    it("returns 1 for undefined", () => {
      expect(parsePage(undefined)).toBe(1);
    });

    it("returns 1 for empty string", () => {
      expect(parsePage("")).toBe(1);
    });
  });

  describe("valid input → parsed number", () => {
    it("parses page 1 (minimum valid)", () => {
      expect(parsePage("1")).toBe(1);
    });

    it("parses large page number", () => {
      expect(parsePage("100")).toBe(100);
    });

    it("parses page 2", () => {
      expect(parsePage("2")).toBe(2);
    });
  });

  describe("invalid input → throws InvalidParamError", () => {
    it("throws for page 0", () => {
      expect(() => parsePage("0")).toThrow(InvalidParamError);
    });

    it("throws for negative page", () => {
      expect(() => parsePage("-1")).toThrow(InvalidParamError);
    });

    it("throws for non-numeric string", () => {
      expect(() => parsePage("one")).toThrow(InvalidParamError);
    });

    it("thrown error carries correct param name", () => {
      try {
        parsePage("0");
      } catch (e) {
        expect((e as InvalidParamError).param).toBe("page");
      }
    });

    it("thrown error carries raw value", () => {
      try {
        parsePage("-5");
      } catch (e) {
        expect((e as InvalidParamError).value).toBe("-5");
      }
    });
  });
});

// ─── parseLimit ───────────────────────────────────────────────────────────────

describe("parseLimit", () => {
  describe("absent / empty input → default 50", () => {
    it("returns 50 for null", () => {
      expect(parseLimit(null)).toBe(50);
    });

    it("returns 50 for undefined", () => {
      expect(parseLimit(undefined)).toBe(50);
    });

    it("returns 50 for empty string", () => {
      expect(parseLimit("")).toBe(50);
    });
  });

  describe("custom defaultVal", () => {
    it("returns custom default for null", () => {
      expect(parseLimit(null, 20)).toBe(20);
    });

    it("returns custom default for empty string", () => {
      expect(parseLimit("", 100)).toBe(100);
    });
  });

  describe("valid input → parsed number", () => {
    it("parses lower boundary 1", () => {
      expect(parseLimit("1")).toBe(1);
    });

    it("parses default max boundary 500", () => {
      expect(parseLimit("500")).toBe(500);
    });

    it("parses a mid-range value", () => {
      expect(parseLimit("50")).toBe(50);
    });

    it("parses value within custom max", () => {
      expect(parseLimit("100", 50, 200)).toBe(100);
    });
  });

  describe("custom max parameter", () => {
    it("accepts value equal to custom max", () => {
      expect(parseLimit("10", 5, 10)).toBe(10);
    });

    it("throws for value exceeding custom max", () => {
      expect(() => parseLimit("11", 5, 10)).toThrow(InvalidParamError);
    });
  });

  describe("invalid input → throws InvalidParamError", () => {
    it("throws for limit 0", () => {
      expect(() => parseLimit("0")).toThrow(InvalidParamError);
    });

    it("throws for limit 501 (exceeds default max 500)", () => {
      expect(() => parseLimit("501")).toThrow(InvalidParamError);
    });

    it("throws for negative limit", () => {
      expect(() => parseLimit("-1")).toThrow(InvalidParamError);
    });

    it("throws for non-numeric string", () => {
      expect(() => parseLimit("many")).toThrow(InvalidParamError);
    });

    it("thrown error carries correct param name", () => {
      try {
        parseLimit("0");
      } catch (e) {
        expect((e as InvalidParamError).param).toBe("limit");
      }
    });

    it("thrown error carries raw value", () => {
      try {
        parseLimit("501");
      } catch (e) {
        expect((e as InvalidParamError).value).toBe("501");
      }
    });
  });
});

// ─── parseOffset ──────────────────────────────────────────────────────────────

describe("parseOffset", () => {
  describe("absent / empty input → default 0", () => {
    it("returns 0 for null", () => {
      expect(parseOffset(null)).toBe(0);
    });

    it("returns 0 for undefined", () => {
      expect(parseOffset(undefined)).toBe(0);
    });

    it("returns 0 for empty string", () => {
      expect(parseOffset("")).toBe(0);
    });
  });

  describe("valid input → parsed number", () => {
    it("parses 0 (minimum valid)", () => {
      expect(parseOffset("0")).toBe(0);
    });

    it("parses a positive offset", () => {
      expect(parseOffset("50")).toBe(50);
    });

    it("parses a large offset", () => {
      expect(parseOffset("10000")).toBe(10000);
    });
  });

  describe("invalid input → throws InvalidParamError", () => {
    it("throws for negative offset", () => {
      expect(() => parseOffset("-1")).toThrow(InvalidParamError);
    });

    it("throws for non-numeric string", () => {
      expect(() => parseOffset("abc")).toThrow(InvalidParamError);
    });

    it("thrown error carries correct param name", () => {
      try {
        parseOffset("-1");
      } catch (e) {
        expect((e as InvalidParamError).param).toBe("offset");
      }
    });

    it("thrown error carries raw value", () => {
      try {
        parseOffset("-100");
      } catch (e) {
        expect((e as InvalidParamError).value).toBe("-100");
      }
    });
  });
});
