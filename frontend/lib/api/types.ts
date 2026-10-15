import type { components } from "./schema";

type Schemas = components["schemas"];

export type RoomOut = Schemas["RoomOut"];
export type RoomCreate = Schemas["RoomCreate"];
export type RoomUpdate = Schemas["RoomUpdate"];
export type ParticipantOut = Schemas["ParticipantOut"];
export type ParticipantCreate = Schemas["ParticipantCreate"];
export type ResultOut = Schemas["ResultOut"];
export type RecommendationOut = Schemas["RecommendationOut"];
export type LegOut = Schemas["LegOut"];
export type StationOut = Schemas["StationOut"];
export type PlaceSearchOut = Schemas["PlaceSearchOut"];
export type ContentOut = Schemas["ContentOut"];

// 백엔드 ContentOut.items는 dict 목록이라 스키마에 모양이 없다. 실제 모양은 app/places/service.py의 Place,
// app/events/service.py의 Event 데이터클래스다. 그쪽을 바꾸면 여기도 바꾼다.
export type Place = {
  id: string;
  name: string;
  category: string;
  address: string;
  distance_m: number;
  url: string;
  lat: number;
  lng: number;
};

export type EventItem = {
  id: string;
  title: string;
  place: string;
  start_date: string;
  end_date: string;
  lat: number;
  lng: number;
  url: string;
  image: string;
  category: string;
  is_free: boolean;
  distance_m: number;
};
