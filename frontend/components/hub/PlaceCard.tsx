import {
  Beef,
  Beer,
  BookOpen,
  Cake,
  CookingPot,
  Coffee,
  Croissant,
  Dice5,
  Drumstick,
  Film,
  Fish,
  Gamepad2,
  IceCreamCone,
  KeyRound,
  Martini,
  Mic,
  Palette,
  PartyPopper,
  Pizza,
  Sandwich,
  Soup,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { CARD } from "@/components/ui/styles";
import type { Place } from "@/lib/api/types";
import { walkMinutes } from "@/lib/format";
import { placeIcon, type PlaceIconName } from "@/lib/placeIcon";
import type { ContentKind } from "@/lib/themes";

const ICONS: Record<PlaceIconName, LucideIcon> = {
  food: UtensilsCrossed,
  soup: Soup,
  meat: Beef,
  chicken: Drumstick,
  seafood: Fish,
  snack: CookingPot,
  pizza: Pizza,
  sandwich: Sandwich,
  coffee: Coffee,
  dessert: Cake,
  bakery: Croissant,
  icecream: IceCreamCone,
  beer: Beer,
  wine: Wine,
  cocktail: Martini,
  karaoke: Mic,
  escape: KeyRound,
  board: Dice5,
  game: Gamepad2,
  movie: Film,
  art: Palette,
  comic: BookOpen,
  fun: PartyPopper,
};

type Props = {
  place: Place;
  kind: Exclude<ContentKind, "event">;
  index: number;
  active: boolean;
  onSelect: () => void;
  onLinkClick: () => void;
};

export function PlaceCard({ place, kind, index, active, onSelect, onLinkClick }: Props) {
  const iconName = placeIcon(kind, place.category ?? "");
  const Icon = ICONS[iconName];
  return (
    <article className={`${CARD} ${active ? "border-primary" : ""}`}>
      <button type="button" onClick={onSelect} className="flex w-full items-start gap-3 text-left">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{place.name}</span>
          <span className="block text-sm text-ink-sub">
            {place.category ? `${place.category}, ` : ""}
            <span className="font-semibold text-primary">도보 약 {walkMinutes(place.distance_m)}분</span>
          </span>
          <span className="block truncate text-sm text-ink-mute">{place.address}</span>
        </span>
        {/* 사진 대신 분류 아이콘을 둔다 (lib/placeIcon.ts) */}
        <span
          data-icon={iconName}
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-primary"
        >
          <Icon size={24} strokeWidth={1.75} />
        </span>
      </button>
      <a
        href={place.url}
        onClick={onLinkClick}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-sm font-semibold text-primary underline"
      >
        카카오맵에서 별점, 리뷰 보기
      </a>
    </article>
  );
}
