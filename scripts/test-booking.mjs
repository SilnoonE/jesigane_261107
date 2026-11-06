// Direct identity headers are only for the isolated local production Worker.
// Hosted Sites validates/injects identity at its authentication gateway.
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5174";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw Error("Tests only run against loopback.");
const run = Date.now().toString(36),
  owner = "local_seedy";
async function api(user, body, origin = base) {
  const res = await fetch(base + "/api/booking", {
    signal: AbortSignal.timeout(30000),
    method: body ? "POST" : "GET",
    headers: {
      Connection: "close",
      ...(user
        ? {
            "oai-authenticated-user-id": user,
            "oai-authenticated-user-email": `${user}@sites.test`,
          }
        : {}),
      ...(body ? { "Content-Type": "application/json", Origin: origin } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const raw = await res.text();
  if (!raw.startsWith("{"))
    throw Error(
      user + " " + JSON.stringify(body) + " " + res.status + " " + raw,
    );
  return { status: res.status, body: JSON.parse(raw) };
}

// Load the authenticated route before exercising early-rejected POSTs on Miniflare.
assert.equal((await api(owner)).body.user.admin, true);
assert.equal(
  (
    await api(
      owner,
      { action: "create", date: "2099-12-10", time: "12:00" },
      "https://invalid.example",
    )
  ).status,
  403,
);
const users = Array.from({ length: 20 }, (_, i) => `test_${run}_${i}`);
await Promise.all(users.map((u) => api(u)));
assert.equal(
  (await api(users[0], { action: "create", date: "2099-12-10", time: "12:00" }))
    .status,
  403,
);
const date = "2099-12-10",
  time = `${String(10 + Math.floor(Math.random() * 12)).padStart(2, "0")}:${Math.random() < 0.5 ? "00" : "30"}`,
  slotId = `${date}_${time}`;
const created = await api(owner, { action: "create", date, time });
assert.ok([200, 409].includes(created.status));
const existingSlot = (await api(owner)).body.slots.find((s) => s.id === slotId);
if (!existingSlot.open) await api(owner, { action: "toggle", slotId });
const applied = await Promise.all(
  users.map((u) => api(u, { action: "join", slotId })),
);
assert.ok(applied.every((r) => r.status === 200));
let views = await Promise.all(users.map((u) => api(u)));
let entries = views.map((v) =>
  v.body.mine.find((e) => e.slot_id === slotId && e.active),
);
assert.equal(entries.filter((e) => e.position === 1).length, 1);
assert.deepEqual(
  entries.map((e) => e.position).sort((a, b) => a - b),
  Array.from({ length: 20 }, (_, i) => i + 1),
);
const duplicate = await Promise.all(
  Array.from({ length: 10 }, () => api(users[0], { action: "join", slotId })),
);
assert.ok(duplicate.every((r) => r.status === 409));
const leader = entries.findIndex((e) => e.position === 1),
  next = entries.findIndex((e) => e.position === 2);
assert.equal(
  (await api(users[next], { action: "cancel", id: entries[leader].id })).status,
  409,
);
assert.equal(
  (await api(users[leader], { action: "cancel", id: entries[leader].id }))
    .status,
  200,
);
const promoted = await api(users[next]);
assert.equal(
  promoted.body.mine.find((e) => e.slot_id === slotId && e.active).position,
  1,
);
assert.equal(
  (await api(users[leader], { action: "join", slotId })).status,
  200,
);
const rejoined = await api(users[leader]);
assert.equal(
  rejoined.body.mine.find((e) => e.slot_id === slotId && e.active).position,
  20,
);
await api(owner, { action: "toggle", slotId });
const stranger = `test_${run}_extra`;
await api(stranger);
assert.equal((await api(stranger, { action: "join", slotId })).status, 409);
assert.equal(
  (await api(owner, { action: "create", date: "2000-01-01", time: "10:00" }))
    .status,
  400,
);
assert.equal(
  (await api(owner, { action: "create", date: "2099-02-30", time: "10:00" }))
    .status,
  400,
);
assert.equal(
  (await api(owner, { action: "create", date: "2099-12-11", time: "10:15" }))
    .status,
  400,
);
// Cancel only the test-owned records; ordinary local demo bookings remain intact.
await Promise.all(
  users.map(async (u) => {
    const v = await api(u);
    const e = v.body.mine.find((e) => e.slot_id === slotId && e.active);
    if (e)
      assert.equal((await api(u, { action: "cancel", id: e.id })).status, 200);
  }),
);
assert.equal((await api(null, { action: "join", slotId: "none" })).status, 401);
console.log(
  "PASS: 20 concurrent users, unique leader, ordered queue, duplicate prevention, ownership, promotion, rejoin, closing, auth, CSRF, date validation.",
);
