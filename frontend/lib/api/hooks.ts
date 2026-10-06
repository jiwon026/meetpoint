"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { POLL_MS } from "@/lib/constants";
import { filterQuery, type ResultFilter } from "@/lib/filter";
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

export function useCreateRoom() {
  return useMutation<RoomOut, ApiError, RoomCreate>({
    mutationFn: (body) => request<RoomOut>("/rooms", { method: "POST", body: JSON.stringify(body) }),
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
