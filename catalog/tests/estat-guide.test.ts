import { describe, it, expect } from "vitest";
import {
  ESTAT_URLS,
  ESTAT_GUIDE_STEPS,
  ESTAT_GUIDE_LAST_VERIFIED,
} from "../lib/estat-guide";

describe("estat-guide 定数", () => {
  describe("ESTAT_URLS", () => {
    it("registration キーが https:// で始まる URL を持つ", () => {
      expect(ESTAT_URLS.registration).toMatch(/^https:\/\//);
    });

    it("apiTop キーが https:// で始まる URL を持つ", () => {
      expect(ESTAT_URLS.apiTop).toMatch(/^https:\/\//);
    });
  });

  describe("ESTAT_GUIDE_STEPS", () => {
    it("3〜4 ステップが定義されている", () => {
      expect(ESTAT_GUIDE_STEPS.length).toBeGreaterThanOrEqual(3);
      expect(ESTAT_GUIDE_STEPS.length).toBeLessThanOrEqual(4);
    });

    it("各ステップに step（番号）と text（説明）がある", () => {
      for (const s of ESTAT_GUIDE_STEPS) {
        expect(typeof s.step).toBe("number");
        expect(typeof s.text).toBe("string");
        expect(s.text.length).toBeGreaterThan(0);
      }
    });

    it("step 番号が 1 から連番になっている", () => {
      ESTAT_GUIDE_STEPS.forEach((s, i) => {
        expect(s.step).toBe(i + 1);
      });
    });
  });

  describe("ESTAT_GUIDE_LAST_VERIFIED", () => {
    it("YYYY-MM-DD 形式の文字列である", () => {
      expect(ESTAT_GUIDE_LAST_VERIFIED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
