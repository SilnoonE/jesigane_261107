# 제시간에 — 서울에서, 우리 제시간에

**2026-11-07 · v0.2.1 개발 스냅샷**

[기획 과정](docs/2026-11-07-planning-process.md) · [현재 버전 구성](docs/2026-11-07-version.md) · [구조와 설계 결정](docs/architecture.md) · [변경 기록](CHANGELOG.md)

![남산타워와 한강 노을](public/images/seoul-sunset.webp)

남산타워·한강 노을을 배경으로 친구와 약속을 정하고 작은 예약금을 걸어보는 웹서비스입니다.
**현재 결제·환불·모임비 전환·사용은 모두 모의 기능입니다. 실제 돈은 오가지 않습니다.**

## 지금 가능한 일

- 약속 이름, 장소, 날짜·시간(KST), 예약금 없음(0원) 또는 1인 1,000원·3,000원으로 약속방 생성
- 12자리 초대 코드로 최대 20명 참여
- 카카오페이 또는 토스를 선택해 모의 예치 기록 저장
- 2명 이상이면 예약금 없는 약속은 결제 없이 확정, 예약금이 있다면 전원 예치 후 확정
- 확정 후 본인 체크인: 서버 시간 저장, 위치 인증 없음
- 시작 후 지각·미체크인 친구의 예약금 사용 투표 제안
- 당사자를 제외한 모든 참여자의 명시적인 동의가 있어야 가상 모임비 전환
- 한 명이라도 반대하면 해당 예약금 모의 환불, 미응답이면 보류
- 모임장만 모임비 잔액 안에서 사용처 기록, 참여자 전원 조회
- 투표 완료 후 남은 예약금 모의 환불·정산
- 미확정 약속은 시간이 지났어도 취소·모의 환불 가능
- 확정된 약속은 시작 전 취소·모의 환불 가능
- 홈의 '투표부터 모임비까지, 미리 체험'에서 샘플 친구로 전체 흐름 체험
- 기존 상담 예약·취소·대기·자동 승격·관리자는 /booking에서 유지

샘플 체험은 브라우저 메모리에서만 진행하며 실제 약속과 분리되어 있습니다. 페이지를 새로고침하거나 체험을 종료하면 초기화됩니다.
실제 약속방의 모의 금액·참여·투표·사용 내역은 서버 DB에 저장됩니다.
현재 사이트는 비공개 접근 범위를 유지합니다. 초대 코드는 사이트 접근 권한을 부여하지 않습니다. 친구와 실제 여러 계정으로 사용하려면 소유자가 Sites 공유 권한을 별도로 설정해야 합니다.

## 탑다운으로 읽는 순서

1. 홈페이지를 열어 샘플 약속에 들어갑니다.
2. 마지막 동의 버튼을 눌러 3,000원이 모임비로 바뀌는지 봅니다.
3. 사용 기록에 1,000원과 사용처를 적고 잔액 2,000원을 확인합니다.
4. app/seoul-app.tsx의 act 함수를 읽습니다. demo 분기는 체험, fetch 분기는 서버 요청입니다.
5. app/api/meetups/route.ts에서 vote 분기를 읽습니다.
6. db/schema.ts와 drizzle/0001_adorable_newton_destine.sql에서 관계와 UNIQUE를 확인합니다.
7. scripts/test-meetups.mjs를 읽고 버튼 뒤의 규칙을 확인합니다.
8. app/lib/payments.ts에서 실제 결제와 모의 어댑터의 경계를 확인합니다.

기존 상담 예약의 SQL·동시성 공부는 docs/consultation-guide.md에 따로 보관했습니다.

## 구조와 테이블

화면: React + TypeScript / 서버: Vinext API + Cloudflare Workers / SQL DB: D1 / 스키마: Drizzle / 로그인: Sites ChatGPT 인증.

```text
members (회원)
  ├─ meetups (약속방: 모임장, 일정, 금액, 초대 코드, 상태)
  └─ guests (참여자: 결제 상태, 모의 결제 참조, 체크인)
meetups
  ├─ claims (지각비 사용 제안: 대상, 목적, 상태)
  │    └─ votes (대상 제외 참여자의 찬성/반대)
  └─ expenses (모임비 사용 기록)
```

같은 약속의 같은 회원은 guests UNIQUE로 한 번만 참여합니다.
같은 대상의 투표는 한 번만 열 수 있습니다. 동일 투표에서 회원별 투표는 UNIQUE로 한 번만 기록됩니다.
모의 예치는 unpaid → paid 한 번만 바뀌며, 중복 요청으로 금액이 늘어나지 않습니다.
확정 후 참여자 추가가 금지되므로 투표의 분모가 고정됩니다.

약속 상태: open → locked → settled, 또는 시작 전 canceled. 미확정 open은 만료 후에도 canceled 가능.
예치 상태: unpaid → paid → refunded 또는 forfeited. 예약금 없는 약속은 waived(면제)이며 결제·지각비 투표를 사용하지 않습니다.
투표 상태: pending → approved 또는 rejected. 완료된 투표와 이미 던진 표는 변경할 수 없습니다.

## 만장일치를 SQL로 보장하기

vote 요청은 D1의 atomic batch 안에서 다음 순서로 처리합니다.

1. 참여자이고 당사자가 아닌지 확인하며 투표를 INSERT합니다.
2. 반대 표가 있으면 rejected로 바꿉니다.
3. 대상 외 참여자가 1명 이상이고 찬성 표가 없는 참여자가 단 한 명도 없을 때만 approved로 바꿉니다.
4. 같은 batch에서 대상의 paid를 forfeited 또는 refunded로 바꿉니다.

제안자의 동의도 자동으로 처리하지 않습니다. 제안자도 직접 투표합니다.
미응답은 영원히 찬성으로 바뀌지 않습니다. 보류 중인 투표가 있으면 정산을 막습니다.
한 번 forfeited된 예약금은 다시 전환하지 않습니다. 모임비는 forfeited 인원 × 고정된 1인 금액으로 계산합니다.

사용 기록은 INSERT ... SELECT의 WHERE에서 잔액을 확인합니다.
잔액은 승인된 총액에서 사용 기록 SUM을 뺀 값입니다. SQLite의 직렬화된 쓰기 안에서 확인·삽입하므로 동시 요청도 잔액을 초과하지 않습니다.
프런트 버튼만 비활성화하는 방식에 의존하지 않습니다. 권한·잔액·상태를 서버 SQL에서 다시 검사합니다.

## API

모든 변경은 POST /api/meetups, JSON의 action으로 구분합니다.

| action | 요청 | 권한·조건 |
| --- | --- | --- |
| create | title, location, startsAt, amount | 로그인, 미래 시간, 0/1,000/3,000원 |
| join | code | 미확정·시작 전, 최대 20명 |
| pay | id, provider: kakao/toss | 본인, 모의 예치 1회 |
| lock | id | 모임장, 시작 전, 전원 예치·2명 이상 |
| checkin | id | 본인, locked, 1회 |
| claim | id, targetId, reason | 참여자, 시작 후, 지각·미체크인 타인 |
| vote | id, claimId, agree | 당사자 제외 참여자, pending |
| spend | id, amount, memo | 모임장, 모임비 잔액 이내 |
| settle | id | 모임장, 시작 후, 보류 투표 없음 |
| cancel | id | 모임장, 미확정 또는 확정 후 시작 전 |

GET /api/meetups는 내 약속 목록, ?id=약속ID는 참여자에게만 상세 정보를 줍니다.
다른 사람의 약속방은 ID를 알아도 열람할 수 없습니다.

## 로컬 실행

Node.js 22.13 이상. 처음 압축을 풀었다면 다음을 실행합니다.

```powershell
npm run install:ci
npm run build
```

비어 있는 로컬 DB에 아래 두 마이그레이션을 순서대로 한 번만 적용합니다.
기존 로컬 DB에 0000이 이미 적용되어 있다면 0001만 적용하세요.

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_ambiguous_smiling_tiger.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_adorable_newton_destine.sql
npm run dev -- --port 5173
```

http://127.0.0.1:5173/ 에서 개발용 계정으로 로그인합니다. 배포 사이트에서는 실제 ChatGPT 계정 인증을 사용합니다.
DB는 로컬과 배포가 서로 다릅니다. 테스트 데이터는 배포 DB에 업로드하지 않습니다.

## 검증

```powershell
node node_modules/typescript/bin/tsc --noEmit
npm run build
```

날짜 입력 회귀 테스트는 서버 없이 `node --experimental-strip-types scripts/test-meetup-validation.mjs`로 실행합니다.

통합 테스트는 dev 서버를 종료하고, 배포 빌드 서버 한 개로 진행합니다. 두 서버가 같은 로컬 DB를 동시에 쓰면 Windows에서 잠금 대기가 길어질 수 있습니다.

```powershell
npm start -- --port 5174
```

다른 터미널에서:

```powershell
node scripts/test-meetups.mjs
node scripts/test-booking.mjs
```

테스트는 loopback에만 요청합니다. 로컬 배포 Worker에서만 가상 사용자 헤더를 사용하며 운영 인증을 우회하지 않습니다.
meetups 테스트는 시간을 과거로 옮기는 로컬 SQL fixture를 사용해 시작 후 투표를 검증합니다.
테스트에서 생성한 회원·약속·장부는 격리된 로컬 DB에 남습니다.

검증 항목: 중복 참여·예치, 참여자 고정, 제때 도착한 사람 보호, 자기 투표 금지, 미응답 보류, 전원 명시 동의, 반대 환불, 중복 투표·표 변경 차단, 동시 초과 사용 방지, 정산, 취소·환불, 타인 방 열람 및 비모임장 작업 차단.

## 실제 결제를 붙일 때 바뀌는 부분

app/lib/payments.ts는 현재 서버 모의 영수증만 만드는 어댑터입니다.
결제 화면의 클릭만으로 실제 paid 처리를 해서는 안 됩니다. 결제사 서버 승인·금액·주문·사용자 매칭과 웹훅 서명을 검증한 뒤 상태를 바꿔야 합니다.
실제 연동 단계에서는 pending/approved/refund_pending/refunded/failed, 멱등 키, 중복 웹훅 처리, 승인·환불 실패 재시도와 대사 기록을 추가해야 합니다.
지금의 가상 모임비 기록은 타인에게 실제 돈을 지급하는 기능이 아닙니다. 실제 지급은 결제사 지원 범위와 별도 운영·정산 정책을 먼저 확인한 뒤 구현할 영역입니다.
서비스 비밀키는 서버 환경변수로만 관리하고 브라우저 코드와 저장소에 넣지 않습니다.

## 서울 디자인

남산타워와 한강 노을의 에디토리얼 여행 포스터 분위기입니다.
배경 #F8F5ED, 잉크 #183B4A, 노을 포인트 #DB684A를 사용했습니다.
메인 배경은 built-in ImageGen으로 새로 생성했고 public/images/seoul-sunset.webp에 최적화해 저장했습니다. 기존 상담 화면도 같은 배경과 팔레트를 적용했습니다.
최종 이미지 생성 프롬프트는 docs/seoul-image-prompt.md에 있습니다.
