// 온보딩을 본 화면을 기억한다. 개인 정보가 아니고 이 브라우저에서 다시 띄우지 않으려는 표시뿐이다.
export type TourName = "home" | "join";

function key(name: TourName): string {
  return `wjm:tour:${name}:seen`;
}

export function hasSeenTour(name: TourName): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(key(name)) === "1";
  } catch {
    // 저장소를 못 쓰는 브라우저. 온보딩을 매번 띄우지 않도록 본 것으로 친다.
    return true;
  }
}

// 첫 화면과 참여 화면의 온보딩은 같은 사용법을 보여준다. 어느 쪽이든 한 번 본 브라우저에는 다시 띄우지 않는다.
// (첫 화면에서 본 사람이 링크로 친구를 부르러 참여 화면에 오면 또 뜨지 않게)
export function hasSeenAnyTour(): boolean {
  return hasSeenTour("home") || hasSeenTour("join");
}

export function markTourSeen(name: TourName): void {
  try {
    window.localStorage.setItem(key(name), "1");
  } catch {
    // 저장 실패는 다음에 한 번 더 뜰 뿐이라 화면을 막지 않는다.
  }
}
