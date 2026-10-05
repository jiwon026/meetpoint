"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Loading } from "@/components/ui/Loading";
import { CARD, PRIMARY_BUTTON } from "@/components/ui/styles";
import { useRoom } from "@/lib/api/hooks";
import type { RoomOut } from "@/lib/api/types";

type Props = { slug: string; children: (room: RoomOut) => ReactNode };

export function RoomGate({ slug, children }: Props) {
  const room = useRoom(slug);
  // 한번 불러온 뒤에는 폴링이 잠깐 실패해도 마지막 내용을 계속 보여준다.
  if (room.data) return <>{children(room.data)}</>;
  if (room.error) {
    return (
      <section role="alert" className={`${CARD} space-y-4 text-center`}>
        <p className="font-semibold">{room.error.message}</p>
        <Link href="/" className={PRIMARY_BUTTON}>
          새 방 만들기
        </Link>
      </section>
    );
  }
  return <Loading />;
}
