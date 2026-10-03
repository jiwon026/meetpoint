import { THEMES, type ThemeId } from "@/lib/themes";

type Props = { value: ThemeId | null; onChange: (next: ThemeId | null) => void };

export function ThemePicker({ value, onChange }: Props) {
  return (
    <div role="group" aria-label="모임 테마" className="grid grid-cols-2 gap-2">
      {THEMES.map((theme) => {
        const selected = value === theme.id;
        const tone = selected ? "border-primary bg-primary text-white" : "border-line bg-card text-ink";
        return (
          <button
            key={theme.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? null : theme.id)}
            className={`rounded-lg border p-3 text-left transition-colors ${tone}`}
          >
            <span className="block text-sm font-bold">{theme.label}</span>
            <span className={`block text-xs ${selected ? "text-white" : "text-ink-mute"}`}>{theme.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
