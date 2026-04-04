import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import DatasetDetailPage from "../app/datasets/[id]/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams("q=人口"),
  notFound: vi.fn(),
}));

vi.mock("../lib/auth-helpers", () => ({
  getAccessToken: vi.fn().mockResolvedValue("test-token"),
}));

vi.mock("../lib/api", () => ({
  fetchDataset: vi.fn(),
}));

import { fetchDataset } from "../lib/api";
const mockFetchDataset = vi.mocked(fetchDataset);

const mockPayload = {
  metadata: {
    id: "estat:0003191203",
    source_id: "estat",
    title: "人口統計データ",
    description: "日本の詳細な人口統計データ。都道府県別年齢別情報を含む。",
    url: "https://www.e-stat.go.jp/stat/dataset/001",
    tags: ["人口", "統計", "都道府県"],
    updated_at: "2024-03-15",
  },
  format: "csv",
  fetched_at: "2024-03-20T12:00:00Z",
  record_count: 500,
  data_encoding: "utf-8" as const,
  data: "col1,col2\nval1,val2",
};

describe("DatasetDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dataset title as h1", async () => {
    mockFetchDataset.mockResolvedValueOnce(mockPayload);

    const page = await DatasetDetailPage({
      params: Promise.resolve({ id: "estat%3A0003191203" }),
    });
    render(page);

    expect(
      screen.getByRole("heading", { level: 1, name: "人口統計データ" })
    ).toBeInTheDocument();
  });

  it("displays source label", async () => {
    mockFetchDataset.mockResolvedValueOnce(mockPayload);

    const page = await DatasetDetailPage({
      params: Promise.resolve({ id: "estat%3A0003191203" }),
    });
    render(page);

    expect(screen.getByText("e-Stat")).toBeInTheDocument();
  });

  it("displays updated_at date", async () => {
    mockFetchDataset.mockResolvedValueOnce(mockPayload);

    const page = await DatasetDetailPage({
      params: Promise.resolve({ id: "estat%3A0003191203" }),
    });
    render(page);

    expect(screen.getByText(/2024-03-15/)).toBeInTheDocument();
  });

  it("displays all tags", async () => {
    mockFetchDataset.mockResolvedValueOnce(mockPayload);

    const page = await DatasetDetailPage({
      params: Promise.resolve({ id: "estat%3A0003191203" }),
    });
    render(page);

    expect(screen.getByText("人口")).toBeInTheDocument();
    expect(screen.getByText("統計")).toBeInTheDocument();
    expect(screen.getByText("都道府県")).toBeInTheDocument();
  });

  it("displays description", async () => {
    mockFetchDataset.mockResolvedValueOnce(mockPayload);

    const page = await DatasetDetailPage({
      params: Promise.resolve({ id: "estat%3A0003191203" }),
    });
    render(page);

    expect(screen.getByText(/日本の詳細な人口統計データ/)).toBeInTheDocument();
  });

  it("renders external data link with correct accessibility attrs", async () => {
    mockFetchDataset.mockResolvedValueOnce(mockPayload);

    const page = await DatasetDetailPage({
      params: Promise.resolve({ id: "estat%3A0003191203" }),
    });
    render(page);

    const link = screen.getByRole("link", { name: /人口統計データ（新しいタブで開く）/i });
    expect(link).toHaveAttribute("href", mockPayload.metadata.url);
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders 一覧に戻る link", async () => {
    mockFetchDataset.mockResolvedValueOnce(mockPayload);

    const page = await DatasetDetailPage({
      params: Promise.resolve({ id: "estat%3A0003191203" }),
    });
    render(page);

    const backLink = screen.getByRole("link", { name: /一覧に戻る/i });
    expect(backLink).toHaveAttribute("href", "/");
  });

  it("renders error when fetch fails", async () => {
    mockFetchDataset.mockRejectedValueOnce(new Error("Not found"));

    const page = await DatasetDetailPage({
      params: Promise.resolve({ id: "nonexistent" }),
    });
    render(page);

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("calls fetchDataset with decoded id", async () => {
    mockFetchDataset.mockResolvedValueOnce(mockPayload);

    await DatasetDetailPage({
      params: Promise.resolve({ id: "estat%3A0003191203" }),
    });

    expect(mockFetchDataset).toHaveBeenCalledWith("estat%3A0003191203", "test-token");
  });
});
