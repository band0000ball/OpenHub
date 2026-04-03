import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DataPreview from "../components/DataPreview";

describe("DataPreview", () => {
  it("JSON データをプレビュー表示する", () => {
    const data = JSON.stringify({ name: "テスト", value: 42 });
    render(<DataPreview data={data} format="json" dataEncoding="utf-8" />);
    expect(screen.getByText(/"テスト"/)).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("CSV データをテーブル表示する", () => {
    const data = "name,age\nAlice,30\nBob,25";
    render(<DataPreview data={data} format="csv" dataEncoding="utf-8" />);
    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("その他の format はプレーンテキスト表示する", () => {
    render(<DataPreview data="plain text content" format="txt" dataEncoding="utf-8" />);
    expect(screen.getByText("plain text content")).toBeInTheDocument();
  });

  it("空データの場合はメッセージを表示する", () => {
    render(<DataPreview data="" format="json" dataEncoding="utf-8" />);
    expect(screen.getByText("プレビューデータがありません")).toBeInTheDocument();
  });

  it("base64 エンコードされたデータをデコードして表示する", () => {
    const encoded = btoa("hello world");
    render(<DataPreview data={encoded} format="txt" dataEncoding="base64" />);
    expect(screen.getByText("hello world")).toBeInTheDocument();
  });

  it("不正な JSON はプレーンテキストとして表示する", () => {
    render(<DataPreview data="not valid json {" format="json" dataEncoding="utf-8" />);
    expect(screen.getByText(/not valid json/)).toBeInTheDocument();
  });
});
