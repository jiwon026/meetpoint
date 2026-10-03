"use client";

import { useEffect, useState } from "react";
import { CustomOverlayMap, Map, useKakaoLoader } from "react-kakao-maps-sdk";

export type MapPin = { id: string; lat: number; lng: number; label: string };

type Props = {
  pins: readonly MapPin[];
  activeId: string | null;
  center?: { lat: number; lng: number };
  level?: number;
};

const FRAME = "h-56 w-full overflow-hidden rounded-card border border-line";

export function KakaoMap(props: Props) {
  const appkey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? "";
  // 키가 없으면 지도 자리를 접는다. 나머지 화면은 그대로 동작한다.
  if (!appkey) return null;
  return <LoadedMap appkey={appkey} {...props} />;
}

function LoadedMap({ appkey, pins, activeId, center, level = 5 }: Props & { appkey: string }) {
  const [loading, error] = useKakaoLoader({ appkey });
  const [map, setMap] = useState<kakao.maps.Map | null>(null);
  // 폴링으로 배열이 새로 만들어져도 좌표가 같으면 다시 맞추지 않게 문자열로 비교한다.
  const pinKey = pins.map((pin) => `${pin.id}:${pin.lat}:${pin.lng}`).join("|");

  useEffect(() => {
    // 중심을 주지 않았으면 모든 핀이 보이게 범위를 맞춘다.
    if (!map || center || pins.length === 0) return;
    const bounds = new kakao.maps.LatLngBounds();
    for (const pin of pins) bounds.extend(new kakao.maps.LatLng(pin.lat, pin.lng));
    map.setBounds(bounds);
    // pins 대신 pinKey로 비교한다 (위 주석 참고).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, center, pinKey]);

  if (error) return null;
  const start = center ?? pins[0];
  if (loading || !start) return <div aria-hidden className={`${FRAME} bg-track`} />;

  return (
    // 휠 확대를 끈다. 켜 두면 지도 위에서 휠을 굴릴 때 페이지가 내려가지 않고 지도만 확대된다.
    <Map
      center={{ lat: start.lat, lng: start.lng }}
      level={level}
      onCreate={setMap}
      className={FRAME}
      scrollwheel={false}
    >
      {pins.map((pin) => {
        const active = pin.id === activeId;
        return (
          <CustomOverlayMap key={pin.id} position={{ lat: pin.lat, lng: pin.lng }} zIndex={active ? 2 : 1}>
            <span
              className={`flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-card px-1.5 text-xs font-bold text-white ${active ? "bg-accent" : "bg-primary"}`}
            >
              {pin.label}
            </span>
          </CustomOverlayMap>
        );
      })}
    </Map>
  );
}
