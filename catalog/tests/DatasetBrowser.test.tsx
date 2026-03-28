import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import DatasetBrowser from "../components/DatasetBrowser";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("../lib/api", () => ({
  searchDatasets: vi.fn(),
  browseByCategory: vi.fn(),
}));

import { browseByCategory } from "../lib/api";
const mockBrowse = vi.mocked(browseByCategory);

const mockDatasets = [
  {
    id: "estat:0001",
    source_id: "estat",
    title: "人口統計データ",
    description: "日本の人口統計",
    url: "https://example.com",
    tags: ["人口"],
    updated_at: "2024-01-01",
  },
  {
    id: "datagojp:0002",
    source_id: "datagojp",
    title: "経済指標データ",
    description: "経済に関するデータ",
    url: "https://example.com",
    tags: ["経済"],
    updated_at: "2024-02-01",
  },
];

describe("DatasetBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dataset cards when data is available", async () => {
    mockBrowse.mockResolvedValueOnce(mockDatasets);

    const component = await DatasetBrowser({ category: "all" });
    render(component);

    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByText("人口統計データ")).toBeInTheDocument();
    expect(screen.getByText("経済指標データ")).toBeInTheDocument();
  });

  it("renders empty state when no datasets", async () => {
    mockBrowse.mockResolvedValueOnce([]);

    const component = await DatasetBrowser({ category: "all" });
    render(component);

    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.getByText(/見つかりませんでした/)).toBeInTheDocument();
  });

  it("renders error state when fetch fails", async () => {
    mockBrowse.mockRejectedValueOnce(new Error("Network error"));

    const component = await DatasetBrowser({ category: "all" });
    render(component);

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("calls browseByCategory with the given category", async () => {
    mockBrowse.mockResolvedValueOnce(mockDatasets);

    await DatasetBrowser({ category: "population" });

    expect(mockBrowse).toHaveBeenCalledWith("population");
  });
});
