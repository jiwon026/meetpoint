import { Chip } from "@/components/ui/Chip";
import { REGIONS, toggleRegion, type Region } from "@/lib/regions";

type Props = { value: readonly Region[]; onChange: (next: Region[]) => void };

export function RegionChips({ value, onChange }: Props) {
  return (
    <div role="group" aria-label="만날 지역" className="flex gap-2">
      {REGIONS.map((region) => (
        <Chip key={region} selected={value.includes(region)} onClick={() => onChange(toggleRegion(value, region))}>
          {region}
        </Chip>
      ))}
    </div>
  );
}
