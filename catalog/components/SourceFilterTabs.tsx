"use client";

import { useRouter } from "next/navigation";

interface Tab {
  label: string;
  value: string;
}

const TABS: Tab[] = [
  { label: "全て", value: "" },
  { label: "e-Stat", value: "estat" },
  { label: "data.go.jp", value: "datagojp" },
];

interface SourceFilterTabsProps {
  currentSource: string;
  currentQuery: string;
}

export default function SourceFilterTabs({
  currentSource,
  currentQuery,
}: SourceFilterTabsProps) {
  const router = useRouter();

  const handleTabClick = (value: string) => {
    const params = new URLSearchParams({ q: currentQuery });
    if (value) {
      params.set("source", value);
    }
    router.push(`/search?${params.toString()}`);
  };

  return (
    <div role="tablist" className="flex gap-1 border-b border-gray-200">
      {TABS.map((tab) => {
        const isSelected = currentSource === tab.value;
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={isSelected}
            onClick={() => handleTabClick(tab.value)}
            className={[
              "px-4 py-2 text-sm font-medium rounded-t-md transition-colors",
              isSelected
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-900",
            ].join(" ")}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
