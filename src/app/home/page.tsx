import { redirect } from "next/navigation";

export default async function HomeRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const { c } = await searchParams;
  const raw = Array.isArray(c) ? c[0] : c;
  const chatId = raw?.trim();
  redirect(
    chatId ? `/chat?c=${encodeURIComponent(chatId)}` : "/chat",
  );
}
