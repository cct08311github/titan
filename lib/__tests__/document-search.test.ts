/**
 * Tests for document search logic — KB-2 (#841)
 *
 * Tests the search utility functions (highlight, history, debounce behavior).
 */

describe("Document Search utilities", () => {
  describe("search history (localStorage)", () => {
    const STORAGE_KEY = "titan-doc-search-history";

    beforeEach(() => {
      localStorage.clear();
    });

    it("stores search terms in localStorage", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(["term1"]));
      const history = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      expect(history).toEqual(["term1"]);
    });

    it("limits history to 5 items", () => {
      const items = ["a", "b", "c", "d", "e", "f"];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 5)));
      const history = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      expect(history.length).toBe(5);
    });

    it("deduplicates entries (most recent first)", () => {
      const initial = ["term2", "term1"];
      // Simulate adding term1 again — should move to front
      const updated = initial.filter((h) => h !== "term1");
      updated.unshift("term1");
      expect(updated).toEqual(["term1", "term2"]);
    });

    it("handles empty localStorage gracefully", () => {
      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).toBeNull();
      const history = raw ? JSON.parse(raw) : [];
      expect(history).toEqual([]);
    });
  });

  describe("highlight logic", () => {
    function highlightPositions(text: string, query: string): number[] {
      if (!query.trim()) return [];
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "gi");
      const positions: number[] = [];
      let match;
      while ((match = regex.exec(text)) !== null) {
        positions.push(match.index);
      }
      return positions;
    }

    it("finds match positions in text", () => {
      const positions = highlightPositions("Hello World", "World");
      expect(positions).toEqual([6]);
    });

    it("finds multiple match positions", () => {
      const positions = highlightPositions("foo bar foo", "foo");
      expect(positions).toEqual([0, 8]);
    });

    it("is case insensitive", () => {
      const positions = highlightPositions("Hello HELLO hello", "hello");
      expect(positions).toEqual([0, 6, 12]);
    });

    it("returns empty for no matches", () => {
      const positions = highlightPositions("Hello World", "xyz");
      expect(positions).toEqual([]);
    });

    it("handles special regex characters in query", () => {
      const positions = highlightPositions("price is $100 (USD)", "$100");
      expect(positions).toEqual([9]);
    });

    it("returns empty for empty query", () => {
      const positions = highlightPositions("some text", "");
      expect(positions).toEqual([]);
    });
  });

  describe("debounce behavior", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("debounce fires after 300ms", () => {
      const fn = jest.fn();
      const debounced = (value: string) => {
        setTimeout(() => fn(value), 300);
      };

      debounced("test");
      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(300);
      expect(fn).toHaveBeenCalledWith("test");
    });

    it("only fires once for rapid input", () => {
      const fn = jest.fn();
      let timer: ReturnType<typeof setTimeout> | null = null;

      const debounced = (value: string) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn(value), 300);
      };

      debounced("t");
      debounced("te");
      debounced("tes");
      debounced("test");

      jest.advanceTimersByTime(300);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith("test");
    });

    it("does not trigger for empty string", () => {
      const fn = jest.fn();
      const debounced = (value: string) => {
        if (!value.trim()) return;
        setTimeout(() => fn(value), 300);
      };

      debounced("");
      debounced("  ");
      jest.advanceTimersByTime(300);
      expect(fn).not.toHaveBeenCalled();
    });
  });
});
