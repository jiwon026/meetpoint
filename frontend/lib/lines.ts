// 색 hex를 직접 쓰는 유일한 파일. 운영사의 노선 색이다.
const LIGHT = new Set(["수인분당선", "의정부경전철", "우이신설선", "9호선", "경의중앙선", "인천1호선"]);

const LINE_COLORS: Record<string, string> = {
  "1호선": "#0052a4",
  "2호선": "#00a84d",
  "3호선": "#ef7c1c",
  "4호선": "#00a5de",
  "5호선": "#996cac",
  "6호선": "#cd7c2f",
  "7호선": "#747f00",
  "8호선": "#e6186c",
  "9호선": "#bdb092",
  수인분당선: "#fabe00",
  경의중앙선: "#77c4a3",
  인천1호선: "#7ca8d5",
  인천2호선: "#ed8b00",
  경춘선: "#0c8e72",
  서해선: "#81a914",
  신분당선: "#d4003b",
  용인에버라인: "#509f22",
  의정부경전철: "#fda600",
  공항철도: "#0090d2",
  우이신설선: "#b0ce18",
  경강선: "#003da5",
  신림선: "#6789ca",
  김포골드라인: "#a17800",
  "GTX-A": "#9a6292",
};
const UNKNOWN_COLOR = "#8a8f8c";

export function lineStyle(line: string): { background: string; color: string } {
  return {
    background: LINE_COLORS[line] ?? UNKNOWN_COLOR,
    color: LIGHT.has(line) ? "#1c1c1a" : "#ffffff",
  };
}

export function shortLine(line: string): string {
  const seoul = /^(\d)호선$/.exec(line);
  if (seoul) return seoul[1];
  const incheon = /^인천(\d)호선$/.exec(line);
  if (incheon) return `인천${incheon[1]}`;
  return line;
}
