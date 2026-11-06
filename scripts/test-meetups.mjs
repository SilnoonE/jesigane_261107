import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5174";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw Error("Loopback tests only.");
const prefix = "meet_" + Date.now().toString(36),
  users = [0, 1, 2, 3, 4].map((i) => `${prefix}_${i}`);
async function api(user, body, id = "") {
  if (body && ["create", "join"].includes(body.action))
    body = { nickname: `친구${users.indexOf(user)}`, ...body };
  const res = await fetch(base + "/api/meetups" + (id ? "?id=" + id : ""), {
    method: body ? "POST" : "GET",
    headers: {
      ...(user
        ? {
            "oai-authenticated-user-id": user,
            "oai-authenticated-user-email": user + "@sites.test",
          }
        : {}),
      ...(body ? { Origin: base, "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const raw = await res.text();
  if (!raw.startsWith("{")) throw Error(`${res.status}: ${raw}`);
  return { status: res.status, body: JSON.parse(raw) };
}
async function ok(user, body) {
  const r = await api(user, body);
  assert.equal(r.status, 200, JSON.stringify(r));
  return r.body;
}
async function detail(id) {
  return (await api(users[0], null, id)).body.detail;
}
function fixture(sql) {
  execFileSync(
    process.execPath,
    [
      "--import",
      "./scripts/sites-env.mjs",
      "./node_modules/wrangler/bin/wrangler.js",
      "d1",
      "execute",
      "DB",
      "--local",
      "--config",
      "dist/server/wrangler.json",
      "--persist-to",
      ".wrangler/state",
      "--command",
      sql,
    ],
    { stdio: "pipe" },
  );
}
await api(users[0]);
assert.equal(
  (
    await api(users[0], {
      action: "create",
      title: "bad",
      location: "Seoul",
      startsAt: "2099-01-01",
      amount: 50001,
    })
  ).status,
  400,
);
const created = await ok(users[0], {
  action: "create",
  title: "서울 약속 통합 테스트",
  location: "여의도 한강공원",
  startsAt: new Date(Date.now() + 3600000).toISOString(),
  amount: 3000,
});
const id = created.id;
let d = await detail(id);
const code = d.room.code;
assert.equal((await api(users[4], null, id)).status, 403);
await Promise.all([1, 2, 3].map((i) => ok(users[i], { action: "join", code })));
await ok(users[1], { action: "join", code });
assert.equal((await detail(id)).people.length, 4);
assert.equal((await api(users[0], { action: "lock", id })).status, 409);
const pay = await Promise.all(
  Array.from({ length: 8 }, () =>
    api(users[0], { action: "pay", id, provider: "kakao" }),
  ),
);
assert.equal(pay.filter((p) => p.status === 200).length, 1);
await Promise.all(
  [1, 2, 3].map((i) => ok(users[i], { action: "pay", id, provider: "toss" })),
);
assert.equal((await api(users[1], { action: "lock", id })).status, 403);
await ok(users[0], { action: "lock", id });
assert.equal((await api(users[4], { action: "join", code })).status, 409);
assert.equal(
  (
    await api(users[0], {
      action: "claim",
      id,
      targetId: users[3],
      reason: "간식 사기",
    })
  ).status,
  409,
);
await ok(users[0], { action: "checkin", id });
assert.equal((await api(users[0], { action: "checkin", id })).status, 409);
// Controlled local fixture advances the meeting clock; never updates production.
const past = new Date(Date.now() - 60000).toISOString(),
  onTime = new Date(Date.now() - 120000).toISOString();
fixture(
  `UPDATE meetups SET starts_at='${past}' WHERE id='${id}'; UPDATE guests SET checked_at='${onTime}' WHERE meetup_id='${id}' AND user_id='${users[0]}';`,
);
assert.equal(
  (
    await api(users[1], {
      action: "claim",
      id,
      targetId: users[0],
      reason: "정시 도착자는 대상 아님",
    })
  ).status,
  409,
);
await ok(users[0], {
  action: "claim",
  id,
  targetId: users[3],
  reason: "다 같이 간식 사기",
});
d = await detail(id);
const claim = d.claims.find((c) => c.target_id === users[3]);
assert.equal(d.votes.length, 0);
assert.equal(
  (await api(users[3], { action: "vote", id, claimId: claim.id, agree: true }))
    .status,
  409,
);
await ok(users[0], { action: "vote", id, claimId: claim.id, agree: true });
await ok(users[1], { action: "vote", id, claimId: claim.id, agree: true });
d = await detail(id);
assert.equal(d.claims[0].state, "pending");
assert.equal(d.people.find((p) => p.user_id === users[3]).payment, "paid");
assert.equal((await api(users[0], { action: "settle", id })).status, 409);
await Promise.all(
  Array.from({ length: 5 }, () =>
    api(users[2], { action: "vote", id, claimId: claim.id, agree: true }),
  ),
);
d = await detail(id);
assert.equal(d.claims[0].state, "approved");
assert.equal(d.votes.filter((v) => v.claim_id === claim.id).length, 3);
assert.equal(d.people.find((p) => p.user_id === users[3]).payment, "forfeited");
assert.equal(
  (
    await api(users[1], {
      action: "spend",
      id,
      amount: 1000,
      memo: "모임장 아님",
    })
  ).status,
  403,
);
const spends = await Promise.all(
  Array.from({ length: 6 }, () =>
    api(users[0], { action: "spend", id, amount: 1000, memo: "친구들과 과자" }),
  ),
);
assert.equal(spends.filter((s) => s.status === 200).length, 3);
d = await detail(id);
assert.equal(
  d.expenses.reduce((s, e) => s + e.amount, 0),
  3000,
);
// A single no vote must refund, and a completed vote cannot be changed.
await ok(users[0], {
  action: "claim",
  id,
  targetId: users[2],
  reason: "반대 경로 테스트",
});
d = await detail(id);
const rejected = d.claims.find((c) => c.target_id === users[2]);
await ok(users[1], { action: "vote", id, claimId: rejected.id, agree: false });
d = await detail(id);
assert.equal(d.claims.find((c) => c.id === rejected.id).state, "rejected");
assert.equal(d.people.find((p) => p.user_id === users[2]).payment, "refunded");
await api(users[1], { action: "vote", id, claimId: rejected.id, agree: true });
d = await detail(id);
assert.equal(
  d.votes.find((v) => v.claim_id === rejected.id && v.voter_id === users[1])
    .agree,
  0,
);
await ok(users[0], { action: "settle", id });
d = await detail(id);
assert.equal(d.room.state, "settled");
assert.equal(d.people.filter((p) => p.payment === "refunded").length, 3);
assert.equal(d.people.filter((p) => p.payment === "forfeited").length, 1);
assert.equal(
  (
    await api(users[0], {
      action: "claim",
      id,
      targetId: users[1],
      reason: "정산 후 불가",
    })
  ).status,
  409,
);
const cancel = await ok(users[0], {
  action: "create",
  title: "취소 테스트",
  location: "남산",
  startsAt: new Date(Date.now() + 3600000).toISOString(),
  amount: 1000,
});
await ok(users[0], { action: "pay", id: cancel.id, provider: "kakao" });
fixture(`UPDATE meetups SET starts_at='${past}' WHERE id='${cancel.id}';`);
await ok(users[0], { action: "cancel", id: cancel.id });
const canceled = await detail(cancel.id);
assert.equal(canceled.room.state, "canceled");
assert.equal(canceled.people[0].payment, "refunded");
// Deposit-free plans must never require or manufacture a payment.
const free = await ok(users[0], {
  action: "create",
  title: "예약금 없는 한강 약속",
  location: "여의도",
  startsAt: new Date(Date.now() + 3600000).toISOString(),
  amount: 0,
});
let freeDetail = await detail(free.id);
assert.equal(freeDetail.people[0].payment, "waived");
await ok(users[1], { action: "join", code: freeDetail.room.code });
freeDetail = await detail(free.id);
assert.ok(freeDetail.people.every((p) => p.payment === "waived"));
assert.equal(
  (await api(users[0], { action: "pay", id: free.id, provider: "toss" }))
    .status,
  409,
);
await ok(users[0], { action: "lock", id: free.id });
await ok(users[1], { action: "checkin", id: free.id });
fixture(`UPDATE meetups SET starts_at='${past}' WHERE id='${free.id}';`);
assert.equal(
  (
    await api(users[0], {
      action: "claim",
      id: free.id,
      targetId: users[1],
      reason: "0원 지각비 불가",
    })
  ).status,
  409,
);
assert.equal(
  (
    await api(users[0], {
      action: "spend",
      id: free.id,
      amount: 1,
      memo: "0원 지출 불가",
    })
  ).status,
  409,
);
await ok(users[0], { action: "settle", id: free.id });
freeDetail = await detail(free.id);
assert.equal(freeDetail.room.state, "settled");
assert.equal(freeDetail.expenses.length, 0);
assert.ok(freeDetail.people.every((p) => p.payment === "waived"));
const invalidTime = await api(users[0], {
  action: "create",
  title: "지난 시간",
  location: "한강",
  startsAt: past,
  amount: 0,
});
assert.equal(invalidTime.status, 400);
assert.match(invalidTime.body.fieldErrors.startsAt, /이미 지났어요/);
assert.ok(invalidTime.body.serverNow);
// Profile names never become meetup nicknames; explicit room-scoped names do.
const noName = await api(users[0], {
  action: "create",
  title: "닉네임필수",
  location: "한강",
  startsAt: new Date(Date.now() + 3600000).toISOString(),
  amount: 1000,
  nickname: null,
});
assert.equal(noName.status, 400);
assert.ok(noName.body.fieldErrors.nickname);
const max = await ok(users[0], {
  action: "create",
  title: "직접 정한 금액",
  location: "남산",
  startsAt: new Date(Date.now() + 3600000).toISOString(),
  amount: 50000,
  nickname: "남산러버",
});
let md = await detail(max.id);
assert.equal(md.room.amount, 50000);
assert.equal(md.people[0].name, "남산러버");
const blank = await api(users[1], {
  action: "join",
  code: md.room.code,
  nickname: " ",
});
assert.equal(blank.status, 400);
const duplicateName = await api(users[1], {
  action: "join",
  code: md.room.code,
  nickname: "남산러버",
});
assert.equal(duplicateName.status, 409);
const raceNames = await Promise.all(
  [1, 2].map((i) =>
    api(users[i], {
      action: "join",
      code: md.room.code,
      nickname: "같은닉네임",
    }),
  ),
);
assert.equal(raceNames.filter((r) => r.status === 200).length, 1);
assert.equal(raceNames.filter((r) => r.status === 409).length, 1);
md = await detail(max.id);
assert.equal(md.people.length, 2);
await ok(users[0], {
  action: "nickname",
  id: max.id,
  nickname: "새로운닉네임",
});
md = await detail(max.id);
assert.equal(
  md.people.find((p) => p.user_id === users[0]).name,
  "새로운닉네임",
);
const other = await detail(id);
assert.equal(other.people.find((p) => p.user_id === users[0]).name, "친구0");
assert.equal(
  (await api(users[4], { action: "nickname", id: max.id, nickname: "침입" }))
    .status,
  403,
);
assert.equal(JSON.stringify(md).includes("@sites.test"), false);
const custom = await ok(users[0], {
  action: "create",
  title: "원단위 금액",
  location: "한강",
  startsAt: new Date(Date.now() + 3600000).toISOString(),
  amount: 12345,
  nickname: "다른모임닉",
});
assert.equal((await detail(custom.id)).room.amount, 12345);
fixture(`UPDATE guests SET nickname=NULL WHERE meetup_id='${custom.id}';`);
assert.equal((await detail(custom.id)).people[0].name, "닉네임 미설정");
await ok(users[0], {
  action: "nickname",
  id: custom.id,
  nickname: "기존약속닉",
});
assert.equal((await detail(custom.id)).people[0].name, "기존약속닉");
for (const amount of [50001, -1, 1.5])
  assert.equal(
    (
      await api(users[0], {
        action: "create",
        title: "한도검증",
        location: "한강",
        startsAt: new Date(Date.now() + 3600000).toISOString(),
        amount,
      })
    ).status,
    400,
  );
assert.equal((await api(null, { action: "create" })).status, 401);
console.log(
  "PASS: field-specific time errors, deposit-free plan create/join/lock/checkin/settle, 1000/3000 mock payments, membership privacy, frozen roster, unanimous consent, rejection refunds, immutable votes, concurrent overspend protection, cancellation and auth.",
);
