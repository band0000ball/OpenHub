import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Pagination from "../components/Pagination";

const baseProps = {
  basePath: "/search",
  queryParams: { q: "人口" },
};

describe("Pagination", () => {
  it("ページ1では前へボタンが無効", () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        hasNext={true}
        {...baseProps}
      />
    );
    const prev = screen.getByText("前へ");
    // Link ではなく span（disabled）であること
    expect(prev.tagName).toBe("SPAN");
  });

  it("最終ページでは次へボタンが無効", () => {
    render(
      <Pagination
        currentPage={5}
        totalPages={5}
        hasNext={false}
        {...baseProps}
      />
    );
    const next = screen.getByText("次へ");
    expect(next.tagName).toBe("SPAN");
  });

  it("totalPages が null のとき X/Y 表示がない", () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={null}
        hasNext={true}
        {...baseProps}
      />
    );
    expect(screen.queryByText(/\/ \d+ ページ/)).not.toBeInTheDocument();
  });

  it("totalPages がある場合は X/Y ページ表示がある", () => {
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        hasNext={true}
        {...baseProps}
      />
    );
    expect(screen.getByText("2 / 5 ページ")).toBeInTheDocument();
  });

  it("前へリンクが正しい URL を持つ", () => {
    render(
      <Pagination
        currentPage={3}
        totalPages={5}
        hasNext={true}
        {...baseProps}
      />
    );
    const prev = screen.getByText("前へ");
    expect(prev.tagName).toBe("A");
    expect(prev.getAttribute("href")).toContain("page=2");
  });

  it("次へリンクが正しい URL を持つ", () => {
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        hasNext={true}
        {...baseProps}
      />
    );
    const next = screen.getByText("次へ");
    expect(next.tagName).toBe("A");
    expect(next.getAttribute("href")).toContain("page=3");
  });

  it("has_next が false で totalPages が null のとき次へが無効", () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={null}
        hasNext={false}
        {...baseProps}
      />
    );
    const next = screen.getByText("次へ");
    expect(next.tagName).toBe("SPAN");
  });

  it("ナビゲーション aria-label がある", () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={3}
        hasNext={true}
        {...baseProps}
      />
    );
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });
});
