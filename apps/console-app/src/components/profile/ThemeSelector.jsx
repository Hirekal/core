import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const options = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

export default function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="inline-flex w-full rounded-lg border border-border bg-input p-1 sm:w-auto"
      role="radiogroup"
      aria-label="Theme"
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-8 py-2.5 text-sm font-medium transition-all sm:min-w-[140px] ${
              active
                ? 'bg-card text-heading shadow-sm'
                : 'text-muted hover:text-heading'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
