import { Chip } from "@/components/ui/Chip";
import { track } from "@/lib/analytics";
import type { ResultFilter } from "@/lib/filter";
import { pickThemes, THEME_OFF, THEMES } from "@/lib/themes";

type Props = {
  filter: ResultFilter;
  appliedThemes: readonly string[];
  onChange: (next: ResultFilter) => void;
};

// 지역은 고르지 않는다. 방을 서울로 만들기로 했다 (2026-10-14). 예전 방의 지역은 그 방에 정해진 대로 둔다.
export function FilterBar({ filter, appliedThemes, onChange }: Props) {
  // URL에 적힌 값이 있으면 그것이 기준이다. 응답이 오기 전에 연달아 눌러도 어긋나지 않는다.
  const themes = filter.themes === THEME_OFF ? [] : (filter.themes ?? pickThemes(appliedThemes));
  return (
    <section aria-label="추천 조건" data-tour="themes" className="space-y-2">
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
