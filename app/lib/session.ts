import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../chatgpt-auth";
export async function session() {
  const user = await getChatGPTUser();
  if (!user) return null;
  if (!env.DB) throw Error("DB unavailable");
  const db = env.DB;
  await db
    .prepare(
      `INSERT INTO members(id,name,email,role) VALUES(?,?,?,CASE WHEN NOT EXISTS(SELECT 1 FROM members) THEN 'admin' ELSE 'member' END) ON CONFLICT(id) DO NOTHING`,
    )
    .bind(user.userId, "참여자", "")
    .run();
  return { db, user };
}
