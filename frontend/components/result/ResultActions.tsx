"use client";

import { Share2, UserPlus } from "lucide-react";
import { SMALL_BUTTON } from "@/components/ui/styles";

type Props = { people: number; onAddPeople: () => void; onShare: () => void };

// 추천 화면 맨 위 줄. 결과를 받은 친구가 자기 출발지를 넣거나, 약속을 잡는 사람이 결과를 보내는 길이다.
// 처음 열자마자 보이도록 위에 둔다(아래 고정 줄은 둘러보기 하나만 둔다, 2026-10-26).
export function ResultActions({ people, onAddPeople, onShare }: Props) {
  return (
    <div data-tour="result-actions" className="flex items-center gap-2">
      <span className="flex-1 text-sm text-ink-sub">{people}명이 넣었어요</span>
      <button type="button" onClick={onAddPeople} className={`${SMALL_BUTTON} inline-flex items-center gap-1`}>
        <UserPlus size={14} aria-hidden />
        사람 추가
      </button>
      <button type="button" onClick={onShare} className={`${SMALL_BUTTON} inline-flex items-center gap-1`}>
        <Share2 size={14} aria-hidden />
        공유하기
      </button>
    </div>
  );
}
