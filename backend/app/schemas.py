from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class RoomCreate(BaseModel):
    title: str = Field(min_length=1, max_length=40)
    meet_date: date


class ParticipantCreate(BaseModel):
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


class StationOut(BaseModel):
    id: int
    name: str
    line: str
