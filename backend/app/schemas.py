from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.options import REGIONS, Region


class RoomCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=40)
    meet_date: date
    regions: list[Region] = Field(default_factory=lambda: list(REGIONS), min_length=1)

    @field_validator("regions")
    @classmethod
    def _canonical_regions(cls, value: list[str]) -> list[str]:
        # 중복을 없애고 순서를 서울, 경기, 인천으로 고정한다
        return [r for r in REGIONS if r in value]


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


class RoomOut(BaseModel):
    slug: str
    title: str
    meet_date: date
    expires_at: datetime
    regions: list[str]
    participants: list[ParticipantOut]


class LegOut(BaseModel):
    participant_id: int
    nickname: str
    minutes: int
    origin_station_name: str
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
    legs: list[LegOut]


class ResultOut(BaseModel):
    status: Literal["waiting", "ready"]
    recommendations: list[RecommendationOut]
    regions: list[str]


class StationOut(BaseModel):
    id: int
    name: str
    line: str


class ContentOut(BaseModel):
    kind: Literal["food", "cafe", "play", "event"]
    items: list[dict]
    error: str | None
