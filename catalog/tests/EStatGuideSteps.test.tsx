import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import EStatGuideSteps from "../components/EStatGuideSteps";
import { ESTAT_GUIDE_STEPS, ESTAT_GUIDE_LAST_VERIFIED } from "../lib/estat-guide";

describe("EStatGuideSteps", () => {
  it("全ステップのテキストが表示される", () => {
    render(<EStatGuideSteps />);
    for (const s of ESTAT_GUIDE_STEPS) {
      expect(screen.getByText(s.text)).toBeInTheDocument();
    }
  });

  it("番号付きリスト（ol）としてレンダリングされる", () => {
    const { container } = render(<EStatGuideSteps />);
    expect(container.querySelector("ol")).toBeInTheDocument();
  });

  it("e-Stat 登録ページへの外部リンクがある", () => {
    render(<EStatGuideSteps />);
    const link = screen.getByRole("link", { name: /e-stat.*登録|ユーザー登録/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link.getAttribute("href")).toMatch(/^https:\/\//);
  });

  it("最終確認日が表示される", () => {
    render(<EStatGuideSteps />);
    expect(screen.getByText(new RegExp(ESTAT_GUIDE_LAST_VERIFIED))).toBeInTheDocument();
  });
});
