import { ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function Dropdown({ trigger, items, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>{trigger}</div>
      {open && (
        <div
          className={`absolute z-50 mt-1 min-w-[200px] rounded-lg border border-border bg-white py-1 shadow-lg ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {items.map((item, i) =>
            item.divider ? (
              <div key={i} className="my-1 border-t border-border" />
            ) : (
              <button
                key={i}
                onClick={() => {
                  item.onClick?.();
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 ${
                  item.danger ? 'text-red-600 hover:bg-red-50' : 'text-heading'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export function SelectDropdown({ label, value, options, onChange, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label className="text-sm font-medium text-heading">{label}</label>}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-lg border border-border bg-white px-3 py-2 pr-8 text-sm text-heading focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
      </div>
    </div>
  );
}
