import { describe, it, expect } from "vitest";
import { searchMetadata } from "../lib/search";
import type { DatasetMetadata } from "../types";

const items: DatasetMetadata[] = [
  {
    id: "estat:0001",
    source_id: "estat",
    title: "人口統計データ",
    description: "日本の人口に関する統計",
    url: "https://example.com/1",
    tags: ["人口", "統計"],
    updated_at: "2024-01-01",
  },
  {
    id: "datagojp:0001",
    source_id: "datagojp",
    title: "経済指標一覧",
    description: "GDP等の経済指標データ",
    url: "https://example.com/2",
    tags: ["経済", "GDP"],
    updated_at: "2024-02-01",
  },
  {
    id: "estat:0002",
    source_id: "estat",
    title: "教育統計",
    description: "学校教育に関するデータ",
    url: "https://example.com/3",
    tags: ["教育"],
    updated_at: "2024-03-01",
  },
];

describe("searchMetadata", () => {
  it("キーワードで title をマッチする", () => {
    const result = searchMetadata(items, "人口");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("estat:0001");
  });

  it("キーワードで description をマッチする", () => {
    const result = searchMetadata(items, "GDP");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("datagojp:0001");
  });

  it("キーワードで tags をマッチする", () => {
    const result = searchMetadata(items, "統計");
    expect(result.items).toHaveLength(2);
  });

  it("大文字小文字を無視する", () => {
    const result = searchMetadata(items, "gdp");
    expect(result.items).toHaveLength(1);
  });

  it("source フィルタリング", () => {
    const result = searchMetadata(items, "", "estat");
    expect(result.items).toHaveLength(2);
    expect(result.items.every((i) => i.source_id === "estat")).toBe(true);
  });

  it("キーワード + source の組み合わせ", () => {
    const result = searchMetadata(items, "統計", "estat");
    expect(result.items).toHaveLength(2);
  });

  it("空クエリは全件返す", () => {
    const result = searchMetadata(items, "");
    expect(result.items).toHaveLength(3);
  });

  it("結果なし", () => {
    const result = searchMetadata(items, "存在しないキーワード");
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("limit でページネーション", () => {
    const result = searchMetadata(items, "", undefined, 2, 0);
    expect(result.items).toHaveLength(2);
    expect(result.has_next).toBe(true);
    expect(result.total).toBe(3);
  });

  it("offset でページネーション", () => {
    const result = searchMetadata(items, "", undefined, 2, 2);
    expect(result.items).toHaveLength(1);
    expect(result.has_next).toBe(false);
  });

  it("複数キーワードは AND マッチ", () => {
    const result = searchMetadata(items, "人口 統計");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("estat:0001");
  });
});
