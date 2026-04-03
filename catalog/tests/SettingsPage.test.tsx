import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("../lib/sources", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/sources")>();
  return {
    ...original,
    fetchSourcesRequiringApiKey: vi.fn().mockResolvedValue(
      original.FALLBACK_SOURCES.filter((s) => s.requiresApiKey),
    ),
  };
});

import SettingsPage from "../app/settings/page";

describe("SettingsPage", () => {
  it("renders a heading", async () => {
    render(await SettingsPage());
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("renders the credentials form", async () => {
    render(await SettingsPage());
    expect(screen.getByLabelText(/アプリケーションID/i)).toBeInTheDocument();
  });

  it("renders e-Stat section", async () => {
    render(await SettingsPage());
    expect(screen.getAllByText(/e-Stat/i).length).toBeGreaterThan(0);
  });
});
