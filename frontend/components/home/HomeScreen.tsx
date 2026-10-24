"use client";

import { useState } from "react";
import type { Origin, OriginMode } from "@/components/join/OriginSearch";
import { DateStepper } from "@/components/ui/DateStepper";
import { HOME_TOUR } from "@/components/ui/tourSteps";
import { useTour } from "@/components/ui/useTour";
import { SlowNote } from "@/components/ui/Loading";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StickyAction } from "@/components/ui/StickyAction";
import { useToast } from "@/components/ui/Toast";
import { CARD, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/styles";
import { track } from "@/lib/analytics";
import { useStartMeeting } from "@/lib/api/hooks";
import type { ParticipantCreate } from "@/lib/api/types";
import { MAX_MEET_DAYS_AHEAD, MAX_PARTICIPANTS } from "@/lib/constants";
import { addDaysIso, daysBetween } from "@/lib/format";
import { MSG_INVITE_READY, MSG_PRIVACY, msgCouldNotAdd } from "@/lib/messages";
import { addMine } from "@/lib/myParticipants";
import { dateTitle } from "@/components/join/RoomSummary";
import { OriginRow } from "./OriginRow";

// complete가 false면 방은 만들었지만 넣지 못한 사람이 있다. 그 방의 사람 추가 화면에서 이어서 넣는다.
type Props = {
  today: string;
  onStarted: (slug: string, complete: boolean) => void;
};

type Person = {
  key: number;
  name: string;
  mode: OriginMode;
  origin: Origin | null;
};

const MIN_PEOPLE = 2;
const DEFAULT_DAYS_AHEAD = 7;
// 방은 서울로 만든다. 경기와 인천은 추천 화면의 필터에서 켤 수 있다.
const ROOM_REGION = "서울";


function fallbackName(index: number): string {
  return index === 0 ? "나" : `친구 ${index}`;
}

function blankPerson(key: number): Person {
  return { key, name: "", mode: "station", origin: null };
}

function firstEmptyKey(people: readonly Person[]): number | null {
  return people.find((person) => person.origin === null)?.key ?? null;
}

function toBody(nickname: string, origin: Origin): ParticipantCreate {
  return origin.kind === "station" ? { nickname, station_id: origin.stationId } : { nickname, address: origin.address };
}

export function HomeScreen({ today, onStarted }: Props) {
  const toast = useToast();
  const [people, setPeople] = useState<Person[]>(() => [blankPerson(0), blankPerson(1)]);
  const [nextKey, setNextKey] = useState(MIN_PEOPLE);
  const [openKey, setOpenKey] = useState<number | null>(0);
  // 처음 들어왔을 때는 자판이 올라오지 않게 초점을 주지 않고, 한 번이라도 손을 댄 뒤부터 펼친 줄의 검색 칸에 초점을 준다.
  const [touched, setTouched] = useState(false);
  // 사용자가 고르기 전에는 오늘에서 일주일 뒤. today는 첫 렌더에서 빈 문자열일 수 있다 (app/page.tsx 참고).
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  // 친구 출발역을 몰라 내 것만 넣고 링크로 부르는 길을 골랐는지.
  const [inviting, setInviting] = useState(false);
  const start = useStartMeeting();
  // 사용법 보기를 누르면 예시 방의 화면까지 넘어가며 사용법을 보여주고 이 화면으로 돌아온다.
  const tour = useTour("home", HOME_TOUR, "/");
  // 성공 뒤 다른 화면으로 넘어갈 때까지도 다시 누를 수 없게 막는다 (방이 두 개 생기지 않게).
  const busy = start.isPending || start.isSuccess;

  const meetDate = pickedDate ?? (today ? addDaysIso(today, DEFAULT_DAYS_AHEAD) : "");
  const defaultTitle = meetDate ? dateTitle(meetDate) : "";
  const filledCount = people.filter((person) => person.origin !== null).length;
  const ready = filledCount >= MIN_PEOPLE && meetDate !== "";

  const update = (key: number, change: Partial<Person>) => {
    setPeople((current) => current.map((person) => (person.key === key ? { ...person, ...change } : person)));
  };

  const onOriginChange = (key: number, origin: Origin | null) => {
    const next = people.map((person) => (person.key === key ? { ...person, origin } : person));
    setPeople(next);
    setProblem(null);
    setTouched(true);
    if (origin === null) {
      setOpenKey(key);
      return;
    }
    // 고르면 다음 빈 줄을 바로 펼친다.
    setOpenKey(firstEmptyKey(next));
    track("origin_drafted", {
      count: next.filter((person) => person.origin !== null).length,
    });
  };

  const addPerson = () => {
    setPeople((current) => [...current, blankPerson(nextKey)]);
    setOpenKey(nextKey);
    setTouched(true);
    setNextKey((key) => key + 1);
  };

  const removePerson = (key: number) => {
    const next = people.filter((person) => person.key !== key);
    setPeople(next);
    if (openKey === key) setOpenKey(firstEmptyKey(next));
  };

  // invite가 참이면 추천 대신 그 방의 참여 화면으로 가서 친구에게 링크를 보내게 한다.
  const submit = (invite: boolean) => {
    setInviting(invite);
    const entries = people.flatMap((person, index) =>
      person.origin
        ? [
            {
              nickname: person.name.trim() || fallbackName(index),
              origin: person.origin,
            },
          ]
        : [],
    );
    setProblem(null);
    start.mutate(
      {
        room: {
          title: title.trim() || defaultTitle,
          meet_date: meetDate,
          regions: [ROOM_REGION],
          themes: [],
        },
        people: entries.map((entry) => toBody(entry.nickname, entry.origin)),
      },
      {
        onSuccess: ({ room, added, failed, skipped }) => {
          track("room_created", {
            regions: ROOM_REGION,
            region_count: 1,
            theme: "none",
            days_until_meet: daysBetween(today, room.meet_date),
          });
          added.forEach(({ index, participant }, order) => {
            addMine(room.slug, participant.id);
            track("participant_added", {
              method: entries[index].origin.kind,
              participant_count: order + 1,
            });
          });
          if (failed.length > 0) {
            const [first] = failed;
            toast(msgCouldNotAdd(entries[first.index].nickname, first.message, failed.length - 1 + skipped));
          } else if (invite) {
            toast(MSG_INVITE_READY);
          }
          onStarted(room.slug, failed.length === 0 && !invite);
        },
        onError: (error) => setProblem(error.message),
      },
    );
  };

  return (
    <div className="space-y-5">
      <ProgressBar current={1} fill={0.2 + 0.4 * Math.min(filledCount, MIN_PEOPLE)} />
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">모두에게 공평한 만남 장소</h1>
        <p className="mt-1 text-sm text-ink-sub">출발역만 넣으면 모두에게 공평한 역을 골라드려요.</p>
        <button type="button" onClick={tour.open} className="mt-1 text-sm font-semibold text-primary underline">
          사용법 보기
        </button>
      </div>
      <section aria-label="출발지" data-tour="origins" className="space-y-2">
        <ul className="space-y-2">
          {people.map((person, index) => (
            <OriginRow
              key={person.key}
              fallbackName={fallbackName(index)}
              name={person.name}
              onNameChange={(name) => update(person.key, { name })}
              mode={person.mode}
              onModeChange={(mode) => update(person.key, { mode })}
              origin={person.origin}
              onOriginChange={(origin) => onOriginChange(person.key, origin)}
              open={openKey === person.key}
              focusSearch={touched}
              onOpen={() => {
                setOpenKey(person.key);
                setTouched(true);
              }}
              onRemove={people.length > MIN_PEOPLE ? () => removePerson(person.key) : undefined}
            />
          ))}
        </ul>
        {people.length < MAX_PARTICIPANTS && (
          <button type="button" onClick={addPerson} className={SECONDARY_BUTTON}>
            한 명 더
          </button>
        )}
      </section>
      <section className={`${CARD} space-y-3`}>
        <h2 className="text-sm font-semibold">약속 날짜</h2>
        {meetDate && (
          <DateStepper
            value={meetDate}
            min={today}
            max={addDaysIso(today, MAX_MEET_DAYS_AHEAD)}
            onChange={setPickedDate}
          />
        )}
        <details>
          <summary className="cursor-pointer text-sm text-ink-sub">모임 이름 붙이기</summary>
          <input
            aria-label="모임 이름"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={40}
            placeholder={defaultTitle}
            className={`${INPUT} mt-2`}
          />
        </details>
      </section>
      <p className="rounded-lg bg-track p-3 text-xs text-ink-sub">{MSG_PRIVACY}</p>
      <StickyAction>
        <div data-tour="start" className="space-y-2">
          {problem !== null && (
            <p role="alert" className="text-center text-sm font-semibold text-accent">
              {problem}
            </p>
          )}
          <button type="button" onClick={() => submit(false)} disabled={!ready || busy} className={PRIMARY_BUTTON}>
            {busy
              ? inviting
                ? "방을 만드는 중"
                : "추천을 계산하는 중"
              : filledCount >= MIN_PEOPLE
                ? `추천 보기 (${filledCount}명)`
                : filledCount === 1
                  ? "출발지를 한 곳 더 넣어주세요"
                  : "출발지를 두 곳 넣어주세요"}
          </button>
          {/* 친구 출발역을 모르면 내 것만 넣고 방을 만들어 링크로 부른다. 두 명부터 추천이 나온다. */}
          {filledCount === 1 && !busy && (
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={meetDate === ""}
              className={SECONDARY_BUTTON}
            >
              친구에게 링크 보내서 각자 넣기
            </button>
          )}
          {start.isPending && <SlowNote />}
        </div>
      </StickyAction>
    </div>
  );
}
