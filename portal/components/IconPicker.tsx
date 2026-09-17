import { APP_ICON_NAMES, AppIcon, DEFAULT_ICON } from "@/lib/icons";

export function IconPicker({ defaultValue }: { defaultValue: string }) {
  const selected = APP_ICON_NAMES.includes(defaultValue as (typeof APP_ICON_NAMES)[number])
    ? defaultValue
    : DEFAULT_ICON;
  return (
    <div className="field field-wide">
      <span className="field-label" id="icon-picker-label">
        Icon
      </span>
      <div role="radiogroup" aria-labelledby="icon-picker-label" className="icon-grid">
        {APP_ICON_NAMES.map((name) => (
          <label key={name} className="icon-choice" title={name}>
            <input type="radio" name="icon" value={name} defaultChecked={name === selected} />
            <span className="icon-choice-tile">
              <AppIcon name={name} size={22} />
              <span className="visually-hidden">{name}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
