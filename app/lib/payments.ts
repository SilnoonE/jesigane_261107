// Sandbox adapter only. Real gateways must verify server-side approvals/webhooks
// and implement idempotent capture, refund and settlement before live use.
export const paymentMode = "simulation" as const;
export const providers = ["kakao", "toss"] as const;
export function simulatedReceipt(provider: string) {
  if (!providers.includes(provider as (typeof providers)[number]))
    throw Error("지원하지 않는 결제수단입니다.");
  return { provider, paymentRef: `mock_${provider}_${crypto.randomUUID()}` };
}
