import { session } from "../../lib/session";
import { simulatedReceipt } from "../../lib/payments";
export const dynamic = "force-dynamic";
const json = (x: unknown, s = 200) =>
  Response.json(x, { status: s, headers: { "Cache-Control": "no-store" } });
const fail = (message: string, s = 409) => json({ error: message }, s);
const uid = () => crypto.randomUUID();
type Room = {
  id: string;
  owner_id: string;
  state: string;
  starts_at: string;
  amount: number;
};
export async function GET(req: Request) {
  try {
    const c = await session();
    if (!c) return json({ authenticated: false });
    const { db, user } = c;
    const rooms = await db
      .prepare(
        `SELECT m.*,(SELECT COUNT(*) FROM guests g WHERE g.meetup_id=m.id) AS guest_count,(SELECT COUNT(*) FROM guests g WHERE g.meetup_id=m.id AND g.payment='paid') AS paid_count FROM meetups m JOIN guests g ON g.meetup_id=m.id AND g.user_id=? ORDER BY m.created_at DESC,m.id`,
      )
      .bind(user.userId)
      .all();
    const id = new URL(req.url).searchParams.get("id");
    let detail = null;
    if (id) {
      const room = await db
        .prepare(
          "SELECT m.* FROM meetups m JOIN guests g ON g.meetup_id=m.id WHERE m.id=? AND g.user_id=?",
        )
        .bind(id, user.userId)
        .first();
      if (!room) return fail("참여한 약속만 볼 수 있어요.", 403);
      const [people, cs, vs, ex] = await db.batch([
        db
          .prepare(
            "SELECT g.*,u.name FROM guests g JOIN members u ON u.id=g.user_id WHERE g.meetup_id=? ORDER BY g.id",
          )
          .bind(id),
        db
          .prepare(
            "SELECT * FROM claims WHERE meetup_id=? ORDER BY created_at,id",
          )
          .bind(id),
        db
          .prepare(
            "SELECT v.* FROM votes v JOIN claims c ON c.id=v.claim_id WHERE c.meetup_id=?",
          )
          .bind(id),
        db
          .prepare(
            "SELECT * FROM expenses WHERE meetup_id=? ORDER BY created_at DESC,id",
          )
          .bind(id),
      ]);
      detail = {
        room,
        people: people.results,
        claims: cs.results,
        votes: vs.results,
        expenses: ex.results,
      };
    }
    return json({
      authenticated: true,
      user: { id: user.userId, name: user.displayName },
      rooms: rooms.results,
      detail,
      paymentMode: "simulation",
      serverNow: new Date().toISOString(),
    });
  } catch (e) {
    console.error(e);
    return fail("약속을 불러오지 못했어요. 다시 시도해 주세요.", 500);
  }
}
export async function POST(req: Request) {
  try {
    if (req.headers.get("origin") !== new URL(req.url).origin)
      return fail("허용되지 않은 요청입니다.", 403);
    const c = await session();
    if (!c) return fail("로그인이 필요해요.", 401);
    const { db, user } = c;
    let b: Record<string, unknown>;
    try {
      b = (await req.json()) as Record<string, unknown>;
    } catch {
      return fail("잘못된 요청입니다.", 400);
    }
    if (!b || typeof b !== "object") return fail("잘못된 요청입니다.", 400);
    if (b.action === "create") {
      if (
        typeof b.title !== "string" ||
        !b.title.trim() ||
        b.title.length > 60 ||
        typeof b.location !== "string" ||
        !b.location.trim() ||
        b.location.length > 100 ||
        typeof b.startsAt !== "string" ||
        !Number.isFinite(Date.parse(b.startsAt)) ||
        Date.parse(b.startsAt) <= Date.now() ||
        ![1000, 3000].includes(Number(b.amount))
      )
        return fail("약속 이름·장소·미래 시간과 예약금을 확인해 주세요.", 400);
      const id = uid(),
        code = uid().replaceAll("-", "").slice(0, 12).toUpperCase();
      await db.batch([
        db
          .prepare(
            "INSERT INTO meetups(id,owner_id,title,location,starts_at,amount,code) VALUES(?,?,?,?,?,?,?)",
          )
          .bind(
            id,
            user.userId,
            b.title.trim(),
            b.location.trim(),
            new Date(b.startsAt).toISOString(),
            Number(b.amount),
            code,
          ),
        db
          .prepare("INSERT INTO guests(id,meetup_id,user_id) VALUES(?,?,?)")
          .bind(uid(), id, user.userId),
      ]);
      return json({ message: "새로운 서울 약속이 생겼어요!", id });
    }
    if (b.action === "join") {
      if (typeof b.code !== "string")
        return fail("초대 코드를 입력해 주세요.", 400);
      const room = await db
        .prepare("SELECT * FROM meetups WHERE code=?")
        .bind(b.code.trim().toUpperCase())
        .first<Room>();
      if (!room) return fail("초대 코드를 찾을 수 없어요.", 404);
      const existing = await db
        .prepare("SELECT id FROM guests WHERE meetup_id=? AND user_id=?")
        .bind(room.id, user.userId)
        .first();
      if (existing)
        return json({ message: "이미 참여한 약속이에요.", id: room.id });
      const r = await db
        .prepare(
          `INSERT INTO guests(id,meetup_id,user_id) SELECT ?,id,? FROM meetups WHERE id=? AND state='open' AND starts_at>? AND (SELECT COUNT(*) FROM guests WHERE meetup_id=meetups.id)<20 RETURNING id`,
        )
        .bind(uid(), user.userId, room.id, new Date().toISOString())
        .all();
      return r.results.length
        ? json({ message: "약속에 합류했어요.", id: room.id })
        : fail("확정·마감된 약속이거나 정원 20명이 찼어요.");
    }
    if (typeof b.id !== "string") return fail("약속을 선택해 주세요.", 400);
    const room = await db
      .prepare(
        "SELECT m.* FROM meetups m JOIN guests g ON g.meetup_id=m.id WHERE m.id=? AND g.user_id=?",
      )
      .bind(b.id, user.userId)
      .first<Room>();
    if (!room) return fail("약속 참여자만 사용할 수 있어요.", 403);
    const isHost = room.owner_id === user.userId,
      now = new Date().toISOString();
    if (b.action === "pay") {
      if (
        typeof b.provider !== "string" ||
        !["kakao", "toss"].includes(b.provider)
      )
        return fail("결제수단을 선택해 주세요.", 400);
      const receipt = simulatedReceipt(b.provider);
      const r = await db
        .prepare(
          `UPDATE guests SET payment='paid',provider=?,payment_ref=? WHERE meetup_id=? AND user_id=? AND payment='unpaid' AND EXISTS(SELECT 1 FROM meetups m WHERE m.id=guests.meetup_id AND m.state='open' AND m.starts_at>?) RETURNING id`,
        )
        .bind(receipt.provider, receipt.paymentRef, room.id, user.userId, now)
        .all();
      return r.results.length
        ? json({
            message: "모의 예약금이 예치됐어요. 실제 결제는 발생하지 않았어요.",
          })
        : fail("이미 예치했거나 신청이 마감된 약속이에요.");
    }
    if (b.action === "lock") {
      if (!isHost) return fail("모임장만 약속을 확정할 수 있어요.", 403);
      const r = await db
        .prepare(
          `UPDATE meetups SET state='locked' WHERE id=? AND state='open' AND starts_at>? AND (SELECT COUNT(*) FROM guests WHERE meetup_id=meetups.id)>=2 AND NOT EXISTS(SELECT 1 FROM guests WHERE meetup_id=meetups.id AND payment!='paid') RETURNING id`,
        )
        .bind(room.id, now)
        .all();
      return r.results.length
        ? json({ message: "약속 확정! 참여자 명단과 예약금이 고정됐어요." })
        : fail("시작 전에 2명 이상 참여하고 모두 예치해야 확정할 수 있어요.");
    }
    if (b.action === "checkin") {
      const r = await db
        .prepare(
          `UPDATE guests SET checked_at=? WHERE meetup_id=? AND user_id=? AND checked_at IS NULL AND EXISTS(SELECT 1 FROM meetups m WHERE m.id=guests.meetup_id AND m.state='locked') RETURNING id`,
        )
        .bind(now, room.id, user.userId)
        .all();
      return r.results.length
        ? json({
            message:
              "도착 시간을 기록했어요. 위치 인증 없이 직접 체크인하는 방식이에요.",
          })
        : fail("확정된 약속에서 한 번만 체크인할 수 있어요.");
    }
    if (b.action === "claim") {
      if (
        typeof b.targetId !== "string" ||
        b.targetId === user.userId ||
        typeof b.reason !== "string" ||
        !b.reason.trim() ||
        b.reason.length > 200
      )
        return fail("투표 대상과 사용 목적을 입력해 주세요.", 400);
      const r = await db
        .prepare(
          `INSERT INTO claims(id,meetup_id,target_id,creator_id,reason) SELECT ?,m.id,g.user_id,?,? FROM meetups m JOIN guests g ON g.meetup_id=m.id WHERE m.id=? AND m.state='locked' AND m.starts_at<=? AND g.user_id=? AND g.payment='paid' AND (g.checked_at IS NULL OR g.checked_at>m.starts_at) ON CONFLICT DO NOTHING RETURNING id`,
        )
        .bind(uid(), user.userId, b.reason.trim(), room.id, now, b.targetId)
        .all();
      return r.results.length
        ? json({
            message:
              "지각 예약금 사용 투표를 열었어요. 당사자를 제외한 전원이 동의해야 해요.",
          })
        : fail(
            "시작 이후 지각·미체크인 참여자에 대해 한 번만 제안할 수 있어요.",
          );
    }
    if (b.action === "vote") {
      if (typeof b.claimId !== "string" || typeof b.agree !== "boolean")
        return fail("투표 값을 확인해 주세요.", 400);
      const insert = db
        .prepare(
          `INSERT INTO votes(id,claim_id,voter_id,agree) SELECT ?,c.id,?,? FROM claims c JOIN meetups m ON m.id=c.meetup_id WHERE c.id=? AND c.meetup_id=? AND c.state='pending' AND c.target_id!=? AND m.state='locked' AND EXISTS(SELECT 1 FROM guests g WHERE g.meetup_id=m.id AND g.user_id=?) ON CONFLICT DO NOTHING`,
        )
        .bind(
          uid(),
          user.userId,
          b.agree ? 1 : 0,
          b.claimId,
          room.id,
          user.userId,
          user.userId,
        );
      // D1 batch is atomic. Resolve once; a missing vote can never count as consent.
      await db.batch([
        insert,
        db
          .prepare(
            `UPDATE claims SET state='rejected' WHERE id=? AND meetup_id=? AND state='pending' AND EXISTS(SELECT 1 FROM votes WHERE claim_id=claims.id AND agree=0)`,
          )
          .bind(b.claimId, room.id),
        db
          .prepare(
            `UPDATE claims SET state='approved' WHERE id=? AND meetup_id=? AND state='pending' AND (SELECT COUNT(*) FROM guests WHERE meetup_id=claims.meetup_id AND user_id!=claims.target_id)>=1 AND NOT EXISTS(SELECT 1 FROM guests g WHERE g.meetup_id=claims.meetup_id AND g.user_id!=claims.target_id AND NOT EXISTS(SELECT 1 FROM votes v WHERE v.claim_id=claims.id AND v.voter_id=g.user_id AND v.agree=1))`,
          )
          .bind(b.claimId, room.id),
        db
          .prepare(
            `UPDATE guests SET payment=CASE WHEN c.state='approved' THEN 'forfeited' ELSE 'refunded' END FROM claims c WHERE c.id=? AND c.meetup_id=? AND c.state IN ('approved','rejected') AND guests.meetup_id=c.meetup_id AND guests.user_id=c.target_id AND guests.payment='paid'`,
          )
          .bind(b.claimId, room.id),
      ]);
      const vote = await db
        .prepare("SELECT id FROM votes WHERE claim_id=? AND voter_id=?")
        .bind(b.claimId, user.userId)
        .first();
      return vote
        ? json({
            message:
              "투표가 기록됐어요. 전원 동의 시에만 모의 모임비로 전환돼요.",
          })
        : fail("당사자는 투표할 수 없거나 이미 종료된 투표예요.");
    }
    if (b.action === "settle") {
      if (!isHost) return fail("모임장만 정산할 수 있어요.", 403);
      const results = await db.batch([
        db
          .prepare(
            `UPDATE meetups SET state='settled' WHERE id=? AND state='locked' AND starts_at<=? AND NOT EXISTS(SELECT 1 FROM claims WHERE meetup_id=meetups.id AND state='pending') RETURNING id`,
          )
          .bind(room.id, now),
        db
          .prepare(
            `UPDATE guests SET payment='refunded' WHERE meetup_id=? AND payment='paid' AND EXISTS(SELECT 1 FROM meetups WHERE id=? AND state='settled')`,
          )
          .bind(room.id, room.id),
      ]);
      return results[0].results.length
        ? json({
            message:
              "정산 완료! 모임비로 전환되지 않은 예약금은 모의 환불됐어요.",
          })
        : fail("약속 시작 후, 모든 투표가 끝나야 정산할 수 있어요.");
    }
    if (b.action === "cancel") {
      if (!isHost) return fail("모임장만 취소할 수 있어요.", 403);
      const results = await db.batch([
        db
          .prepare(
            `UPDATE meetups SET state='canceled' WHERE id=? AND (state='open' OR (state='locked' AND starts_at>?)) RETURNING id`,
          )
          .bind(room.id, now),
        db
          .prepare(
            `UPDATE guests SET payment='refunded' WHERE meetup_id=? AND payment='paid' AND EXISTS(SELECT 1 FROM meetups WHERE id=? AND state='canceled')`,
          )
          .bind(room.id, room.id),
      ]);
      return results[0].results.length
        ? json({
            message: "약속을 취소하고 예치된 모의 예약금을 모두 환불했어요.",
          })
        : fail("확정 후 시작된 약속은 투표를 마치고 정산해 주세요.");
    }
    if (b.action === "spend") {
      if (!isHost) return fail("모임장만 사용 내역을 기록할 수 있어요.", 403);
      if (
        !Number.isInteger(b.amount) ||
        Number(b.amount) <= 0 ||
        typeof b.memo !== "string" ||
        !b.memo.trim() ||
        b.memo.length > 100
      )
        return fail("양의 정수 금액과 사용처를 입력해 주세요.", 400);
      const r = await db
        .prepare(
          `INSERT INTO expenses(id,meetup_id,amount,memo,created_by) SELECT ?,m.id,?,?,? FROM meetups m WHERE m.id=? AND m.state IN ('locked','settled') AND (SELECT COUNT(*)*m.amount FROM guests WHERE meetup_id=m.id AND payment='forfeited')-COALESCE((SELECT SUM(amount) FROM expenses WHERE meetup_id=m.id),0)>=? RETURNING id`,
        )
        .bind(
          uid(),
          Number(b.amount),
          b.memo.trim(),
          user.userId,
          room.id,
          Number(b.amount),
        )
        .all();
      return r.results.length
        ? json({
            message:
              "모의 모임비 사용 내역을 기록했어요. 실제 송금·결제는 없어요.",
          })
        : fail("사용 가능한 모의 모임비가 부족해요.");
    }
    return fail("지원하지 않는 요청입니다.", 400);
  } catch (e) {
    console.error(e);
    return fail("처리하지 못했어요. 잠시 후 다시 시도해 주세요.", 500);
  }
}
