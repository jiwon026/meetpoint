import { render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useKakaoLoader } from "react-kakao-maps-sdk";
import { KakaoMap } from "./KakaoMap";

vi.mock("react-kakao-maps-sdk", () => ({
  useKakaoLoader: vi.fn(),
  Map: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
  CustomOverlayMap: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Polyline: () => <div data-testid="line" />,
  ZoomControl: () => <div data-testid="zoom" />,
}));

const PINS = [
  { id: "1", lat: 37.48, lng: 127.03, label: "1" },
  { id: "2", lat: 37.49, lng: 127.01, label: "2" },
];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(useKakaoLoader).mockReset();
});

test("키가 없으면 아무것도 그리지 않고 SDK도 부르지 않는다", () => {
  vi.stubEnv("NEXT_PUBLIC_KAKAO_JS_KEY", "");
  const { container } = render(<KakaoMap pins={PINS} activeId={null} />);
  expect(container).toBeEmptyDOMElement();
  expect(useKakaoLoader).not.toHaveBeenCalled();
});

test("불러오는 동안에는 자리만 잡아둔다", () => {
  vi.stubEnv("NEXT_PUBLIC_KAKAO_JS_KEY", "test-key");
  vi.mocked(useKakaoLoader).mockReturnValue([true, undefined]);
  const { container, queryByTestId } = render(<KakaoMap pins={PINS} activeId={null} />);
  expect(container.firstChild).toHaveClass("bg-track");
  expect(queryByTestId("map")).toBeNull();
});

test("SDK 로드에 실패하면 지도 자리를 접는다", () => {
  vi.stubEnv("NEXT_PUBLIC_KAKAO_JS_KEY", "test-key");
  vi.mocked(useKakaoLoader).mockReturnValue([false, new ErrorEvent("error")]);
  const { container } = render(<KakaoMap pins={PINS} activeId={null} />);
  expect(container).toBeEmptyDOMElement();
});

test("핀마다 번호를 그리고 고른 핀을 강조한다", () => {
  vi.stubEnv("NEXT_PUBLIC_KAKAO_JS_KEY", "test-key");
  vi.mocked(useKakaoLoader).mockReturnValue([false, undefined]);
  const { getByText } = render(<KakaoMap pins={PINS} activeId="2" center={{ lat: 37.48, lng: 127.03 }} />);
  expect(getByText("1")).toHaveClass("bg-primary");
  expect(getByText("2")).toHaveClass("bg-accent");
});

test("출발역 이름표와 확대 버튼을 그린다", () => {
  vi.stubEnv("NEXT_PUBLIC_KAKAO_JS_KEY", "test-key");
  vi.mocked(useKakaoLoader).mockReturnValue([false, undefined]);
  const origins = [{ id: "7", lat: 37.55, lng: 126.92, label: "홍대입구 (민수)" }];
  const { getByText, getByTestId } = render(<KakaoMap pins={PINS} activeId="2" origins={origins} />);
  expect(getByText("홍대입구 (민수)")).toBeInTheDocument();
  expect(getByTestId("zoom")).toBeInTheDocument();
});
