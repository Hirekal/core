import { ChevronDown, Check } from 'lucide-react';
import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

function useMenuPosition(open, triggerRef, menuRef) {
  const [position, setPosition] = useState(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPosition(null);
      return undefined;
    }

    const update = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const menuHeight = menuRef.current?.offsetHeight || 240;
      const gap = 6;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;
      const openUpward = spaceBelow < Math.min(menuHeight, 240) && spaceAbove > spaceBelow;

      setPosition({
        left: rect.left,
        width: rect.width,
        top: openUpward ? rect.top - gap : rect.bottom + gap,
        transform: openUpward ? 'translateY(-100%)' : undefined,
      });
    };

    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, triggerRef, menuRef]);

  return position;
}

export default function Dropdown({ trigger, items, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const position = useMenuPosition(open, triggerRef, menuRef);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div
        ref={triggerRef}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
      >
        {trigger}
      </div>
      {open && position && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', left: position.left, top: position.top, transform: position.transform, zIndex: 9999 }}
          className={`min-w-[200px] overflow-hidden rounded-xl border border-border bg-card py-1 shadow-xl ${
            align === 'right' ? 'origin-top-right' : 'origin-top-left'
          }`}
        >
          {items.map((item, i) =>
            item.divider ? (
              <div key={i} className="my-1 border-t border-border" />
            ) : (
              <button
                key={i}
                type="button"
                onClick={() => {
                  item.onClick?.();
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                  item.danger ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30' : 'text-heading hover:bg-hover'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            )
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

export function SelectDropdown({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select an option',
  className = '',
  required = false,
  disabled = false,
  size = 'md',
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const position = useMenuPosition(open, triggerRef, menuRef);

  const selected = options.find((opt) => opt.value === value);
  const displayLabel = selected?.label || placeholder;
  const isCompact = size === 'sm';

  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <div className={`flex flex-col ${isCompact ? 'gap-1' : 'gap-1.5'} ${className}`} ref={containerRef}>
      {label && (
        <label className="text-sm font-medium text-heading">
          {label}
          {required && <span className="text-accent ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => !disabled && setOpen((prev) => !prev)}
          className={`flex w-full items-center justify-between gap-3 rounded-lg border bg-input text-left transition-all focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60 ${
            isCompact ? 'px-3 py-2 text-sm' : 'px-3 py-2.5 text-sm'
          } ${
            open ? 'border-accent ring-2 ring-accent/20' : 'border-border hover:border-accent/35'
          } ${selected ? 'text-heading' : 'text-muted'}`}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronDown
            size={isCompact ? 15 : 16}
            className={`shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180 text-accent' : ''}`}
          />
        </button>

        {open && position && createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{
              position: 'fixed',
              left: position.left,
              top: position.top,
              width: position.width,
              transform: position.transform,
              zIndex: 9999,
            }}
            className="max-h-60 overflow-auto rounded-xl border border-border bg-card p-1 shadow-xl"
          >
            {!selected && (
              <div className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted">
                {placeholder}
              </div>
            )}
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 text-left transition-colors ${
                    isCompact ? 'py-2 text-sm' : 'py-2.5 text-sm'
                  } ${
                    active
                      ? 'bg-accent/10 font-medium text-accent'
                      : 'text-heading hover:bg-hover'
                  }`}
                >
                  <span>{opt.label}</span>
                  {active && <Check size={15} strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
