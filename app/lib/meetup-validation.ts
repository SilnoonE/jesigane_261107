export type CreateField = "title" | "location" | "startsAt" | "amount";
export type CreateErrors = Partial<Record<CreateField, string>>;

// datetime-local has no time zone. Interpret the displayed wall clock as KST,
// regardless of the browser or server's own time zone. Accept optional seconds.
export function parseKSTInput(value: string): string | null {
  const m =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(
      value,
    );
  if (!m) return null;
  const [, y, mo, d, h, mi, s = "00", fraction = ""] = m;
  const normalized = `${y}-${mo}-${d}T${h}:${mi}:${s}.${fraction.padEnd(3, "0")}+09:00`;
  const ms = Date.parse(normalized);
  if (!Number.isFinite(ms)) return null;
  const wall = new Date(ms + 9 * 3600000).toISOString();
  if (wall.slice(0, 19) !== `${y}-${mo}-${d}T${h}:${mi}:${s}`) return null;
  return new Date(ms).toISOString();
}
export function kstInputAt(ms: number): string {
  return new Date(ms + 9 * 3600000).toISOString().slice(0, 16);
}
export function nextMinuteInput(ms: number): string {
  return kstInputAt((Math.floor(ms / 60000) + 1) * 60000);
}
export function validateCreate(input: Record<string, unknown>, now: number) {
  const errors: CreateErrors = {};
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const location =
    typeof input.location === "string" ? input.location.trim() : "";
  const startsAt = typeof input.startsAt === "string" ? input.startsAt : "";
  const time = Date.parse(startsAt);
  if (!title) errors.title = "약속 이름을 입력해 주세요.";
  else if (title.length > 60)
    errors.title = "약속 이름은 60자 이내로 입력해 주세요.";
  if (!location) errors.location = "만날 장소를 입력해 주세요.";
  else if (location.length > 100)
    errors.location = "장소는 100자 이내로 입력해 주세요.";
  if (!startsAt || !Number.isFinite(time))
    errors.startsAt = "약속 날짜와 시간을 확인해 주세요.";
  else if (time <= now)
    errors.startsAt =
      "선택한 시간이 이미 지났어요. 현재 한국 시각보다 늦은 시간을 선택해 주세요.";
  if (
    typeof input.amount !== "number" ||
    ![0, 1000, 3000].includes(input.amount)
  )
    errors.amount = "예약금 없음, 1,000원, 3,000원 중에서 선택해 주세요.";
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    title,
    location,
    startsAt,
    amount: input.amount as number,
  };
}
