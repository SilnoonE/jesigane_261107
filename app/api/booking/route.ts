import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(
    new Date(),
  );
const nowKST = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replace(" ", "T");
async function context() {
  const user = await getChatGPTUser();
  if (!user) return null;
  if (!env.DB) throw new Error("DB unavailable");
  const db = env.DB;
  // Owner-private on first launch: first authenticated visitor is administrator.
  await db
    .prepare(
      `INSERT INTO members(id,name,email,role) VALUES(?,?,?,CASE WHEN NOT EXISTS(SELECT 1 FROM members) THEN 'admin' ELSE 'member' END) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email`,
    )
    .bind(user.userId, user.displayName, user.email)
    .run();
  const member = await db
    .prepare("SELECT role FROM members WHERE id=?")
    .bind(user.userId)
    .first();
  return { db, user, admin: member?.role === "admin" };
}
export async function GET() {
  try {
    const c = await context();
    if (!c) return json({ authenticated: false });
    const { db, user, admin } = c;
    const count = await db
      .prepare("SELECT COUNT(*) n FROM slots")
      .first<{ n: number }>();
    if (!count?.n) {
      const statements = [];
      for (let day = 1; day <= 14; day++) {
        const d = new Date(`${today()}T00:00:00+09:00`);
        d.setUTCDate(d.getUTCDate() + day);
        const date = new Intl.DateTimeFormat("sv-SE", {
          timeZone: "Asia/Seoul",
        }).format(d);
        for (const time of [
          "10:00",
          "10:30",
          "11:00",
          "11:30",
          "14:00",
          "14:30",
          "15:00",
          "15:30",
          "16:00",
          "16:30",
        ])
          statements.push(
            db
              .prepare(
                "INSERT OR IGNORE INTO slots(id,date,time) VALUES(?,?,?)",
              )
              .bind(`${date}_${time}`, date, time),
          );
      }
      await db.batch(statements);
    }
    const slotRows = await db
      .prepare(
        `SELECT s.*, (SELECT COUNT(*) FROM entries e WHERE e.slot_id=s.id AND e.active=1) AS total FROM slots s WHERE s.date>=? ORDER BY s.date,s.time`,
      )
      .bind(today())
      .all();
    const mine = await db
      .prepare(
        `SELECT e.*,s.date,s.time,s.open,CASE WHEN e.active=1 THEN (SELECT COUNT(*) FROM entries q WHERE q.slot_id=e.slot_id AND q.active=1 AND q.id<=e.id) ELSE 0 END AS position FROM entries e JOIN slots s ON s.id=e.slot_id WHERE e.user_id=? ORDER BY s.date DESC,s.time DESC,e.id DESC`,
      )
      .bind(user.userId)
      .all();
    const all = admin
      ? await db
          .prepare(
            `SELECT e.id,e.active,e.created_at,s.date,s.time,s.id AS slot_id,m.name,m.email,CASE WHEN e.active=1 THEN (SELECT COUNT(*) FROM entries q WHERE q.slot_id=e.slot_id AND q.active=1 AND q.id<=e.id) ELSE 0 END AS position FROM entries e JOIN slots s ON s.id=e.slot_id JOIN members m ON m.id=e.user_id WHERE s.date>=? ORDER BY s.date,s.time,e.id`,
          )
          .bind(today())
          .all()
      : null;
    return json({
      authenticated: true,
      user: { name: user.displayName, email: user.email, admin },
      today: today(),
      slots: slotRows.results,
      mine: mine.results,
      all: all?.results ?? [],
    });
  } catch (e) {
    console.error(e);
    return json(
      { error: "데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." },
      500,
    );
  }
}
export async function POST(req: Request) {
  try {
    if (req.headers.get("origin") !== new URL(req.url).origin)
      return json({ error: "허용되지 않은 요청입니다." }, 403);
    const c = await context();
    if (!c) return json({ error: "로그인이 필요해요." }, 401);
    const { db, user, admin } = c;
    const b = (await req.json()) as Record<string, unknown>;
    if (b.action === "join") {
      if (typeof b.slotId !== "string")
        return json({ error: "시간을 선택해 주세요." }, 400);
      // Atomic write checks open/time at INSERT; the DB assigns total queue order.
      const result = await db
        .prepare(
          `INSERT INTO entries(slot_id,user_id) SELECT id,? FROM slots WHERE id=? AND open=1 AND date||'T'||time > ? ON CONFLICT DO NOTHING RETURNING id`,
        )
        .bind(user.userId, b.slotId, nowKST())
        .all();
      if (!result.results.length)
        return json(
          {
            error:
              "이미 신청했거나 마감된 시간이에요. 목록을 새로고침해 주세요.",
          },
          409,
        );
      return json({
        message:
          "신청이 완료됐어요. 내 예약에서 확정 여부와 대기 순번을 확인하세요.",
      });
    }
    if (b.action === "cancel") {
      if (!Number.isInteger(b.id))
        return json({ error: "잘못된 예약입니다." }, 400);
      const result = await db
        .prepare(
          `UPDATE entries SET active=0 WHERE id=? AND active=1 AND user_id=? AND EXISTS(SELECT 1 FROM slots s WHERE s.id=entries.slot_id AND datetime(s.date||'T'||s.time||':00+09:00')>datetime('now')) RETURNING id`,
        )
        .bind(b.id, user.userId)
        .all();
      return result.results.length
        ? json({
            message: "취소됐어요. 첫 번째 대기자의 예약이 자동 확정돼요.",
          })
        : json({ error: "취소 가능한 본인 예약이 없어요." }, 409);
    }
    if (!admin) return json({ error: "관리자 권한이 필요합니다." }, 403);
    if (b.action === "toggle") {
      if (typeof b.slotId !== "string")
        return json({ error: "잘못된 시간입니다." }, 400);
      const r = await db
        .prepare("UPDATE slots SET open=1-open WHERE id=? RETURNING id")
        .bind(b.slotId)
        .all();
      return r.results.length
        ? json({ message: "접수 상태를 변경했어요. 기존 신청은 유지돼요." })
        : json({ error: "시간을 찾을 수 없어요." }, 404);
    }
    if (b.action === "create") {
      if (
        typeof b.date !== "string" ||
        typeof b.time !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(b.date) ||
        !/^([01]\d|2[0-3]):(00|30)$/.test(b.time)
      )
        return json({ error: "날짜와 30분 단위 시간을 입력해 주세요." }, 400);
      const dt = new Date(`${b.date}T${b.time}:00+09:00`);
      if (
        !Number.isFinite(dt.getTime()) ||
        dt.getTime() <= Date.now() ||
        new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(
          dt,
        ) !== b.date
      )
        return json({ error: "올바른 미래 날짜를 입력해 주세요." }, 400);
      const r = await db
        .prepare(
          "INSERT OR IGNORE INTO slots(id,date,time) VALUES(?,?,?) RETURNING id",
        )
        .bind(`${b.date}_${b.time}`, b.date, b.time)
        .all();
      return r.results.length
        ? json({ message: "새 예약 시간을 만들었어요." })
        : json({ error: "이미 등록된 시간이에요." }, 409);
    }
    return json({ error: "지원하지 않는 작업입니다." }, 400);
  } catch (e) {
    console.error(e);
    return json(
      { error: "요청을 처리하지 못했어요. 다시 시도해 주세요." },
      500,
    );
  }
}
