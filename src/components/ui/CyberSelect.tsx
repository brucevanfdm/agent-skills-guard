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

  const selectedOption = options.find((opt) => opt.value === value);

  // 点击外部关闭下拉框
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={selectRef} className={`relative ${className}`}>
      {/* 选择器触发按钮 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="cyber-select-trigger"
      >
        <span className="flex-1 text-left font-mono text-sm">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* 下拉选项列表 */}
      {isOpen && (
        <div
          className="cyber-select-dropdown"
          style={{
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`cyber-select-option ${
                value === option.value ? "cyber-select-option-active" : ""
              }`}
            >
              <span className="flex-1 text-left font-mono text-sm">{option.label}</span>
              {value === option.value && (
                <Check className="w-4 h-4 text-terminal-cyan" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
