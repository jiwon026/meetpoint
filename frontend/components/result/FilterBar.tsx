import { RegionChips } from "@/components/room/RegionChips";
import { Chip } from "@/components/ui/Chip";
import type { ResultFilter } from "@/lib/filter";
import { parseRegions } from "@/lib/regions";
import { THEME_OFF, THEMES } from "@/lib/themes";

type Props = {
  filter: ResultFilter;
  appliedRegions: readonly string[];
  appliedTheme: string | null;
  onChange: (next: ResultFilter) => void;
};

export function FilterBar({ filter, appliedRegions, appliedTheme, onChange }: Props) {
  // URL에 적힌 값이 있으면 그것이 기준이다. 응답이 오기 전에 연달아 눌러도 어긋나지 않는다.
  const regions = filter.regions ?? parseRegions(appliedRegions);
  const theme = filter.theme === THEME_OFF ? null : (filter.theme ?? appliedTheme);
  return (
    <section aria-label="추천 조건" className="space-y-2">
      <RegionChips value={regions} onChange={(next) => onChange({ ...filter, regions: next })} />
      <div role="group" aria-label="테마" className="flex flex-wrap gap-2">
        {THEMES.map((item) => (
          <Chip
            key={item.id}
            selected={theme === item.id}
            onClick={() => onChange({ ...filter, theme: theme === item.id ? THEME_OFF : item.id })}
          >
            {item.label}
          </Chip>
        ))}
      </div>
    </section>
  );
}
