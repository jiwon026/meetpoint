import { THEMES, type ThemeId } from "@/lib/themes";

type Props = { value: readonly ThemeId[]; onChange: (next: ThemeId[]) => void };

export function ThemePicker({ value, onChange }: Props) {
  return (
    <div role="group" aria-label="모임 테마" className="grid grid-cols-2 gap-2">
      {THEMES.map((theme) => {
        const selected = value.includes(theme.id);
        const tone = selected ? "border-primary bg-primary text-white" : "border-line bg-card text-ink";
        // 누른 순서와 상관없이 정해진 순서로 돌려준다.
        const next = THEMES.map((t) => t.id).filter((id) => (id === theme.id ? !selected : value.includes(id)));
        return (
          <button
            key={theme.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(next)}
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
