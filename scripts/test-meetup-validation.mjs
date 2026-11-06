import assert from "node:assert/strict";
import {
  parseKSTInput,
  kstInputAt,
  nextMinuteInput,
  validateCreate,
  validateNickname,
} from "../app/lib/meetup-validation.ts";
const now = Date.parse("2026-11-06T16:28:35.000Z"); // Nov 7, 01:28:35 KST
const fields = {
  title: "여의도한강공원",
  location: "여의도",
  amount: 3000,
  nickname: "한강러버",
};
// The minute selected as "now" is already in the past once seconds elapse.
const past = validateCreate(
  { ...fields, startsAt: parseKSTInput("2026-11-07T01:28") },
  now,
);
assert.equal(past.valid, false);
assert.match(past.errors.startsAt, /이미 지났어요/);
assert.equal(past.errors.title, undefined);
assert.equal(nextMinuteInput(now), "2026-11-07T01:29");
assert.equal(
  nextMinuteInput(Date.parse("2026-11-06T16:28:00Z")),
  "2026-11-07T01:29",
);
for (const amount of [0, 1, 1000, 2000, 3000, 12345, 50000])
  assert.equal(
    validateCreate(
      { ...fields, amount, startsAt: parseKSTInput("2026-11-07T01:29") },
      now,
    ).valid,
    true,
  );
assert.equal(parseKSTInput("2026-11-07T01:29"), "2026-11-06T16:29:00.000Z");
assert.equal(parseKSTInput("2026-11-07T01:29:30"), "2026-11-06T16:29:30.000Z");
assert.equal(
  parseKSTInput("2026-11-07T01:29:30.125"),
  "2026-11-06T16:29:30.125Z",
);
for (const value of [
  "",
  "2026-02-30T10:00",
  "2026-11-07T24:00",
  "2026-13-01T01:00",
  "2026-11-07T01:60",
])
  assert.equal(parseKSTInput(value), null);
assert.equal(
  kstInputAt(Date.parse("2026-12-31T15:01:00Z")),
  "2027-01-01T00:01",
);
for (const amount of [undefined, null, "0", -1, 50001, 1.5, NaN, Infinity])
  assert.ok(
    validateCreate(
      { ...fields, amount, startsAt: parseKSTInput("2026-11-07T01:29") },
      now,
    ).errors.amount,
  );
assert.ok(
  validateCreate(
    { ...fields, title: " ", startsAt: "2026-11-06T16:29:00Z" },
    now,
  ).errors.title,
);
assert.ok(
  validateCreate(
    { ...fields, location: " ", startsAt: "2026-11-06T16:29:00Z" },
    now,
  ).errors.location,
);
assert.ok(
  validateCreate(
    { ...fields, nickname: undefined, startsAt: "2026-11-06T16:29:00Z" },
    now,
  ).errors.nickname,
);
assert.ok(validateNickname(" ").error);
assert.ok(validateNickname("가".repeat(21)).error);
assert.equal(validateNickname("가".repeat(20)).error, "");
assert.equal(validateNickname("  한강  러버  ").nickname, "한강 러버");
assert.ok(validateNickname("닉\u0000네임").error);
console.log(
  "PASS: current-minute regression, explicit KST, optional seconds, invalid calendar dates, year rollover, deposit-free option, precise field errors.",
);
