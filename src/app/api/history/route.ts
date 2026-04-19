import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const rows = await prisma.searchHistory.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      query: r.query,
      filters: safeParse(r.filters),
      resultCnt: r.resultCnt,
      createdAt: r.createdAt,
    }))
  );
}

export async function DELETE() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  await prisma.searchHistory.deleteMany({ where: { userId: auth.userId } });
  return NextResponse.json({ ok: true });
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
