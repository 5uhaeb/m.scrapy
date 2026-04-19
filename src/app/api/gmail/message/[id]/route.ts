import { NextRequest, NextResponse } from "next/server";
import { getMessageDetail } from "@/lib/gmail";
import { handleGmailError, requireSession } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  if (!params.id) {
    return NextResponse.json({ error: "Missing message id" }, { status: 400 });
  }

  try {
    const detail = await getMessageDetail(auth.accessToken, params.id);
    return NextResponse.json(detail);
  } catch (err) {
    return handleGmailError(err);
  }
}
