import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DatasetCard from "../components/DatasetCard";
import type { DatasetMetadata } from "../types";

const mockDataset: DatasetMetadata = {
  id: "estat:0003191203",
  source_id: "estat",
  title: "人口統計データ",
  description: "日本の詳細な人口統計データです。都道府県別、年齢別の人口情報を提供します。",
  url: "https://example.com/dataset",
  tags: ["人口", "統計", "都道府県"],
  updated_at: "2024-03-15",
};

describe("DatasetCard", () => {
  it("renders with role=article", () => {
    render(<DatasetCard dataset={mockDataset} />);
    expect(screen.getByRole("article")).toBeInTheDocument();
  });

  it("displays dataset title", () => {
    render(<DatasetCard dataset={mockDataset} />);
    expect(screen.getByText("人口統計データ")).toBeInTheDocument();
  });

  it("displays source label for estat", () => {
    render(<DatasetCard dataset={mockDataset} />);
    expect(screen.getByText("e-Stat")).toBeInTheDocument();
  });

  it("displays source label for datagojp", () => {
    const dataset = { ...mockDataset, source_id: "datagojp" };
    render(<DatasetCard dataset={dataset} />);
    expect(screen.getByText("data.go.jp")).toBeInTheDocument();
  });

  it("displays updated_at date", () => {
    render(<DatasetCard dataset={mockDataset} />);
    expect(screen.getByText(/2024-03-15/)).toBeInTheDocument();
  });

  it("displays description", () => {
    render(<DatasetCard dataset={mockDataset} />);
    expect(screen.getByText(/日本の詳細な人口統計データです/)).toBeInTheDocument();
  });

  it("displays up to 3 tags", () => {
    const dataset = {
      ...mockDataset,
      tags: ["人口", "統計", "都道府県", "2024", "年次"],
    };
    render(<DatasetCard dataset={dataset} />);

    expect(screen.getByText("人口")).toBeInTheDocument();
    expect(screen.getByText("統計")).toBeInTheDocument();
    expect(screen.getByText("都道府県")).toBeInTheDocument();
    expect(screen.queryByText("2024")).not.toBeInTheDocument();
    expect(screen.queryByText("年次")).not.toBeInTheDocument();
  });

  it("renders link to dataset detail page", () => {
    render(<DatasetCard dataset={mockDataset} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute(
      "href",
      `/datasets/${encodeURIComponent(mockDataset.id)}`
    );
  });

  it("renders empty tags gracefully", () => {
    const dataset = { ...mockDataset, tags: [] };
    render(<DatasetCard dataset={dataset} />);
    expect(screen.getByRole("article")).toBeInTheDocument();
  });

  it("renders with long description without crashing", () => {
    const dataset = {
      ...mockDataset,
      description: "A".repeat(1000),
    };
    render(<DatasetCard dataset={dataset} />);
    expect(screen.getByRole("article")).toBeInTheDocument();
  });
});
