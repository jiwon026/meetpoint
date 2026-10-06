export type MapPoint = { name: string; lat: number; lng: number };

const KAKAO_TRANSIT_LINK = "https://map.kakao.com/link/by/traffic";

export function stationLabel(name: string): string {
  return name.endsWith("역") ? name : `${name}역`;
}

function part(point: MapPoint): string {
  // 이름은 카카오맵에 표시되는 이름표일 뿐이고 위치는 좌표로 정해진다.
  return `${encodeURIComponent(stationLabel(point.name))},${point.lat},${point.lng}`;
}

// 카카오맵의 대중교통 길찾기를 여는 주소 (https://apis.map.kakao.com/web/guide/ 의 URL Scheme).
// 우리 시간은 지하철 시간표로 계산한 값이라 카카오맵의 실시간 경로와 몇 분 다를 수 있다.
export function transitDirectionsUrl(from: MapPoint, to: MapPoint): string {
  return `${KAKAO_TRANSIT_LINK}/${part(from)}/${part(to)}`;
}
