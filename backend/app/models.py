from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, Float, ForeignKey, Integer, String, Boolean
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.options import REGIONS


class Base(DeclarativeBase):
    pass


class StationGroup(Base):
    """물리적으로 같은 역. 환승역은 노선별 Station 여러 개가 한 그룹에 속한다."""

    __tablename__ = "station_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), index=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)


class Station(Base):
    __tablename__ = "stations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), index=True)
    line: Mapped[str] = mapped_column(String(30))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    group_id: Mapped[int] = mapped_column(ForeignKey("station_groups.id"), index=True)


class Hub(Base):
    __tablename__ = "hubs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    station_id: Mapped[int] = mapped_column(ForeignKey("stations.id"))
    group_id: Mapped[int] = mapped_column(ForeignKey("station_groups.id"), index=True)
    name: Mapped[str] = mapped_column(String(50))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    region: Mapped[str] = mapped_column(String(10))  # 서울, 경기, 인천
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    themes: Mapped[list[str]] = mapped_column(JSON, default=list)
    vibe_summary: Mapped[str] = mapped_column(String(120), default="")


class StationTime(Base):
    __tablename__ = "station_times"

    from_station_id: Mapped[int] = mapped_column(ForeignKey("stations.id"), primary_key=True)
    to_station_id: Mapped[int] = mapped_column(ForeignKey("stations.id"), primary_key=True)
    minutes: Mapped[int] = mapped_column(Integer)


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(12), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(40))
    meet_date: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    regions: Mapped[list[str]] = mapped_column(JSON, default=lambda: list(REGIONS))
    theme: Mapped[str | None] = mapped_column(String(10), nullable=True, default=None)

    participants: Mapped[list["Participant"]] = relationship(
        back_populates="room", cascade="all, delete-orphan", order_by="Participant.id"
    )


class Participant(Base):
    __tablename__ = "participants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), index=True)
    nickname: Mapped[str] = mapped_column(String(20))
    lat: Mapped[float] = mapped_column(Float)  # 소수점 3자리로 반올림된 값만 저장
    lng: Mapped[float] = mapped_column(Float)
    nearest_stations: Mapped[list[dict]] = mapped_column(JSON, default=list)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)

    room: Mapped[Room] = relationship(back_populates="participants")


class ContentCache(Base):
    __tablename__ = "content_cache"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    hub_id: Mapped[int | None] = mapped_column(ForeignKey("hubs.id"), nullable=True)
    kind: Mapped[str] = mapped_column(String(20))
    cache_key: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    payload: Mapped[object] = mapped_column(JSON)
    fetched_at: Mapped[datetime] = mapped_column(DateTime)
