import React from "react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
}

export function Select({ options, className = "", ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={`
        bg-[#1e1e1e] border border-[#3a3a3a] rounded px-2 py-1 text-sm
        text-gray-200 cursor-pointer appearance-none
        focus:outline-none focus:border-brand-500
        transition-colors
        ${className}
      `.trim()}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
