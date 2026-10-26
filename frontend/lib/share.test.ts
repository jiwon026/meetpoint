import { afterEach, expect, test, vi } from "vitest";
import { shareLink } from "./share";

const DATA = { title: "우리지금만나", url: "https://example.com/r/abc123/result" };

afterEach(() => {
  Reflect.deleteProperty(navigator, "share");
});

test("공유창이 없는 브라우저면 unsupported", async () => {
  expect(await shareLink(DATA)).toBe("unsupported");
});

test("공유창에서 보낼 곳을 고르면 shared", async () => {
  const share = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "share", { value: share, configurable: true });
  expect(await shareLink(DATA)).toBe("shared");
  expect(share).toHaveBeenCalledWith(DATA);
});

test("공유창을 닫으면 cancelled", async () => {
  const share = vi.fn().mockRejectedValue(new DOMException("cancel", "AbortError"));
  Object.defineProperty(navigator, "share", { value: share, configurable: true });
  expect(await shareLink(DATA)).toBe("cancelled");
});
