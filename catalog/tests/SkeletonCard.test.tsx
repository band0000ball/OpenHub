import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SkeletonCard from "../components/SkeletonCard";

describe("SkeletonCard", () => {
  it("renders with aria-busy=true", () => {
    render(<SkeletonCard />);
    const skeleton = screen.getByRole("status");
    expect(skeleton).toHaveAttribute("aria-busy", "true");
  });

  it("has accessible label for loading state", () => {
    render(<SkeletonCard />);
    const skeleton = screen.getByRole("status");
    expect(skeleton).toHaveAttribute("aria-label", "読み込み中");
  });

  it("renders multiple skeleton lines for visual placeholder", () => {
    const { container } = render(<SkeletonCard />);
    const animatedLines = container.querySelectorAll(".animate-pulse");
    expect(animatedLines.length).toBeGreaterThan(0);
  });

  it("renders consistently without props", () => {
    const { container } = render(<SkeletonCard />);
    expect(container.firstChild).toBeTruthy();
  });
});
