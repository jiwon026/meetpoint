from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.options import REGIONS, THEMES, Region, Theme


class RoomCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=40)
    meet_date: date
    regions: list[Region] = Field(default_factory=lambda: list(REGIONS), min_length=1)
    # 테마를 하나만 고르던 화면이 보내는 값. themes가 없을 때만 쓴다.
    theme: Theme | None = None
    themes: list[Theme] | None = None

    @field_validator("regions")
    @classmethod
    def _canonical_regions(cls, value: list[str]) -> list[str]:
        # 중복을 없애고 순서를 서울, 경기, 인천으로 고정한다
        return [r for r in REGIONS if r in value]

    @field_validator("themes")
    @classmethod
    def _canonical_themes(cls, value: list[str] | None) -> list[str] | None:
        # 중복을 없애고 순서를 맛집, 카페, 술자리, 놀거리로 고정한다
        return None if value is None else [t for t in THEMES if t in value]

    def chosen_themes(self) -> list[str]:
        if self.themes is not None:
            return list(self.themes)
        return [self.theme] if self.theme else []


class ParticipantCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    nickname: str = Field(min_length=1, max_length=20)
    address: str | None = Field(default=None, max_length=100)
    station_id: int | None = None

    @model_validator(mode="after")
    def _address_or_station(self) -> "ParticipantCreate":
        if not (self.address and self.address.strip()) and self.station_id is None:
            raise ValueError("address 또는 station_id 중 하나는 필요해요")
        return self


class ParticipantOut(BaseModel):
    id: int
    nickname: str
    nearest_station_name: str
    via: str
    active: bool


class ParticipantUpdate(BaseModel):
    active: bool


class RoomOut(BaseModel):
    slug: str
    title: str
    meet_date: date
    expires_at: datetime
    regions: list[str]
    # 첫 번째 테마. 테마를 하나만 읽는 예전 화면을 위해 남겨 둔다.
    theme: str | None
    themes: list[str]
    participants: list[ParticipantOut]


class LegOut(BaseModel):
    participant_id: int
    nickname: str
    minutes: int
    origin_station_name: str
    # 출발역의 좌표. 참가자 좌표가 아니다. 역 id가 재적재로 사라졌으면 None.
    origin_lat: float | None
    origin_lng: float | None
    via: str


class RecommendationOut(BaseModel):
    hub_id: int
    name: str
    region: str
    tags: list[str]
    vibe_summary: str
    lat: float
    lng: float
    max_minutes: int
    spread_minutes: int
    lines: list[str]
    theme_match: bool
    legs: list[LegOut]


class ResultOut(BaseModel):
    status: Literal["waiting", "ready"]
    recommendations: list[RecommendationOut]
    best_max_minutes: int | None
    regions: list[str]
    # 첫 번째 테마. 테마를 하나만 읽는 예전 화면을 위해 남겨 둔다.
    theme: str | None
    themes: list[str]


class StationOut(BaseModel):
    id: int
    name: str
    line: str


class ContentOut(BaseModel):
    kind: Literal["food", "cafe", "drink", "play", "event"]
    items: list[dict]
    error: str | None


class PlaceSearchIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    q: str = Field(min_length=2, max_length=30)


class PlaceSuggestOut(BaseModel):
    name: str
    address: str


class PlaceSearchOut(BaseModel):
    items: list[PlaceSuggestOut]
    error: str | None
