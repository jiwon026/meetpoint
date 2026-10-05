import type { Metadata } from "next";
import type { ReactNode } from "react";
import { roomMetadata } from "@/lib/roomMeta";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  return roomMetadata(slug);
}

export default function RoomLayout({ children }: { children: ReactNode }) {
  return children;
}
