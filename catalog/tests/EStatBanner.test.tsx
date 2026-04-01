import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Session } from "next-auth";
import EStatBanner from "../components/EStatBanner";

// vi.hoisted で巻き上げ：vi.mock ファクトリ内から参照するため
const { mockAuth } = vi.hoisted(() => ({
  mockAuth: vi.fn<() => Promise<Session | null>>(),
}));

vi.mock("../auth", () => ({
  auth: mockAuth,
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}));

vi.mock("../lib/api", () => ({
  searchDatasets: vi.fn(),
  browseByCategory: vi.fn(),
  fetchDataset: vi.fn(),
  getCredentialStatus: vi.fn(),
}));

import { getCredentialStatus } from "../lib/api";
const mockGetCredentialStatus = vi.mocked(getCredentialStatus);

describe("EStatBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルト: 未認証
    mockAuth.mockResolvedValue(null);
  });

  it("shows banner when e-Stat key is not configured", async () => {
    mockGetCredentialStatus.mockResolvedValueOnce(false);

    const component = await EStatBanner();
    render(component);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/アプリケーションID/)).toBeInTheDocument();
  });

  it("shows link to settings page in banner", async () => {
    mockGetCredentialStatus.mockResolvedValueOnce(false);

    const component = await EStatBanner();
    render(component);

    const link = screen.getByRole("link", { name: /設定ページへ/i });
    expect(link).toHaveAttribute("href", "/settings");
  });

  it("shows guide link to settings page with anchor in banner", async () => {
    mockGetCredentialStatus.mockResolvedValueOnce(false);

    const component = await EStatBanner();
    render(component);

    const link = screen.getByRole("link", { name: /取得方法/i });
    expect(link).toHaveAttribute("href", "/settings#estat-guide");
  });

  it("renders nothing when e-Stat key is configured", async () => {
    mockGetCredentialStatus.mockResolvedValueOnce(true);

    const component = await EStatBanner();
    const { container } = render(component as React.ReactElement);

    expect(container).toBeEmptyDOMElement();
  });

  it("calls getCredentialStatus with 'estat' and undefined when unauthenticated", async () => {
    mockGetCredentialStatus.mockResolvedValueOnce(false);

    await EStatBanner();

    expect(mockGetCredentialStatus).toHaveBeenCalledWith("estat", undefined);
  });

  it("passes accessToken to getCredentialStatus when authenticated", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { name: "test-user" },
      expires: "2099-01-01",
      accessToken: "cognito-access-token-xyz",
    } as Session & { accessToken: string });
    mockGetCredentialStatus.mockResolvedValueOnce(true);

    await EStatBanner();

    expect(mockGetCredentialStatus).toHaveBeenCalledWith(
      "estat",
      "cognito-access-token-xyz",
    );
  });
});
