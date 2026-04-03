import Link from "next/link";
import { FALLBACK_SOURCES } from "../lib/sources";

interface SourceFilterTabsProps {
  currentSource: string;
  currentQuery: string;
}

const TABS = [
  { label: "全て", value: "" },
  ...FALLBACK_SOURCES.map((s) => ({ label: s.label, value: s.id })),
];

export default function SourceFilterTabs({
  currentSource,
  currentQuery,
}: SourceFilterTabsProps) {
  const tabs = TABS;

  return (
    <div role="tablist" className="flex gap-1 border-b border-gray-200">
      {tabs.map((tab) => {
        const isSelected = currentSource === tab.value;
        const params = new URLSearchParams({ q: currentQuery });
        if (tab.value) {
          params.set("source", tab.value);
        }
        return (
          <Link
            key={tab.value}
            role="tab"
            aria-selected={isSelected}
            href={`/search?${params.toString()}`}
            className={[
              "px-4 py-2 text-sm font-medium rounded-t-md transition-colors",
              isSelected
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-900",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
