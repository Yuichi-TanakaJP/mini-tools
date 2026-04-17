"use client";

type TabBarProps<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
};

export default function TabBar<T extends string>({
  options,
  value,
  onChange,
}: TabBarProps<T>) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {options.map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: active
                ? "1.5px solid var(--color-accent)"
                : "1.5px solid var(--color-border-strong)",
              background: active ? "var(--color-accent-sub)" : "var(--color-bg-card)",
              color: active ? "var(--color-accent)" : "var(--color-text-sub)",
              fontWeight: active ? 700 : 500,
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
