import type { SearchResponse, PayloadResponse, DatasetMetadata } from "../types";
import {
  CATEGORIES,
  BROWSE_LIMIT_PER_CATEGORY,
  BROWSE_LIMIT_SINGLE,
  findCategory,
} from "./categories";

const DEFAULT_BASE_URL = "http://localhost:3000";

function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "";
  }
  return process.env.NEXT_PUBLIC_BASE_URL ?? DEFAULT_BASE_URL;
}

export async function searchDatasets(
  q: string,
  source?: string,
  limit = 20,
  offset = 0
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q, limit: String(limit), offset: String(offset) });
  if (source) {
    params.set("source", source);
  }

  const url = `${getBaseUrl()}/api/search?${params.toString()}`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  return response.json() as Promise<SearchResponse>;
}

export async function browseByCategory(categoryId: string): Promise<DatasetMetadata[]> {
  const category = findCategory(categoryId);

  if (category.id === "all") {
    const subCategories = CATEGORIES.filter((c) => c.id !== "all");
    const results = await Promise.all(
      subCategories.map((c) =>
        searchDatasets(c.keyword, undefined, BROWSE_LIMIT_PER_CATEGORY, 0)
          .then((r) => r.items)
          .catch((): DatasetMetadata[] => [])
      )
    );
    const seen = new Set<string>();
    return results.flat().filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
  }

  const result = await searchDatasets(category.keyword, undefined, BROWSE_LIMIT_SINGLE, 0);
  return result.items;
}

export async function fetchDataset(id: string): Promise<PayloadResponse> {
  const url = `${getBaseUrl()}/api/datasets/${encodeURIComponent(id)}`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Dataset fetch failed: ${response.status}`);
  }

  return response.json() as Promise<PayloadResponse>;
}
