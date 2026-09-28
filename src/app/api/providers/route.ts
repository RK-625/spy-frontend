import { NextResponse } from "next/server";
import { listProviderKeyStatuses } from "@/lib/providers/keys/resolve-key";

/** Keychain access is a native module — must not run on Edge. */
export const runtime = "nodejs";

/** Which providers have a key and where it comes from; never the key itself. */
export async function GET() {
  const providers = await listProviderKeyStatuses();
  return NextResponse.json({ ok: true, providers });
}
