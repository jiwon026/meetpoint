import { MSG_INVALID_INPUT, MSG_NETWORK } from "@/lib/messages";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// 백엔드의 detail 문자열이 화면 문구의 원본이다. 문자열이 아니면 프론트 문구로 대신한다.
async function errorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return MSG_INVALID_INPUT;
  } catch {
    // 본문이 JSON이 아니다 (프록시 오류 페이지 등). 아래 연결 문구로 넘어간다.
  }
  return MSG_NETWORK;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(0, MSG_NETWORK);
  }
  if (!response.ok) throw new ApiError(response.status, await errorMessage(response));
  return (await response.json()) as T;
}
