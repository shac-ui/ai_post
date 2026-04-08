import React from "react";

interface Tab {
  id: string;
  label: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
  size?: "sm" | "md";
}

export function Tabs({ tabs, active, onChange, className = "", size = "sm" }: TabsProps) {
  return (
    <div className={`flex border-b border-[#2a2a2a] ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px whitespace-nowrap
            ${size === "md" ? "px-4 py-2 text-sm" : ""}
            ${
              active === tab.id
                ? "border-brand-500 text-gray-100"
                : "border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600"
            }
          `}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
