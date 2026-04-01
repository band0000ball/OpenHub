import Link from "next/link";
import { CATEGORIES } from "../lib/categories";

interface CategoryTabsProps {
  currentCategory: string;
}

export default function CategoryTabs({ currentCategory }: CategoryTabsProps) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 border-b border-gray-200 mb-6">
      {CATEGORIES.map((cat) => {
        const isSelected = currentCategory === cat.id;
        return (
          <Link
            key={cat.id}
            role="tab"
            aria-selected={isSelected}
            href={cat.id === "all" ? "/" : `/?category=${cat.id}`}
            className={[
              "px-4 py-2 text-sm font-medium rounded-t-md transition-colors",
              isSelected
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-900",
            ].join(" ")}
          >
            {cat.label}
          </Link>
        );
      })}
    </div>
  );
}
