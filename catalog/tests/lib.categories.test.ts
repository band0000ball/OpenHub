import { describe, it, expect } from "vitest";
import {
  CATEGORIES,
  BROWSE_LIMIT_PER_CATEGORY,
  BROWSE_LIMIT_SINGLE,
  findCategory,
} from "../lib/categories";

describe("CATEGORIES", () => {
  it("has 6 entries", () => {
    expect(CATEGORIES).toHaveLength(6);
  });

  it("first entry is 全て (all)", () => {
    expect(CATEGORIES[0].id).toBe("all");
    expect(CATEGORIES[0].label).toBe("全て");
  });

  it("all non-all entries have a non-empty keyword", () => {
    CATEGORIES.filter((c) => c.id !== "all").forEach((c) => {
      expect(c.keyword).not.toBe("");
    });
  });

  it("includes expected category ids", () => {
    const ids = CATEGORIES.map((c) => c.id);
    expect(ids).toContain("population");
    expect(ids).toContain("economy");
    expect(ids).toContain("environment");
    expect(ids).toContain("education");
    expect(ids).toContain("healthcare");
  });
});

describe("findCategory", () => {
  it("returns matching category by id", () => {
    const cat = findCategory("population");
    expect(cat.label).toBe("人口・世帯");
    expect(cat.keyword).toBe("人口");
  });

  it("returns 全て for unknown id", () => {
    expect(findCategory("unknown").id).toBe("all");
  });

  it("returns 全て when called with all", () => {
    expect(findCategory("all").id).toBe("all");
  });
});

describe("constants", () => {
  it("BROWSE_LIMIT_PER_CATEGORY is 4", () => {
    expect(BROWSE_LIMIT_PER_CATEGORY).toBe(4);
  });

  it("BROWSE_LIMIT_SINGLE is 20", () => {
    expect(BROWSE_LIMIT_SINGLE).toBe(20);
  });
});
