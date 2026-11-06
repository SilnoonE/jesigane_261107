"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Clock3,
  MapPin,
  Users,
  Wallet,
  CalendarDays,
  ChevronLeft,
  X,
  Check,
  Copy,
  LogOut,
  Menu,
  RefreshCw,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  ReceiptText,
  Ticket,
  Compass,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  Mountain,
  Send,
  Coins,
} from "lucide-react";
import "./seoul.css";
type Room = {
  id: string;
  owner_id: string;
  title: string;
  location: string;
  starts_at: string;
  amount: number;
  code: string;
  state: string;
  guest_count?: number;
  paid_count?: number;
};
type Person = {
  id: string;
  user_id: string;
  name: string;
  payment: string;
  checked_at: string | null;
};
type Claim = { id: string; target_id: string; reason: string; state: string };
type Vote = { claim_id: string; voter_id: string; agree: number };
type Expense = { id: string; amount: number; memo: string; created_at: string };
type Detail = {
  room: Room;
  people: Person[];
  claims: Claim[];
  votes: Vote[];
  expenses: Expense[];
};
type Data = {
  authenticated: boolean;
  user?: { id: string; name: string };
  rooms: Room[];
  detail: Detail | null;
};
const money = (n: number) => n.toLocaleString("ko-KR") + "원";
const when = (s: string) =>
  new Date(s).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  });
const roomState: Record<string, string> = {
  open: "친구 모집 중",
  locked: "약속 확정",
  settled: "정산 완료",
  canceled: "취소된 약속",
};
const payState: Record<string, string> = {
  unpaid: "예치 전",
  paid: "모의 예치 완료",
  refunded: "모의 환불 완료",
  forfeited: "모임비 전환",
};
function sample(): Detail {
  return {
    room: {
      id: "demo",
      owner_id: "me",
      title: "한강에서 노을 한 스푼",
      location: "여의도 한강공원 · 물빛광장",
      starts_at: new Date(Date.now() - 20 * 60000).toISOString(),
      amount: 3000,
      code: "SEOUL-FRIENDS",
      state: "locked",
    },
    people: [
      {
        id: "1",
        user_id: "me",
        name: "나",
        payment: "paid",
        checked_at: new Date(Date.now() - 30 * 60000).toISOString(),
      },
      {
        id: "2",
        user_id: "ji",
        name: "지은",
        payment: "paid",
        checked_at: new Date(Date.now() - 25 * 60000).toISOString(),
      },
      {
        id: "3",
        user_id: "su",
        name: "수빈",
        payment: "paid",
        checked_at: new Date(Date.now() - 24 * 60000).toISOString(),
      },
      {
        id: "4",
        user_id: "min",
        name: "민수",
        payment: "paid",
        checked_at: null,
      },
    ],
    claims: [
      {
        id: "demo-claim",
        target_id: "min",
        reason: "늦은 민수의 예약금으로 다 같이 편의점 간식 사기",
        state: "pending",
      },
    ],
    votes: [
      { claim_id: "demo-claim", voter_id: "ji", agree: 1 },
      { claim_id: "demo-claim", voter_id: "su", agree: 1 },
    ],
    expenses: [],
  };
}
export default function SeoulApp() {
  const [data, setData] = useState<Data | null>(null),
    [activeId, setActiveId] = useState(""),
    [view, setView] = useState("plans"),
    [modal, setModal] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [demo, setDemo] = useState<Detail | null>(null),
    [navOpen, setNavOpen] = useState(false),
    [filter, setFilter] = useState("all");
  const [title, setTitle] = useState(""),
    [location, setLocation] = useState(""),
    [starts, setStarts] = useState(""),
    [amount, setAmount] = useState(3000),
    [code, setCode] = useState(""),
    [target, setTarget] = useState(""),
    [reason, setReason] = useState(""),
    [spend, setSpend] = useState(""),
    [memo, setMemo] = useState("");
  const seqRef = useRef(0),
    dialog = useRef<HTMLDivElement>(null);
  async function load(id = activeId, initial = false) {
    const seq = ++seqRef.current;
    try {
      if (initial) setLoading(true);
      const res = await fetch(
        "/api/meetups" + (id ? "?id=" + encodeURIComponent(id) : ""),
        { cache: "no-store" },
      );
      const d = (await res.json()) as Data & { error?: string };
      if (!res.ok) throw Error(d.error);
      if (seq === seqRef.current) {
        setData(d);
        setError("");
      }
    } catch (e) {
      if (seq === seqRef.current)
        setError(e instanceof Error ? e.message : "연결을 확인해 주세요.");
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }
  useEffect(() => {
    load(activeId, true);
    const i = setInterval(() => load(activeId), 15000);
    return () => clearInterval(i);
  }, [activeId]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!modal) return;
    const prior = document.activeElement as HTMLElement | null;
    const el = dialog.current;
    el?.querySelector<HTMLElement>("button,input")?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) setModal("");
      if (e.key === "Tab" && el) {
        const all = Array.from(
          el.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input,textarea,a[href]",
          ),
        );
        if (!all.length) return;
        if (e.shiftKey && document.activeElement === all[0]) {
          e.preventDefault();
          all.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === all.at(-1)) {
          e.preventDefault();
          all[0].focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      prior?.focus();
    };
  }, [modal, busy]);
  const detail = demo || (activeId ? data?.detail : null),
    userId = demo ? "me" : data?.user?.id,
    host = detail?.room.owner_id === userId,
    me = detail?.people.find((p) => p.user_id === userId),
    r = detail?.room;
  const pooled = detail
      ? detail.people.filter((p) => p.payment === "forfeited").length *
        detail.room.amount
      : 0,
    used = detail?.expenses.reduce((n, e) => n + e.amount, 0) || 0,
    balance = pooled - used;
  const rooms = data?.rooms || [],
    pending = detail?.claims.filter((c) => c.state === "pending") || [];
  function navigate(v: string) {
    setView(v);
    setActiveId("");
    setDemo(null);
    setNavOpen(false);
  }
  function openRoom(id: string) {
    setDemo(null);
    setActiveId(id);
    setView("plans");
  }
  function enterDemo() {
    setDemo(sample());
    setActiveId("");
    setView("plans");
    setNavOpen(false);
  }
  async function act(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      if (demo) {
        const next = structuredClone(demo);
        if (body.action === "vote") {
          const c = next.claims.find((c) => c.id === body.claimId);
          if (
            !c ||
            c.state !== "pending" ||
            next.votes.some((v) => v.claim_id === c.id && v.voter_id === "me")
          )
            throw Error("이미 끝난 투표예요.");
          next.votes.push({
            claim_id: c.id,
            voter_id: "me",
            agree: body.agree ? 1 : 0,
          });
          c.state = body.agree ? "approved" : "rejected";
          next.people.find((p) => p.user_id === c.target_id)!.payment =
            body.agree ? "forfeited" : "refunded";
        } else if (body.action === "spend") {
          if (
            !Number.isInteger(Number(body.amount)) ||
            Number(body.amount) <= 0 ||
            Number(body.amount) > balance ||
            !String(body.memo).trim()
          )
            throw Error("잔액 안에서 금액과 사용처를 입력해 주세요.");
          next.expenses.push({
            id: crypto.randomUUID(),
            amount: Number(body.amount),
            memo: String(body.memo),
            created_at: new Date().toISOString(),
          });
        } else if (body.action === "settle") {
          if (next.claims.some((c) => c.state === "pending"))
            throw Error("투표를 먼저 마쳐 주세요.");
          next.room.state = "settled";
          next.people.forEach((p) => {
            if (p.payment === "paid") p.payment = "refunded";
          });
        } else throw Error("체험에서는 투표·모임비 사용·정산을 눌러보세요.");
        setDemo(next);
        setModal("");
        setToast("체험 결과를 반영했어요. 실제 돈과 계정에는 영향이 없어요.");
        return;
      }
      const res = await fetch("/api/meetups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeId, ...body }),
      });
      const result = (await res.json()) as {
        message: string;
        error?: string;
        id?: string;
      };
      if (!res.ok) throw Error(result.error);
      setToast(result.message);
      setModal("");
      if (result.id) {
        setActiveId(result.id);
        setView("plans");
        await load(result.id);
      } else await load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "요청을 처리하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }
  const requireLogin = (action: string) => {
    if (!data?.authenticated) {
      setModal("login");
      return;
    }
    setModal(action);
  };
  async function copyInvite() {
    if (!r) return;
    try {
      await navigator.clipboard.writeText(r.code);
      setToast("초대 코드를 복사했어요. 친구에게 보내주세요.");
    } catch {
      setToast("코드를 직접 선택해 복사해 주세요.");
    }
  }
  const canClaim = (p: Person) =>
    r?.state === "locked" &&
    p.user_id !== userId &&
    p.payment === "paid" &&
    Date.parse(r.starts_at) <= Date.now() &&
    (!p.checked_at || p.checked_at > r.starts_at) &&
    !detail?.claims.some((c) => c.target_id === p.user_id);
  return (
    <div className="seoul-app">
      <aside className={"s-sidebar " + (navOpen ? "s-open" : "")}>
        <a href="/" className="s-brand">
          <span className="s-logo">
            <Clock3 size={23} />
          </span>
          온타임<span className="s-dot">●</span>
        </a>
        <p className="s-brand-caption">SEOUL, RIGHT ON TIME.</p>
        <div className="s-nav-label">OUR LITTLE PROMISE</div>
        <nav aria-label="메인 메뉴">
          <button
            className={view === "plans" ? "s-nav s-active" : "s-nav"}
            onClick={() => navigate("plans")}
          >
            <CalendarDays size={19} />
            우리 약속
            <span>
              {rooms.filter((r) => ["open", "locked"].includes(r.state))
                .length || ""}
            </span>
          </button>
          <button
            className={view === "wallet" ? "s-nav s-active" : "s-nav"}
            onClick={() => navigate("wallet")}
          >
            <Wallet size={19} />
            모임비 기록
          </button>
          <button
            className={view === "guide" ? "s-nav s-active" : "s-nav"}
            onClick={() => navigate("guide")}
          >
            <Compass size={19} />
            온타임 사용법
          </button>
        </nav>
        <div className="s-nav-label s-extra">MORE MOMENTS</div>
        <a href="/booking" className="s-nav">
          <Ticket size={18} />
          1:1 상담 예약
          <ArrowUpRight size={15} />
        </a>
        <div className="s-sidebar-bottom">
          <div className="s-postcard">
            <Mountain size={26} />
            <p>
              남산에서 한강까지,
              <br />
              <strong>우리 제시간에 만나요.</strong>
            </p>
            <span>37.5665° N, 126.9780° E</span>
          </div>
          <div className="s-user">
            <span className="s-avatar">
              {data?.user?.name?.slice(0, 1) || "O"}
            </span>
            <div>
              <strong>{data?.user?.name || "반가워요, 친구!"}</strong>
              <small>
                {data?.authenticated
                  ? "서울의 약속 메이트"
                  : "로그인하고 함께해요"}
              </small>
            </div>
            {data?.authenticated ? (
              <a
                href="/signout-with-chatgpt?return_to=/"
                target="_top"
                aria-label="로그아웃"
              >
                <LogOut size={17} />
              </a>
            ) : (
              <a
                href="/signin-with-chatgpt?return_to=/"
                target="_top"
                aria-label="로그인"
              >
                <ArrowUpRight size={18} />
              </a>
            )}
          </div>
        </div>
      </aside>
      {navOpen && (
        <button
          className="s-nav-scrim"
          aria-label="메뉴 닫기"
          onClick={() => setNavOpen(false)}
        />
      )}
      <div className="s-body">
        <header className="s-topbar">
          <div>
            <button
              className="s-mobile s-icon"
              aria-label="메뉴"
              onClick={() => setNavOpen(!navOpen)}
            >
              <Menu size={21} />
            </button>
            <span className="s-crumb">
              서울에서 만나요 <span>/</span>{" "}
              <b>
                {view === "plans"
                  ? "우리 약속"
                  : view === "wallet"
                    ? "모임비 기록"
                    : "온타임 사용법"}
              </b>
            </span>
          </div>
          <div className="s-header-actions">
            <i />
            모의 결제 모드
            <button
              className="s-icon"
              aria-label="새로고침"
              onClick={() => load()}
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </header>
        <main className="s-main">
          {demo && (
            <div className="s-demo-bar">
              <span>
                <Compass size={17} />
                <b>체험 모드</b>샘플 친구와 가상 금액으로 진행해요.
              </span>
              <button onClick={() => setDemo(null)}>
                체험 종료 <X size={15} />
              </button>
            </div>
          )}
          {error && !demo && (
            <div className="s-error" role="alert">
              <AlertCircle size={18} />
              {error}
              <button onClick={() => load()}>다시 시도</button>
            </div>
          )}
          {!detail && view === "plans" && (
            <>
              <section className="s-hero">
                <div className="s-hero-copy">
                  <span className="s-eyebrow">
                    <i />
                    GOOD FRIENDS. GOOD TIMING.
                  </span>
                  <h1>
                    서울의 좋은 순간,
                    <br />
                    우리 <em>제시간에.</em>
                  </h1>
                  <p>
                    한강 노을도, 남산의 야경도.
                    <br />
                    친구와의 약속에 작은 마음을 걸어보세요.
                  </p>
                  <div className="s-hero-actions">
                    <button
                      className="s-primary"
                      onClick={() => requireLogin("create")}
                    >
                      <Plus size={17} />
                      우리 약속 만들기
                    </button>
                    <button
                      className="s-hero-link"
                      onClick={() => requireLogin("join")}
                    >
                      초대 코드로 참여 <ArrowUpRight size={16} />
                    </button>
                  </div>
                </div>
                <span className="s-location-stamp">
                  <MapPin size={13} />
                  NAMSAN → HANGANG<span>SEOUL, KOREA</span>
                </span>
              </section>
              <div className="s-motto-strip">
                <span>
                  <b>01</b>친구끼리 시간 정하고
                </span>
                <span>
                  <b>02</b>작은 예약금 걸고
                </span>
                <span>
                  <b>03</b>늦으면, 함께 결정해요
                </span>
                <span className="s-strip-end">
                  A PROMISE WORTH KEEPING <ArrowUpRight size={16} />
                </span>
              </div>
              <div className="s-home-columns">
                <section>
                  <div className="s-section-head">
                    <div>
                      <span className="s-eyebrow">NEXT STOP, OUR PLANS</span>
                      <h2>
                        우리의 다음 약속{" "}
                        <span>{rooms.length.toString().padStart(2, "0")}</span>
                      </h2>
                    </div>
                    <button
                      className="s-outline"
                      onClick={() => requireLogin("create")}
                    >
                      <Plus size={15} />새 약속
                    </button>
                  </div>
                  <div className="s-filters">
                    {[
                      ["all", "전체 약속"],
                      ["upcoming", "진행 중"],
                      ["finished", "마무리된 약속"],
                    ].map(([k, t]) => (
                      <button
                        key={k}
                        className={filter === k ? "s-on" : ""}
                        onClick={() => setFilter(k)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {loading && !data ? (
                    <div className="s-loading">
                      <LoaderCircle className="spin" />
                      약속을 불러오는 중이에요.
                    </div>
                  ) : (
                    <div className="s-plan-grid">
                      {rooms
                        .filter(
                          (r) =>
                            filter === "all" ||
                            (filter === "upcoming"
                              ? ["open", "locked"].includes(r.state)
                              : ["settled", "canceled"].includes(r.state)),
                        )
                        .map((room, i) => (
                          <button
                            key={room.id}
                            className={"s-plan-card s-place-" + (i % 3)}
                            onClick={() => openRoom(room.id)}
                          >
                            <div className="s-plan-top">
                              <span
                                className={
                                  "s-tag " +
                                  (room.state === "locked" ? "s-tag-blue" : "")
                                }
                              >
                                {roomState[room.state]}
                              </span>
                              <ArrowUpRight size={21} />
                            </div>
                            <div className="s-plan-scene">
                              <MapPin size={22} />
                              <span>
                                {room.location.includes("남산")
                                  ? "NAMSAN"
                                  : room.location.includes("한강")
                                    ? "HANGANG"
                                    : "SEOUL MOMENT"}
                              </span>
                            </div>
                            <h3>{room.title}</h3>
                            <p>
                              <CalendarDays size={14} />
                              {when(room.starts_at)}
                            </p>
                            <p>
                              <MapPin size={14} />
                              {room.location}
                            </p>
                            <div className="s-plan-bottom">
                              <span>
                                <Users size={15} />
                                {room.guest_count}명의 친구
                              </span>
                              <strong>
                                {money(room.amount)}
                                <small> / 인</small>
                              </strong>
                            </div>
                          </button>
                        ))}
                      {!rooms.filter(
                        (r) =>
                          filter === "all" ||
                          (filter === "upcoming"
                            ? ["open", "locked"].includes(r.state)
                            : ["settled", "canceled"].includes(r.state)),
                      ).length && (
                        <div className="s-empty-plans">
                          <div className="s-empty-art">
                            <MapPin size={29} />
                            <span>✦</span>
                            <i />
                          </div>
                          <span className="s-eyebrow">LET'S MAKE A PLAN</span>
                          <h3>
                            {data?.authenticated
                              ? "비어 있는 달력에, 좋은 약속 하나."
                              : "좋은 친구와, 좋은 약속 하나."}
                          </h3>
                          <p>
                            {data?.authenticated
                              ? "친구에게 “언제 볼까?” 대신 약속을 보내보세요."
                              : "로그인하면 친구와 만든 약속이 여기에 모여요."}
                          </p>
                          <button
                            className="s-text-button"
                            onClick={() => requireLogin("create")}
                          >
                            첫 약속 만들기 <ArrowRight size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </section>
                <aside className="s-home-aside">
                  <div className="s-deposit-card">
                    <span className="s-eyebrow">
                      SMALL DEPOSIT, BIG PROMISE
                    </span>
                    <div className="s-deposit-graphic">
                      <span className="s-coin">₩</span>
                      <span className="s-coin s-coin-two">₩</span>
                      <span className="s-spark">✳</span>
                    </div>
                    <h3>
                      돈보다 소중한 건,
                      <br />
                      친구의 기다림이니까.
                    </h3>
                    <p>
                      1,000원 또는 3,000원.
                      <br />
                      부담 없이 걸고, 기분 좋게 지켜요.
                    </p>
                    <div className="s-price-chips">
                      <span>₩ 1,000</span>
                      <span>₩ 3,000</span>
                    </div>
                    <div className="s-unanimous">
                      <ShieldCheck size={18} />
                      <span>
                        지각비 사용은 <b>나머지 전원 동의</b>
                        <small>한 명이라도 반대하면 모의 환불해요.</small>
                      </span>
                    </div>
                    <button onClick={() => navigate("guide")}>
                      어떻게 진행되나요? <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <button className="s-demo-card" onClick={enterDemo}>
                    <ThumbsUp size={21} />
                    <span>
                      <strong>투표부터 모임비까지, 미리 체험</strong>
                      <small>친구를 초대하기 전에 눌러보세요.</small>
                    </span>
                    <ArrowUpRight size={18} />
                  </button>
                </aside>
              </div>
            </>
          )}
          {!detail && view === "wallet" && (
            <>
              <section className="s-page-heading">
                <span className="s-eyebrow">EVERY WON, TOGETHER</span>
                <h1>모임비도, 투명하게.</h1>
                <p>
                  약속을 열면 예치 내역·전원 동의 결과·사용 기록을 함께 볼 수
                  있어요.
                </p>
              </section>
              <div className="s-info-banner">
                <Wallet size={21} />
                <span>
                  모든 금액은 <b>가상 금액</b>이에요. 실제 결제·송금·환불은
                  발생하지 않아요.
                </span>
              </div>
              <div className="s-wallet-rooms">
                {rooms.map((room) => (
                  <button
                    className="s-wallet-room"
                    key={room.id}
                    onClick={() => openRoom(room.id)}
                  >
                    <span className="s-avatar">
                      <Wallet size={19} />
                    </span>
                    <span>
                      <b>{room.title}</b>
                      <small>
                        {when(room.starts_at)} · {roomState[room.state]}
                      </small>
                    </span>
                    <strong>
                      {money(room.amount)}
                      <small>1인 예약금</small>
                    </strong>
                    <ArrowUpRight size={20} />
                  </button>
                ))}
                {!rooms.length && (
                  <div className="s-empty-plans">
                    <Wallet size={35} />
                    <h3>아직 모임비 내역이 없어요.</h3>
                    <p>샘플 약속에서 투표와 사용 내역을 체험해 보세요.</p>
                    <button className="s-primary" onClick={enterDemo}>
                      모임비 체험하기 <ArrowRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
          {!detail && view === "guide" && (
            <>
              <section className="s-page-heading">
                <span className="s-eyebrow">THE WAY WE MEET</span>
                <h1>
                  약속은 가볍게.
                  <br />
                  마음은 확실하게.
                </h1>
                <p>서로의 시간을 존중하는, 우리끼리의 작은 규칙.</p>
              </section>
              <div className="s-guide-grid">
                {[
                  [
                    "01",
                    "서울 어딘가에서, 만나기로 해요.",
                    "약속 이름·장소·시간을 정하고 1,000원 또는 3,000원을 선택해요. 초대 코드를 친구에게 보내주세요.",
                  ],
                  [
                    "02",
                    "다 모이면, 약속을 확정해요.",
                    "2명 이상이 참여하고 모두 모의 예치를 마치면 모임장이 확정해요. 이후에는 참여자와 금액이 바뀌지 않아요.",
                  ],
                  [
                    "03",
                    "도착했다면, 체크인!",
                    "직접 도착 버튼을 눌러요. 서버가 시간을 기록하며 위치 인증은 하지 않아요. 약속 시간 이후 체크인은 지각으로 표시돼요.",
                  ],
                  [
                    "04",
                    "지각비는 다 같이 결정해요.",
                    "시작 후 지각·미체크인 친구의 예약금 사용 투표를 열 수 있어요. 당사자를 뺀 전원이 동의해야 해요.",
                  ],
                  [
                    "05",
                    "반대도, 기다림도 존중해요.",
                    "한 명이라도 반대하면 해당 예약금을 모의 환불해요. 미응답은 찬성으로 처리하지 않고 보류해요. 투표는 변경할 수 없어요.",
                  ],
                  [
                    "06",
                    "사용은 함께 보고, 나머지는 돌려줘요.",
                    "승인된 금액만 모임비가 돼요. 모임장이 잔액 안에서 사용처를 기록하고, 투표가 끝나면 나머지를 모의 환불하며 정산해요.",
                  ],
                ].map(([n, t, d]) => (
                  <article className="s-guide-card" key={n}>
                    <span>{n}</span>
                    <h3>{t}</h3>
                    <p>{d}</p>
                  </article>
                ))}
              </div>
              <div className="s-payment-note">
                <ShieldCheck size={23} />
                <div>
                  <h3>현재는 결제 연결 전, 모의 체험이에요.</h3>
                  <p>
                    카카오페이·토스 선택은 모의 예치로 동작해요. 실제
                    승인·환불·송금·출금은 연결하지 않았어요. 예약금 전환은 가상
                    모임비 장부에서만 처리해요.
                  </p>
                </div>
              </div>
              <button className="s-primary" onClick={enterDemo}>
                직접 체험해보기 <ArrowRight size={16} />
              </button>
            </>
          )}
          {detail && r && (
            <>
              <button
                className="s-back"
                onClick={() => {
                  setActiveId("");
                  setDemo(null);
                }}
              >
                <ChevronLeft size={16} />
                우리 약속 목록
              </button>
              <section className="s-detail-hero">
                <div>
                  <div className="s-detail-tags">
                    <span className="s-tag s-tag-blue">
                      {roomState[r.state]}
                    </span>
                    <span className="s-small-label">
                      {demo ? "SAMPLE MEETUP" : "OUR SEOUL MOMENT"}
                    </span>
                  </div>
                  <h1>{r.title}</h1>
                  <p>
                    <CalendarDays size={17} />
                    {when(r.starts_at)}
                    <span>·</span>
                    <MapPin size={17} />
                    {r.location}
                  </p>
                </div>
                <button
                  className="s-outline"
                  onClick={() => setModal("invite")}
                >
                  <Send size={16} />
                  친구 초대
                </button>
              </section>
              <div className="s-detail-columns">
                <div className="s-detail-left">
                  <section className="s-panel">
                    <div className="s-panel-head">
                      <h2>
                        함께하는 친구들 <span>{detail.people.length}</span>
                      </h2>
                      <span className="s-small-label">
                        예약금 {money(r.amount)} / 인
                      </span>
                    </div>
                    <div className="s-people">
                      {detail.people.map((p, i) => (
                        <div className="s-person" key={p.id}>
                          <span
                            className={"s-person-avatar s-avatar-" + (i % 4)}
                          >
                            {p.name.slice(0, 1)}
                          </span>
                          <div className="s-person-info">
                            <b>
                              {p.name}
                              {p.user_id === userId && <small>나</small>}
                              {p.user_id === r.owner_id && (
                                <span className="s-host">모임장</span>
                              )}
                            </b>
                            <span>{payState[p.payment]}</span>
                          </div>
                          <div className="s-arrival">
                            {p.checked_at ? (
                              <>
                                <strong
                                  className={
                                    p.checked_at > r.starts_at
                                      ? "s-late"
                                      : "s-ontime"
                                  }
                                >
                                  {p.checked_at > r.starts_at
                                    ? "늦게 도착"
                                    : "제시간 도착"}
                                </strong>
                                <small>
                                  {new Date(p.checked_at).toLocaleTimeString(
                                    "ko-KR",
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      timeZone: "Asia/Seoul",
                                    },
                                  )}
                                </small>
                              </>
                            ) : (
                              <span>
                                {r.state === "open"
                                  ? "확정 후 체크인"
                                  : "아직 체크인 전"}
                              </span>
                            )}
                          </div>
                          {canClaim(p) && (
                            <button
                              className="s-outline s-tiny"
                              onClick={() => {
                                setTarget(p.user_id);
                                setReason("");
                                setModal("claim");
                              }}
                            >
                              투표 제안
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {r.state === "locked" && me && !me.checked_at && (
                      <button
                        className="s-primary s-full"
                        disabled={busy}
                        onClick={() => act({ action: "checkin" })}
                      >
                        <MapPin size={17} />
                        도착했어요 · 체크인
                      </button>
                    )}
                    <p className="s-footnote">
                      직접 체크인하는 방식이에요. 위치 인증 없이 시간을
                      기록하고, 지각비 사용은 친구들의 투표로 결정해요.
                    </p>
                  </section>
                  <section className="s-panel">
                    <div className="s-panel-head">
                      <h2>
                        우리끼리 투표 <span>{detail.claims.length}</span>
                      </h2>
                      <ThumbsUp size={19} />
                    </div>
                    {detail.claims.map((c) => {
                      const voters = detail.people.filter(
                          (p) => p.user_id !== c.target_id,
                        ),
                        votes = detail.votes.filter((v) => v.claim_id === c.id),
                        yes = votes.filter((v) => v.agree === 1).length,
                        own = votes.find((v) => v.voter_id === userId);
                      return (
                        <article className="s-vote-card" key={c.id}>
                          <div className="s-vote-heading">
                            <span
                              className={
                                "s-tag " +
                                (c.state === "approved"
                                  ? "s-tag-green"
                                  : c.state === "rejected"
                                    ? "s-tag-gray"
                                    : "s-tag-orange")
                              }
                            >
                              {c.state === "approved"
                                ? "전원 동의 · 모임비 전환"
                                : c.state === "rejected"
                                  ? "반대 있음 · 모의 환불"
                                  : "친구들의 의견을 기다려요"}
                            </span>
                            <b>{money(r.amount)}</b>
                          </div>
                          <h3>
                            {
                              detail.people.find(
                                (p) => p.user_id === c.target_id,
                              )?.name
                            }
                            의 지각 예약금, 이렇게 쓸까요?
                          </h3>
                          <p>{c.reason}</p>
                          <div className="s-vote-progress">
                            <div
                              style={{
                                width: `${(yes / voters.length) * 100}%`,
                              }}
                            />
                          </div>
                          <div className="s-vote-count">
                            <b>
                              찬성 {yes} / {voters.length}명
                            </b>
                            <span>당사자 제외 · 만장일치</span>
                          </div>
                          <div className="s-voters">
                            {voters.map((p) => {
                              const cast = votes.find(
                                (v) => v.voter_id === p.user_id,
                              );
                              return (
                                <span
                                  key={p.id}
                                  className={
                                    cast ? (cast.agree ? "s-yes" : "s-no") : ""
                                  }
                                >
                                  {cast ? (
                                    cast.agree ? (
                                      <Check size={12} />
                                    ) : (
                                      <X size={12} />
                                    )
                                  ) : (
                                    <Clock3 size={12} />
                                  )}{" "}
                                  {p.name}
                                </span>
                              );
                            })}
                          </div>
                          {c.state === "pending" &&
                            c.target_id !== userId &&
                            !own && (
                              <div className="s-vote-actions">
                                <button
                                  disabled={busy}
                                  onClick={() =>
                                    act({
                                      action: "vote",
                                      claimId: c.id,
                                      agree: false,
                                    })
                                  }
                                >
                                  <ThumbsDown size={15} />
                                  반대해요
                                </button>
                                <button
                                  className="s-primary"
                                  disabled={busy}
                                  onClick={() =>
                                    act({
                                      action: "vote",
                                      claimId: c.id,
                                      agree: true,
                                    })
                                  }
                                >
                                  <ThumbsUp size={15} />
                                  동의해요
                                </button>
                              </div>
                            )}
                          {c.state === "pending" && own && (
                            <p className="s-voted">
                              내 의견을 기록했어요. 다른 친구들의 응답을
                              기다려요.
                            </p>
                          )}
                          {c.target_id === userId && (
                            <p className="s-voted">
                              당사자는 이 투표에 참여하지 않아요.
                            </p>
                          )}
                        </article>
                      );
                    })}
                    {!detail.claims.length && (
                      <div className="s-small-empty">
                        <ThumbsUp size={28} />
                        <h3>함께 결정할 일이 생기면 여기에.</h3>
                        <p>
                          시작 후 지각·미체크인 친구 옆에서 투표를 제안할 수
                          있어요.
                        </p>
                      </div>
                    )}
                    <div className="s-vote-rule">
                      <ShieldCheck size={16} />
                      미응답은 동의가 아니에요. 한 명의 반대도 존중해요.
                    </div>
                  </section>
                </div>
                <aside className="s-detail-right">
                  <section className="s-wallet-card">
                    <span className="s-eyebrow">OUR SHARED POCKET</span>
                    <h2>함께 쓸 모임비</h2>
                    <div className="s-wallet-amount">
                      {balance.toLocaleString("ko-KR")}
                      <small>원</small>
                    </div>
                    <span className="s-wallet-mode">모의 잔액 · 출금 불가</span>
                    <div className="s-wallet-lines">
                      <p>
                        <span>전원 동의로 모인 금액</span>
                        <b>{money(pooled)}</b>
                      </p>
                      <p>
                        <span>기록한 사용 금액</span>
                        <b>{money(used)}</b>
                      </p>
                    </div>
                    <button
                      className="s-cream-button"
                      disabled={!host || balance <= 0 || busy}
                      onClick={() => {
                        setSpend("");
                        setMemo("");
                        setModal("spend");
                      }}
                    >
                      <ReceiptText size={16} />
                      모임비 사용 기록하기
                    </button>
                    <p className="s-wallet-disclaimer">
                      실제 결제·송금은 발생하지 않아요.
                      <br />
                      동의받은 금액의 가상 사용 장부예요.
                    </p>
                  </section>
                  <section className="s-panel s-my-deposit">
                    <div className="s-panel-head">
                      <h3>내 작은 약속</h3>
                      <Coins size={20} />
                    </div>
                    <strong>{money(r.amount)}</strong>
                    <span>{me ? payState[me.payment] : ""}</span>
                    {me?.payment === "unpaid" && r.state === "open" && (
                      <button
                        className="s-primary s-full"
                        disabled={busy || Date.parse(r.starts_at) <= Date.now()}
                        onClick={() => setModal("pay")}
                      >
                        모의 예약금 예치 <ArrowRight size={16} />
                      </button>
                    )}
                    <p>
                      정산 때 남은 예약금을 돌려받아요.
                      <br />
                      지각비 사용은 나머지 전원 동의가 필요해요.
                    </p>
                  </section>
                  {host && (
                    <section className="s-panel s-host-actions">
                      <h3>모임장 메뉴</h3>
                      {r.state === "open" && (
                        <button
                          className="s-primary s-full"
                          disabled={
                            busy ||
                            detail.people.length < 2 ||
                            detail.people.some((p) => p.payment !== "paid") ||
                            Date.parse(r.starts_at) <= Date.now()
                          }
                          onClick={() => setModal("lock")}
                        >
                          모두 모였어요 · 약속 확정
                        </button>
                      )}
                      {r.state === "locked" && (
                        <button
                          className="s-outline s-full"
                          disabled={
                            busy ||
                            pending.length > 0 ||
                            Date.parse(r.starts_at) > Date.now()
                          }
                          onClick={() => setModal("settle")}
                        >
                          남은 예약금 모의 환불·정산
                        </button>
                      )}
                      {(r.state === "open" ||
                        (r.state === "locked" &&
                          Date.parse(r.starts_at) > Date.now())) && (
                        <button
                          className="s-danger-link"
                          disabled={busy}
                          onClick={() => setModal("cancel")}
                        >
                          약속 취소 · 전액 모의 환불
                        </button>
                      )}
                      <p>
                        {r.state === "open"
                          ? "2명 이상, 전원 예치 후 시작 전에 확정해요."
                          : r.state === "locked"
                            ? "모든 투표가 끝나면 남은 예약금을 정산해요."
                            : "약속의 정산이 마무리됐어요."}
                      </p>
                    </section>
                  )}
                </aside>
              </div>
              <section className="s-panel s-expenses">
                <div className="s-panel-head">
                  <h2>같이 보는 사용 기록</h2>
                  <span className="s-small-label">VIRTUAL LEDGER</span>
                </div>
                {detail.expenses.length ? (
                  detail.expenses.map((e) => (
                    <div className="s-expense" key={e.id}>
                      <ReceiptText size={18} />
                      <span>
                        <b>{e.memo}</b>
                        <small>
                          {when(
                            e.created_at.includes("T")
                              ? e.created_at
                              : e.created_at.replace(" ", "T") + "Z",
                          )}
                        </small>
                      </span>
                      <strong>− {money(e.amount)}</strong>
                    </div>
                  ))
                ) : (
                  <p className="s-footnote">
                    아직 사용 기록이 없어요. 전원 동의로 모인 모임비만 잔액
                    안에서 기록할 수 있어요.
                  </p>
                )}
              </section>
            </>
          )}
          <footer className="s-footer">
            <span>
              <b>온타임.</b> 서울에서, 우리 제시간에.
            </span>
            <span>
              MADE FOR OUR MOMENTS <span>✳</span> SEOUL
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="s-toast" role="status">
          <CheckCircle2 size={19} />
          <span>{toast}</span>
          <button aria-label="알림 닫기" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {modal && (
        <div
          className="s-modal-bg"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setModal("");
          }}
        >
          <div
            className="s-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="s-modal-title"
            ref={dialog}
          >
            <button
              className="s-modal-x s-icon"
              disabled={busy}
              aria-label="닫기"
              onClick={() => setModal("")}
            >
              <X size={21} />
            </button>
            <span className="s-eyebrow">OUR LITTLE PROMISE</span>
            <h2 id="s-modal-title">
              {
                {
                  create: "어디서, 언제 만날까요?",
                  join: "친구의 약속에 합류하기",
                  pay: "작은 마음을 예치해요",
                  invite: "좋은 약속은, 함께.",
                  claim: "친구들의 의견을 물어봐요",
                  spend: "무엇을 함께 샀나요?",
                  lock: "이 멤버로 약속할까요?",
                  settle: "남은 예약금을 돌려줘요",
                  cancel: "이 약속을 취소할까요?",
                  login: "로그인하고, 같이 만나요.",
                }[modal]
              }
            </h2>
            {modal === "create" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const dt = new Date(starts + ":00+09:00");
                  if (!Number.isFinite(dt.getTime())) {
                    setToast("올바른 날짜를 입력해 주세요.");
                    return;
                  }
                  act({
                    action: "create",
                    title,
                    location,
                    startsAt: dt.toISOString(),
                    amount,
                  });
                }}
              >
                <label>
                  약속 이름
                  <input
                    required
                    maxLength={60}
                    placeholder="예: 한강에서 노을 한 스푼"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <label>
                  어디서 만나요?
                  <input
                    required
                    maxLength={100}
                    placeholder="예: 여의도 한강공원 물빛광장"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </label>
                <label>
                  언제 만나요? <small>한국 시간 KST</small>
                  <input
                    required
                    type="datetime-local"
                    value={starts}
                    onChange={(e) => setStarts(e.target.value)}
                  />
                </label>
                <label>1인 예약금</label>
                <div className="s-amount-select">
                  {[1000, 3000].map((n) => (
                    <button
                      type="button"
                      className={amount === n ? "s-selected" : ""}
                      key={n}
                      onClick={() => setAmount(n)}
                    >
                      {money(n)}
                      {amount === n && <Check size={16} />}
                    </button>
                  ))}
                </div>
                <p className="s-modal-note">
                  현재는 가상 금액이에요. 지각비는 당사자를 제외한 전원 동의
                  시에만 모임비로 전환해요.
                </p>
                <button
                  className="s-primary s-full"
                  disabled={busy}
                  type="submit"
                >
                  {busy ? "만드는 중…" : "우리 약속 만들기"}
                  <ArrowRight size={16} />
                </button>
              </form>
            )}
            {modal === "join" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  act({ action: "join", code });
                }}
              >
                <p className="s-modal-intro">
                  친구가 보내준 초대 코드를 입력하세요.
                </p>
                <label>
                  초대 코드
                  <input
                    required
                    maxLength={20}
                    placeholder="초대 코드 12자리"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                  />
                </label>
                <p className="s-modal-note">
                  사이트 접근 권한이 있는 친구만 참여할 수 있어요. 확정된
                  약속에는 새로 참여할 수 없어요.
                </p>
                <button className="s-primary s-full" disabled={busy}>
                  약속에 참여하기
                  <ArrowRight size={16} />
                </button>
              </form>
            )}
            {modal === "pay" && (
              <>
                <div className="s-pay-summary">
                  <span>1인 예약금</span>
                  <strong>{r && money(r.amount)}</strong>
                  <small>실제 결제 금액 0원 · 모의 체험</small>
                </div>
                <div className="s-simulation-warning">
                  <ShieldCheck size={18} />
                  실제 카카오페이·토스 결제창으로 이동하지 않아요.
                </div>
                <button
                  className="s-kakao"
                  disabled={busy}
                  onClick={() => act({ action: "pay", provider: "kakao" })}
                >
                  카카오페이로 모의 예치
                  <ArrowUpRight size={17} />
                </button>
                <button
                  className="s-toss"
                  disabled={busy}
                  onClick={() => act({ action: "pay", provider: "toss" })}
                >
                  토스로 모의 예치
                  <ArrowUpRight size={17} />
                </button>
                <p className="s-modal-note">
                  결제수단 선택과 예치 기록만 저장해요. 카드·계좌 연결 및 실제
                  출금은 없어요.
                </p>
              </>
            )}
            {modal === "invite" && (
              <>
                <p className="s-modal-intro">
                  친구에게 아래 코드를 보내주세요.
                  <br />
                  홈에서 ‘초대 코드로 참여’를 누르면 돼요.
                </p>
                <div className="s-invite-code">{r?.code}</div>
                <button className="s-primary s-full" onClick={copyInvite}>
                  <Copy size={16} />
                  초대 코드 복사
                </button>
                <p className="s-modal-note">
                  사이트에 접근할 수 있는 계정만 참여할 수 있어요. 확정하면 새
                  참여는 마감돼요.
                  {demo
                    ? " 이 코드는 체험용이며 실제 초대에는 사용할 수 없어요."
                    : ""}
                </p>
              </>
            )}
            {modal === "claim" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  act({ action: "claim", targetId: target, reason });
                }}
              >
                <p className="s-modal-intro">
                  {detail?.people.find((p) => p.user_id === target)?.name}의
                  예약금 {r && money(r.amount)}을 모임비로 사용할지 물어봐요.
                </p>
                <label>
                  어떻게 사용할까요?
                  <textarea
                    required
                    maxLength={200}
                    placeholder="예: 기다린 친구들과 편의점 간식 사기"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <p className="s-modal-note">
                  당사자를 제외한 전원이 직접 동의해야 해요. 제안자도 투표해야
                  하며, 반대 한 표면 모의 환불돼요. 투표는 변경할 수 없어요.
                </p>
                <button className="s-primary s-full" disabled={busy}>
                  투표 열기 <ThumbsUp size={16} />
                </button>
              </form>
            )}
            {modal === "spend" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  act({ action: "spend", amount: Number(spend), memo });
                }}
              >
                <p className="s-modal-intro">
                  사용 가능한 모의 모임비 <b>{money(balance)}</b>
                </p>
                <label>
                  사용 금액
                  <input
                    type="number"
                    min={1}
                    max={balance}
                    step={1}
                    required
                    value={spend}
                    onChange={(e) => setSpend(e.target.value)}
                    placeholder="예: 2000"
                  />
                </label>
                <label>
                  무엇에 썼나요?
                  <input
                    required
                    maxLength={100}
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="예: 친구들과 나눠 먹은 과자"
                  />
                </label>
                <p className="s-modal-note">
                  참여자 모두에게 보이는 가상 장부예요. 실제 결제나 송금은
                  발생하지 않아요.
                </p>
                <button className="s-primary s-full" disabled={busy}>
                  사용 내역 기록 <ReceiptText size={16} />
                </button>
              </form>
            )}
            {["lock", "settle", "cancel"].includes(modal) && (
              <>
                <p className="s-modal-intro">
                  {modal === "lock"
                    ? "지금 참여한 친구들과 예약금이 고정돼요. 이후에는 새 친구가 들어올 수 없어요."
                    : modal === "settle"
                      ? "모임비로 전환되지 않은 예약금을 각 참여자에게 모의 환불하고 약속을 마무리해요. 이후 새 투표와 체크인은 할 수 없어요."
                      : "약속을 취소하고 예치된 예약금을 모두 모의 환불해요. 취소한 약속은 다시 열 수 없어요."}
                </p>
                <button
                  className="s-primary s-full"
                  disabled={busy}
                  onClick={() => act({ action: modal })}
                >
                  {busy
                    ? "처리 중…"
                    : modal === "lock"
                      ? "이대로 약속 확정"
                      : modal === "settle"
                        ? "모의 환불하고 정산"
                        : "약속 취소하기"}
                </button>
              </>
            )}
            {modal === "login" && (
              <>
                <p className="s-modal-intro">
                  ChatGPT 계정으로 로그인하면 친구와 약속을 만들고 초대 코드로
                  참여할 수 있어요.
                </p>
                <a
                  className="s-primary s-full"
                  href="/signin-with-chatgpt?return_to=/"
                  target="_top"
                >
                  ChatGPT로 로그인 <ArrowUpRight size={17} />
                </a>
                <button
                  className="s-outline s-full"
                  onClick={() => {
                    setModal("");
                    enterDemo();
                  }}
                >
                  로그인 없이 먼저 체험하기
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
