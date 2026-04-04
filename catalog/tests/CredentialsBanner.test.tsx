import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import CredentialsBanner from "../components/CredentialsBanner";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

function mockFetchResponse(data: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 502,
    json: () => Promise.resolve(data),
  });
}

describe("CredentialsBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("未設定ソースがある場合はバナーを表示する", async () => {
    global.fetch = mockFetchResponse({
      unconfigured: [{ id: "estat", label: "e-Stat", configured: false }],
    });

    render(<CredentialsBanner />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByText(/e-Stat/)).toBeInTheDocument();
    expect(screen.getByText(/アプリケーションID/)).toBeInTheDocument();
  });

  it("設定ページへのリンクを表示する", async () => {
    global.fetch = mockFetchResponse({
      unconfigured: [{ id: "estat", label: "e-Stat", configured: false }],
    });

    render(<CredentialsBanner />);

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /設定ページへ/ });
      expect(link).toHaveAttribute("href", "/settings");
    });
  });

  it("全ソース設定済みの場合は何も表示しない", async () => {
    global.fetch = mockFetchResponse({ unconfigured: [] });

    const { container } = render(<CredentialsBanner />);

    // fetch 完了を待つ
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    expect(container.querySelector("[role='alert']")).not.toBeInTheDocument();
  });

  it("API エラー時は何も表示しない", async () => {
    global.fetch = mockFetchResponse({ error: "fail" }, false);

    const { container } = render(<CredentialsBanner />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    expect(container.querySelector("[role='alert']")).not.toBeInTheDocument();
  });
});
