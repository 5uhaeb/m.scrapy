import { NextResponse } from "next/server";
import { gmailClient } from "@/lib/gmail";
import { handleGmailError, requireSession } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const gmail = gmailClient(auth.accessToken);
    const { data } = await gmail.users.getProfile({ userId: "me" });
    return NextResponse.json({
      emailAddress: data.emailAddress,
      messagesTotal: data.messagesTotal,
      threadsTotal: data.threadsTotal,
      historyId: data.historyId,
    });
  } catch (err) {
    return handleGmailError(err);
  }
}
