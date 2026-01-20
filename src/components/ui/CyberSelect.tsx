import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface CyberSelectOption {
  value: string;
  label: string;
}

interface CyberSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CyberSelectOption[];
  placeholder?: string;
  className?: string;
}

export function CyberSelect({
  value,
  onChange,
  options,
  placeholder = "选择选项",
  className = "",
}: CyberSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const listNode = listRef.current;
    if (!listNode) return;

    const handleWheel = (event: WheelEvent) => {
      event.stopPropagation();
      const { scrollTop, scrollHeight, clientHeight } = listNode;
      const deltaY = event.deltaY;
      const atTop = scrollTop <= 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1;

      if ((deltaY < 0 && atTop) || (deltaY > 0 && atBottom)) {
        event.preventDefault();
      }
    };

    listNode.addEventListener("wheel", handleWheel, { passive: false });
    return () => listNode.removeEventListener("wheel", handleWheel);
  }, [isOpen]);

  return (
    <div ref={selectRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-10 px-3 bg-card border border-border rounded-lg text-sm flex items-center justify-between gap-2 hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
      >
        <span className="flex-1 text-left text-sm truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          <div ref={listRef} className="max-h-60 overflow-y-auto overscroll-contain py-1">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-muted/50 transition-colors ${
                  value === option.value ? "bg-primary/10 text-primary" : "text-foreground"
                }`}
              >
                <span className="flex-1 text-left truncate">{option.label}</span>
                {value === option.value && <Check className="w-4 h-4 text-primary" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
