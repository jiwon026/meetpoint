import { RegionChips } from "@/components/room/RegionChips";
import { Chip } from "@/components/ui/Chip";
import { track } from "@/lib/analytics";
import type { ResultFilter } from "@/lib/filter";
import { parseRegions } from "@/lib/regions";
import { pickThemes, THEME_OFF, THEMES } from "@/lib/themes";

type Props = {
  filter: ResultFilter;
  appliedRegions: readonly string[];
  appliedThemes: readonly string[];
  onChange: (next: ResultFilter) => void;
};

export function FilterBar({ filter, appliedRegions, appliedThemes, onChange }: Props) {
  // URL에 적힌 값이 있으면 그것이 기준이다. 응답이 오기 전에 연달아 눌러도 어긋나지 않는다.
  const regions = filter.regions ?? parseRegions(appliedRegions);
  const themes = filter.themes === THEME_OFF ? [] : (filter.themes ?? pickThemes(appliedThemes));
  return (
    <section aria-label="추천 조건" className="space-y-2">
      <RegionChips
        value={regions}
        onChange={(next) => {
          track("result_filter_changed", { kind: "region", value: next.join(",") });
          onChange({ ...filter, regions: next });
        }}
      />
      <div role="group" aria-label="테마" className="flex flex-wrap gap-2">
        {THEMES.map((item) => {
          const selected = themes.includes(item.id);
          return (
            <Chip
              key={item.id}
              selected={selected}
              onClick={() => {
                const next = THEMES.map((t) => t.id).filter((id) => (id === item.id ? !selected : themes.includes(id)));
                // 모두 끄면 "테마 없이"를 주소에 적는다. 비워 두면 방의 기본 테마로 돌아가 버린다.
                track("result_filter_changed", { kind: "theme", value: next.length > 0 ? next.join(",") : THEME_OFF });
                onChange({ ...filter, themes: next.length > 0 ? next : THEME_OFF });
              }}
            >
              {item.label}
            </Chip>
          );
        })}
      </div>
    </section>
  );
}
