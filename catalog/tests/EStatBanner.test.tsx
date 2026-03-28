import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import EStatBanner from "../components/EStatBanner";

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

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/settings");
  });

  it("renders nothing when e-Stat key is configured", async () => {
    mockGetCredentialStatus.mockResolvedValueOnce(true);

    const component = await EStatBanner();
    const { container } = render(component as React.ReactElement);

    expect(container).toBeEmptyDOMElement();
  });

  it("calls getCredentialStatus with 'estat'", async () => {
    mockGetCredentialStatus.mockResolvedValueOnce(false);

    await EStatBanner();

    expect(mockGetCredentialStatus).toHaveBeenCalledWith("estat");
  });
});
