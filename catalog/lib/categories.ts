export interface Category {
  id: string;
  label: string;
  keyword: string;
}

export const CATEGORIES: readonly Category[] = [
  { id: "all", label: "全て", keyword: "" },
  { id: "population", label: "人口・世帯", keyword: "人口" },
  { id: "economy", label: "経済・産業", keyword: "経済" },
  { id: "environment", label: "環境・気象", keyword: "環境" },
  { id: "education", label: "教育・文化", keyword: "教育" },
  { id: "healthcare", label: "医療・福祉", keyword: "医療" },
] as const;

export const BROWSE_LIMIT_PER_CATEGORY = 4;
export const BROWSE_LIMIT_SINGLE = 20;

export function findCategory(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}
