import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "xs" | "sm" | "md";
  active?: boolean;
}

const variantClasses: Record<string, string> = {
  primary:
    "bg-brand-600 hover:bg-brand-700 text-white border border-transparent",
  secondary:
    "bg-[#2a2a2a] hover:bg-[#333] text-gray-200 border border-[#3a3a3a] hover:border-[#4a4a4a]",
  ghost:
    "bg-transparent hover:bg-white/5 text-gray-400 hover:text-gray-200 border border-transparent",
  danger:
    "bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 border border-red-600/30",
};

const sizeClasses: Record<string, string> = {
  xs: "px-2 py-0.5 text-xs h-6",
  sm: "px-2.5 py-1 text-xs h-7",
  md: "px-3 py-1.5 text-sm h-8",
};

export function Button({
  variant = "secondary",
  size = "md",
  active,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`
        inline-flex items-center justify-center gap-1.5 rounded
        font-medium transition-colors duration-100 select-none
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${active ? "!bg-white/10 !text-gray-100" : ""}
        ${className}
      `.trim()}
    >
      {children}
    </button>
  );
}
