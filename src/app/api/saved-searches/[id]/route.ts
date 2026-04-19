import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const existing = await prisma.savedSearch.findUnique({
    where: { id: params.id },
  });
  if (!existing || existing.userId !== auth.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.savedSearch.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
