"use client";

import { useId } from "react";

export type SegmentedOption = { value: string; label: string; count?: number };

type Props = {
  label: string;
  options: SegmentedOption[];
  /** Controlled use (filters). */
  value?: string;
  onChange?: (value: string) => void;
  /** Uncontrolled use inside forms. */
  name?: string;
  defaultValue?: string;
  hideLabel?: boolean;
};

/** A pill-shaped radio group. Arrow keys move between options natively. */
export function Segmented({ label, options, value, onChange, name, defaultValue, hideLabel = true }: Props) {
  const generated = useId();
  const groupName = name ?? generated;
  const labelId = `${generated}-label`;
  return (
    <div className="segmented-field">
      <span id={labelId} className={hideLabel ? "visually-hidden" : "field-label"}>
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="segmented">
        {options.map((option) => (
          <label key={option.value} className="segmented-option">
            <input
              type="radio"
              name={groupName}
              value={option.value}
              {...(onChange
                ? { checked: value === option.value, onChange: () => onChange(option.value) }
                : { defaultChecked: defaultValue === option.value })}
            />
            <span>
              {option.label}
              {option.count !== undefined && (
                <>
                  {" "}
                  <em>{option.count}</em>
                </>
              )}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
