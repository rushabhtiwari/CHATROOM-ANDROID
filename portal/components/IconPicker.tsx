import { APP_ICON_NAMES, AppIcon, DEFAULT_ICON } from "@/lib/icons";

export function IconPicker({ defaultValue }: { defaultValue: string }) {
  const selected = APP_ICON_NAMES.includes(defaultValue as (typeof APP_ICON_NAMES)[number])
    ? defaultValue
    : DEFAULT_ICON;
  return (
    <fieldset className="icon-picker">
      <legend>Icon</legend>
      <div className="icon-options">
        {APP_ICON_NAMES.map((name) => (
          <label key={name} className="icon-option">
            <input type="radio" name="icon" value={name} defaultChecked={name === selected} />
            <AppIcon name={name} size={22} />
            {name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
