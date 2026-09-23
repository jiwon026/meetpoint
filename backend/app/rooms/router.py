from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_geocoder, get_matrix
from app.geocoding.kakao import Geocoder
from app.rooms import service
from app.schemas import (
    ParticipantCreate,
    ParticipantOut,
    ResultOut,
    RoomCreate,
    RoomOut,
    StationOut,
)
from app.stations import search_stations
from app.transit.matrix import StationTimeMatrix

router = APIRouter()


@router.post("/rooms", response_model=RoomOut, status_code=201)
def create_room(data: RoomCreate, db: Session = Depends(get_db)) -> RoomOut:
    return service.room_out(service.create_room(db, data))


@router.get("/rooms/{slug}", response_model=RoomOut)
def get_room(slug: str, db: Session = Depends(get_db)) -> RoomOut:
    return service.room_out(service.get_room(db, slug))


@router.post("/rooms/{slug}/participants", response_model=ParticipantOut, status_code=201)
def add_participant(
    slug: str,
    data: ParticipantCreate,
    db: Session = Depends(get_db),
    geocoder: Geocoder = Depends(get_geocoder),
) -> ParticipantOut:
    room = service.get_room(db, slug)
    return service.participant_out(service.add_participant(db, room, data, geocoder))


@router.get("/rooms/{slug}/result", response_model=ResultOut)
def get_result(
    slug: str,
    db: Session = Depends(get_db),
    matrix: StationTimeMatrix = Depends(get_matrix),
) -> ResultOut:
    room = service.get_room(db, slug)
    return service.compute_result(db, room, matrix)


@router.get("/stations", response_model=list[StationOut])
def stations(q: str = Query(default="", max_length=20), db: Session = Depends(get_db)) -> list[StationOut]:
    return [StationOut(id=s.id, name=s.name, line=s.line) for s in search_stations(db, q)]
