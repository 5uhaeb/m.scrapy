import { NextRequest, NextResponse } from "next/server";
import { gmailClient, parseMessage } from "@/lib/gmail";
import { handleGmailError, requireSession } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  if (!params.id) {
    return NextResponse.json({ error: "Missing thread id" }, { status: 400 });
  }

  try {
    const gmail = gmailClient(auth.accessToken);
    const { data } = await gmail.users.threads.get({
      userId: "me",
      id: params.id,
      format: "metadata",
      metadataHeaders: ["From", "To", "Cc", "Subject", "Date"],
    });

    const messages = (data.messages ?? []).map(parseMessage);

    return NextResponse.json({
      id: data.id,
      historyId: data.historyId,
      messages,
      messageCount: messages.length,
    });
  } catch (err) {
    return handleGmailError(err);
  }
}
