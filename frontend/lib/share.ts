export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 권한이 없거나 http 환경. 호출한 쪽이 "직접 복사" 안내를 띄운다.
    return false;
  }
}

export function roomUrl(slug: string, origin: string = window.location.origin): string {
  return `${origin}/r/${slug}`;
}
