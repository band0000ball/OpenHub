import Link from "next/link";

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
  return (
    <div role="tablist" className="flex gap-1 border-b border-gray-200">
      {TABS.map((tab) => {
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
