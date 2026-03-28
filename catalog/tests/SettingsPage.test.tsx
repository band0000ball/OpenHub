import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SettingsPage from "../app/settings/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

describe("SettingsPage", () => {
  it("renders a heading", () => {
    render(<SettingsPage />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("renders the credentials form", () => {
    render(<SettingsPage />);
    expect(screen.getByLabelText(/アプリケーションID/i)).toBeInTheDocument();
  });

  it("renders e-Stat section", () => {
    render(<SettingsPage />);
    expect(screen.getAllByText(/e-Stat/i).length).toBeGreaterThan(0);
  });
});
