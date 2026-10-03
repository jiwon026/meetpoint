"use client";

import { useEffect, useState } from "react";
import { CustomOverlayMap, Map, Polyline, ZoomControl, useKakaoLoader } from "react-kakao-maps-sdk";
import type { MapOrigin } from "@/lib/origins";

export type MapPin = { id: string; lat: number; lng: number; label: string };

type Props = {
  pins: readonly MapPin[];
  activeId: string | null;
  // 출발역. 주면 이름표를 찍고 강조된 핀까지 점선을 긋는다.
  origins?: readonly MapOrigin[];
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

function LoadedMap({ appkey, pins, activeId, origins = [], center, level = 5 }: Props & { appkey: string }) {
  const [loading, error] = useKakaoLoader({ appkey });
  const [map, setMap] = useState<kakao.maps.Map | null>(null);
  // 범위를 맞추는 중에 선을 그리면 SDK가 좌표를 NaN으로 계산해 콘솔 오류가 난다. 지도가 멈춘 뒤에 그린다.
  const [settled, setSettled] = useState(false);
  // 폴링으로 배열이 새로 만들어져도 좌표가 같으면 다시 맞추지 않게 문자열로 비교한다.
  const pinKey = [...pins, ...origins].map((pin) => `${pin.id}:${pin.lat}:${pin.lng}`).join("|");

  useEffect(() => {
    // 중심을 주지 않았으면 모든 핀과 출발역이 보이게 범위를 맞춘다.
    if (!map || center || pins.length === 0) return;
    const bounds = new kakao.maps.LatLngBounds();
    for (const pin of [...pins, ...origins]) bounds.extend(new kakao.maps.LatLng(pin.lat, pin.lng));
    map.setBounds(bounds);
    // pins 대신 pinKey로 비교한다 (위 주석 참고).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, center, pinKey]);

  if (error) return null;
  const start = center ?? pins[0];
  const target = pins.find((pin) => pin.id === activeId);
  if (loading || !start) return <div aria-hidden className={`${FRAME} bg-track`} />;
  // 여기부터는 SDK를 불러온 브라우저에서만 그려진다. 선 색은 클래스로 줄 수 없어 토큰 값을 읽어 넘긴다.
  const lineColor = getComputedStyle(document.documentElement).getPropertyValue("--color-ink-sub").trim();

  return (
    // 휠 확대를 끈다. 켜 두면 지도 위에서 휠을 굴릴 때 페이지가 내려가지 않고 지도만 확대된다.
    <Map
      center={{ lat: start.lat, lng: start.lng }}
      level={level}
      onCreate={setMap}
      className={FRAME}
      scrollwheel={false}
      onIdle={() => setSettled(true)}
    >
      {/* 휠 확대를 껐으니 확대, 축소 버튼을 둔다. 휴대폰에서는 두 손가락으로도 된다. */}
      <ZoomControl position="RIGHT" />
      {settled &&
        target &&
        origins.map((origin) => (
          <Polyline
            key={origin.id}
            path={[
              { lat: origin.lat, lng: origin.lng },
              { lat: target.lat, lng: target.lng },
            ]}
            strokeWeight={2}
            strokeColor={lineColor}
            strokeOpacity={0.7}
            strokeStyle="shortdash"
          />
        ))}
      {origins.map((origin) => (
        <CustomOverlayMap key={origin.id} position={{ lat: origin.lat, lng: origin.lng }} zIndex={1}>
          <span className="flex items-center gap-1 rounded-full border border-line bg-card px-2 py-0.5 text-[11px] font-semibold text-ink-sub">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ink-sub" />
            {origin.label}
          </span>
        </CustomOverlayMap>
      ))}
      {pins.map((pin) => {
        const active = pin.id === activeId;
        return (
          <CustomOverlayMap key={pin.id} position={{ lat: pin.lat, lng: pin.lng }} zIndex={active ? 3 : 2}>
            <span
              className={`flex h-7 min-w-7 items-center justify-center whitespace-nowrap rounded-full border-2 border-card px-1.5 text-xs font-bold text-white ${active ? "bg-accent" : "bg-primary"}`}
            >
              {pin.label}
            </span>
          </CustomOverlayMap>
        );
      })}
    </Map>
  );
}
