"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { POLL_MS } from "@/lib/constants";
import { filterQuery, type ResultFilter } from "@/lib/filter";
import { MSG_NETWORK } from "@/lib/messages";
import { isSortable, type PlaceSort } from "@/lib/placeSort";
import type { ContentKind } from "@/lib/themes";
import { ApiError, request } from "./client";
import type {
  ContentOut,
  ParticipantCreate,
  ParticipantOut,
  PlaceSearchOut,
  ResultOut,
  RoomCreate,
  RoomOut,
  RoomUpdate,
  StationOut,
} from "./types";

// 4xx는 다시 불러도 같은 답이라 재시도하지 않는다.
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

export function resultPath(slug: string, filter: ResultFilter): string {
  return `/rooms/${slug}/result${filterQuery(filter)}`;
}

function invalidateRoom(client: QueryClient, slug: string): Promise<unknown> {
  return Promise.all([
    client.invalidateQueries({ queryKey: ["room", slug] }),
    client.invalidateQueries({ queryKey: ["result", slug] }),
  ]);
}

export function useRoom(slug: string) {
  return useQuery<RoomOut, ApiError>({
    queryKey: ["room", slug],
    queryFn: () => request<RoomOut>(`/rooms/${slug}`),
    refetchInterval: POLL_MS,
  });
}

export function useResult(slug: string, filter: ResultFilter, options: { poll?: boolean } = {}) {
  const path = resultPath(slug, filter);
  return useQuery<ResultOut, ApiError>({
    queryKey: ["result", slug, path],
    queryFn: () => request<ResultOut>(path),
    refetchInterval: options.poll === false ? false : POLL_MS,
    // 필터를 바꾸는 동안 이전 목록을 유지해 화면이 깜빡이지 않게 한다.
    placeholderData: keepPreviousData,
  });
}

export type StartMeetingInput = { room: RoomCreate; people: ParticipantCreate[] };
// index는 people의 순번. skipped는 요청을 멈춰서 보내지 못한 사람 수.
export type StartMeetingResult = {
  room: RoomOut;
  added: { index: number; participant: ParticipantOut }[];
  failed: { index: number; message: string }[];
  skipped: number;
};

// 주소를 못 찾았거나 수도권 밖이거나 역이 없는 것은 그 사람만의 문제라 다음 사람은 계속 보낸다.
// 그 밖의 실패(요청 제한, 연결 불량, 서버 오류)는 다음 사람도 같을 테니 멈춘다.
function onlyThisPerson(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 422 || error.status === 404);
}

// 첫 화면에서 쓴다: 방을 만들고 사람들을 한 명씩 차례로 등록한다.
// 한꺼번에 보내지 않는 것은 서버의 정원 검사가 읽고 쓰는 사이에 잠기지 않고, 등록 순서가 화면 순서와 같아야 해서다.
// 방을 만든 뒤의 실패는 던지지 않고 돌려준다. 방은 이미 있으니 화면이 그 방으로 보내 이어서 넣게 한다.
export function useStartMeeting() {
  return useMutation<StartMeetingResult, ApiError, StartMeetingInput>({
    mutationFn: async ({ room: roomBody, people }) => {
      const room = await request<RoomOut>("/rooms", { method: "POST", body: JSON.stringify(roomBody) });
      const added: StartMeetingResult["added"] = [];
      const failed: StartMeetingResult["failed"] = [];
      for (const [index, body] of people.entries()) {
        try {
          const participant = await request<ParticipantOut>(`/rooms/${room.slug}/participants`, {
            method: "POST",
            body: JSON.stringify(body),
          });
          added.push({ index, participant });
        } catch (error) {
          failed.push({ index, message: error instanceof ApiError ? error.message : MSG_NETWORK });
          if (!onlyThisPerson(error)) return { room, added, failed, skipped: people.length - index - 1 };
        }
      }
      return { room, added, failed, skipped: 0 };
    },
  });
}

export function useAddParticipant(slug: string) {
  const client = useQueryClient();
  return useMutation<ParticipantOut, ApiError, ParticipantCreate>({
    mutationFn: (body) =>
      request<ParticipantOut>(`/rooms/${slug}/participants`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => invalidateRoom(client, slug),
  });
}

export function useChangeMeetDate(slug: string) {
  const client = useQueryClient();
  return useMutation<RoomOut, ApiError, RoomUpdate>({
    mutationFn: (body) => request<RoomOut>(`/rooms/${slug}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => invalidateRoom(client, slug),
  });
}

export function useSetParticipantActive(slug: string) {
  const client = useQueryClient();
  return useMutation<ParticipantOut, ApiError, { id: number; active: boolean }>({
    mutationFn: ({ id, active }) =>
      request<ParticipantOut>(`/rooms/${slug}/participants/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      }),
    onSuccess: () => invalidateRoom(client, slug),
  });
}

export function useStationSearch(q: string) {
  const term = q.trim();
  return useQuery<StationOut[], ApiError>({
    queryKey: ["stations", term],
    queryFn: () => request<StationOut[]>(`/stations?q=${encodeURIComponent(term)}`),
    enabled: term.length >= 1,
    staleTime: 60_000,
  });
}

export function usePlaceSearch(q: string) {
  const term = q.trim();
  return useQuery<PlaceSearchOut, ApiError>({
    queryKey: ["places", term],
    // 주소는 개인 정보일 수 있어 URL이 아니라 본문으로 보낸다.
    queryFn: () => request<PlaceSearchOut>("/places/search", { method: "POST", body: JSON.stringify({ q: term }) }),
    enabled: term.length >= 2,
    staleTime: 60_000,
  });
}

export function useHubContent(slug: string, hubId: number, kind: ContentKind, sort: PlaceSort) {
  // 정렬을 고를 수 없는 종류는 정렬을 보내지 않고, 캐시도 정렬과 무관하게 하나만 둔다.
  const query = isSortable(kind) ? `kind=${kind}&sort=${sort}` : `kind=${kind}`;
  return useQuery<ContentOut, ApiError>({
    queryKey: ["content", slug, hubId, query],
    queryFn: () => request<ContentOut>(`/rooms/${slug}/hubs/${hubId}/content?${query}`),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
