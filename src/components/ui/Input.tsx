import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <label className="text-xs text-gray-400 font-medium">{label}</label>
      )}
      <input
        {...props}
        className={`
          w-full bg-[#1e1e1e] border border-[#3a3a3a] rounded px-3 py-1.5 text-sm
          text-gray-200 placeholder-gray-600
          focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30
          transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? "border-red-500/60 focus:border-red-500" : ""}
          ${className}
        `.trim()}
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
