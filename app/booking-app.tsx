"use client";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  Clock3,
  ArrowUpRight,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Check,
  ShieldCheck,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Users,
  Plus,
  X,
  LoaderCircle,
  CheckCircle2,
  CalendarCheck,
  Menu,
} from "lucide-react";
type Slot = {
  id: string;
  date: string;
  time: string;
  open: number;
  total: number;
};
type Entry = {
  id: number;
  slot_id: string;
  date: string;
  time: string;
  active: number;
  position: number;
  name?: string;
  email?: string;
};
type Data = {
  authenticated: boolean;
  user?: { name: string; email: string; admin: boolean };
  today: string;
  slots: Slot[];
  mine: Entry[];
  all: Entry[];
};
const pretty = (d: string) =>
  new Date(d + "T12:00:00+09:00").toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone: "Asia/Seoul",
  });
const future = (d: string, t: string) =>
  Date.parse(`${d}T${t}:00+09:00`) > Date.now();
const status = (e: Entry) =>
  !e.active
    ? "취소됨"
    : !future(e.date, e.time)
      ? "지난 일정"
      : e.position === 1
        ? "예약 확정"
        : `대기 ${e.position - 1}번`;
export default function BookingApp() {
  const [data, setData] = useState<Data | null>(null),
    [tab, setTab] = useState("book"),
    [date, setDate] = useState(""),
    [month, setMonth] = useState(""),
    [selected, setSelected] = useState<Slot | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [cancel, setCancel] = useState<Entry | null>(null),
    [filter, setFilter] = useState("active"),
    [newDate, setNewDate] = useState(""),
    [newTime, setNewTime] = useState("10:00"),
    [mobile, setMobile] = useState(false);
  async function load(initial = false) {
    try {
      if (initial) setLoading(true);
      const res = await fetch("/api/booking", { cache: "no-store" });
      const d = (await res.json()) as Data & { error?: string };
      if (!res.ok) throw Error(d.error);
      setData(d);
      setError("");
      if (d.authenticated) {
        setDate(
          (v) =>
            v ||
            d.slots.find((s: Slot) => s.open && future(s.date, s.time))?.date ||
            d.today,
        );
        setMonth((v) => v || (d.slots[0]?.date || d.today).slice(0, 7));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "연결을 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load(true);
    const i = setInterval(() => load(), 15000);
    const f = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", f);
    return () => {
      clearInterval(i);
      document.removeEventListener("visibilitychange", f);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(t);
  }, [toast]);
  async function act(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = (await res.json()) as { error?: string; message: string };
      if (!res.ok) throw Error(d.error);
      setToast(d.message);
      setSelected(null);
      setCancel(null);
      await load();
      if (body.action === "join") setTab("mine");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "요청에 실패했어요.");
      await load();
    } finally {
      setBusy(false);
    }
  }
  const slots = data?.slots || [],
    mine = data?.mine || [],
    upcoming = mine.filter((e) => e.active && future(e.date, e.time)),
    confirmed = upcoming.filter((e) => e.position === 1),
    waiting = upcoming.filter((e) => e.position > 1);
  const dateSlots = slots.filter((s) => s.date === date),
    currentSelected = slots.find((s) => s.id === selected?.id),
    own = currentSelected
      ? mine.find((e) => e.slot_id === currentSelected.id && e.active)
      : undefined;
  const nav = (t: string) => {
    setTab(t);
    setMobile(false);
  };
  function changeMonth(n: number) {
    const d = new Date(month + "-01T12:00:00");
    d.setMonth(d.getMonth() + n);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const cal = month ? new Date(month + "-01T12:00:00") : new Date(),
    offset = (cal.getDay() + 6) % 7,
    days = new Date(cal.getFullYear(), cal.getMonth() + 1, 0).getDate();
  return (
    <div className="shell">
      <aside className={"sidebar " + (mobile ? "mobile-open" : "")}>
        <a className="brand" href="/" aria-label="제시간에 홈">
          <span className="brand-mark">
            <Clock3 size={23} />
          </span>
          제시간에<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">MY TIME, MY PACE</div>
        <nav aria-label="주 메뉴">
          <button
            className={tab === "book" ? "nav active" : "nav"}
            onClick={() => nav("book")}
          >
            <CalendarDays size={19} />
            예약하기
            <ArrowUpRight size={16} />
          </button>
          <button
            className={tab === "mine" ? "nav active" : "nav"}
            onClick={() => nav("mine")}
          >
            <CalendarCheck size={19} />내 예약·대기
            {upcoming.length > 0 && (
              <span className="count">{upcoming.length}</span>
            )}
          </button>
          {data?.user?.admin && (
            <>
              <div className="nav-label">WORKSPACE</div>
              <button
                className={tab === "admin" ? "nav active" : "nav"}
                onClick={() => nav("admin")}
              >
                <LayoutDashboard size={19} />
                관리자
              </button>
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="mini-tip">
            <span className="tip-icon">✦</span>
            <strong>좋은 변화의 시작, 30분</strong>
            <p>
              바쁜 하루에도
              <br />
              나를 위한 시간을 남겨보세요.
            </p>
          </div>
          <div className="profile">
            <span className="avatar">
              {data?.user?.name?.slice(0, 1) || "O"}
            </span>
            <div>
              <strong>{data?.user?.name || "방문자"}</strong>
              <small>
                {data?.user?.admin ? "워크스페이스 관리자" : "나만의 예약 공간"}
              </small>
            </div>
            {data?.authenticated && (
              <a
                href="/signout-with-chatgpt?return_to=/"
                target="_top"
                aria-label="로그아웃"
              >
                <LogOut size={17} />
              </a>
            )}
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobile(!mobile)}
            aria-label="메뉴"
          >
            <Menu size={22} />
          </button>
          <span>
            나를 위한 시간<span className="breadcrumb">/</span>
            <b>
              {tab === "book"
                ? "예약하기"
                : tab === "mine"
                  ? "내 예약·대기"
                  : "관리자"}
            </b>
          </span>
          <div className="top-right">
            <span className="live-dot" />
            예약 운영 중
            <button
              className="icon-button"
              onClick={() => load(true)}
              aria-label="새로고침"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </header>
        <main>
          {loading && !data ? (
            <div className="loading-state">
              <LoaderCircle className="spin" />
              <h2>예약 시간을 불러오고 있어요</h2>
            </div>
          ) : error ? (
            <div className="empty">
              <h2>연결을 확인해 주세요</h2>
              <p>{error}</p>
              <button className="primary" onClick={() => load(true)}>
                다시 시도
              </button>
            </div>
          ) : !data?.authenticated ? (
            <div className="login-card">
              <span className="eyebrow">WELCOME TO JESIGANE</span>
              <h1>
                나를 위한 시간,
                <br />
                여기서 시작하세요.
              </h1>
              <p>로그인하고 상담 예약과 대기 순번을 한곳에서 관리하세요.</p>
              <a
                className="primary"
                href="/signin-with-chatgpt?return_to=/"
                target="_top"
              >
                ChatGPT로 로그인 <ArrowRight size={18} />
              </a>
            </div>
          ) : (
            <>
              {tab === "book" && (
                <>
                  <section className="hero">
                    <div>
                      <span className="eyebrow">
                        <span /> A LITTLE TIME, A BIG STEP
                      </span>
                      <h1>
                        당신의 다음 한 걸음,
                        <br />
                        좋은 시간에서 시작해요.
                      </h1>
                      <p>편한 시간을 골라주세요. 나머지는 제시간에이 챙길게요.</p>
                      <div className="hero-tags">
                        <span>
                          <Clock3 size={14} />
                          30분 집중 상담
                        </span>
                        <span>
                          <Users size={14} />
                          1:1 맞춤 상담
                        </span>
                        <span>
                          <Check size={14} />
                          간편한 예약·취소
                        </span>
                      </div>
                    </div>
                    <div className="hero-art" aria-hidden="true">
                      <div className="art-orbit" />
                      <div className="floating-label">
                        <span className="live-dot" />
                        JUST FOR YOU
                      </div>
                      <div className="art-calendar">
                        <div className="calendar-rings">
                          <i />
                          <i />
                        </div>
                        <span>MAKE TIME</span>
                        <strong>
                          30<small>min</small>
                        </strong>
                        <div className="art-line" />
                        <div className="art-check">
                          <Check size={22} />
                        </div>
                      </div>
                      <span className="art-star">✳</span>
                    </div>
                  </section>
                  <div className="booking-heading">
                    <div>
                      <span className="section-kicker">BOOK A SESSION</span>
                      <h2>어느 시간이 좋으세요?</h2>
                    </div>
                    <span className="timezone">
                      <Clock3 size={14} />
                      한국 시간 (KST)
                    </span>
                  </div>
                  <div className="booking-grid">
                    <section className="card calendar-card">
                      <div className="card-title">
                        <h3>날짜 선택</h3>
                        <span className="step">01</span>
                      </div>
                      <div className="month-control">
                        <strong>
                          {cal.getFullYear()}년 {cal.getMonth() + 1}월
                        </strong>
                        <div>
                          <button
                            className="icon-button"
                            onClick={() => changeMonth(-1)}
                            aria-label="이전 달"
                          >
                            <ChevronLeft size={18} />
                          </button>
                          <button
                            className="icon-button"
                            onClick={() => changeMonth(1)}
                            aria-label="다음 달"
                          >
                            <ChevronRight size={18} />
                          </button>
                        </div>
                      </div>
                      <div className="calendar-grid">
                        {["월", "화", "수", "목", "금", "토", "일"].map((d) => (
                          <span key={d} className="weekday">
                            {d}
                          </span>
                        ))}
                        {Array.from({ length: offset }, (_, i) => (
                          <span key={"empty" + i} />
                        ))}
                        {Array.from({ length: days }, (_, i) => {
                          const d = `${month}-${String(i + 1).padStart(2, "0")}`,
                            has = slots.some(
                              (s) =>
                                s.date === d &&
                                s.open &&
                                future(s.date, s.time),
                            );
                          return (
                            <button
                              key={d}
                              disabled={!has}
                              aria-label={pretty(d)}
                              aria-pressed={date === d}
                              className={
                                "day " +
                                (date === d ? "chosen " : "") +
                                (has ? "available" : "")
                              }
                              onClick={() => {
                                setDate(d);
                                setSelected(null);
                              }}
                            >
                              {i + 1}
                              {has && <i />}
                            </button>
                          );
                        })}
                      </div>
                      <div className="calendar-legend">
                        <i />
                        예약 가능한 날짜
                      </div>
                      <div className="calendar-note">
                        <ShieldCheck size={18} />
                        <p>
                          일정이 바뀌어도 괜찮아요.
                          <br />
                          <strong>시작 전까지 자유롭게 취소</strong>할 수
                          있어요.
                        </p>
                      </div>
                    </section>
                    <section className="card times-card">
                      <div className="card-title">
                        <h3>시간 선택</h3>
                        <span className="step">02</span>
                      </div>
                      <p className="selected-date">
                        {date ? pretty(date) : "날짜를 선택해 주세요"}
                      </p>
                      <div className="time-legend">
                        <span>
                          <i />
                          예약 가능
                        </span>
                        <span>
                          <i />
                          대기 신청
                        </span>
                      </div>
                      {["오전", "오후"].map((period, index) => (
                        <div className="time-group" key={period}>
                          <h4>{period}</h4>
                          <div className="time-grid">
                            {dateSlots
                              .filter(
                                (s) =>
                                  Number(s.time.slice(0, 2)) < 12 ===
                                  (index === 0),
                              )
                              .map((s) => {
                                const already = mine.some(
                                    (e) => e.active && e.slot_id === s.id,
                                  ),
                                  disabled = !s.open || !future(s.date, s.time);
                                return (
                                  <button
                                    key={s.id}
                                    disabled={disabled}
                                    className={
                                      "time " +
                                      (s.total ? "wait " : "") +
                                      (selected?.id === s.id
                                        ? "selected "
                                        : "") +
                                      (already ? "joined" : "")
                                    }
                                    onClick={() => setSelected(s)}
                                  >
                                    <strong>{s.time}</strong>
                                    <small>
                                      {disabled
                                        ? "접수 마감"
                                        : already
                                          ? "신청한 시간"
                                          : s.total
                                            ? `대기 ${Math.max(0, s.total - 1)}명`
                                            : "예약 가능"}
                                    </small>
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      ))}
                      {dateSlots.length === 0 && (
                        <p className="muted">이 날짜에 등록된 시간이 없어요.</p>
                      )}
                      <p className="times-foot">
                        모든 상담은 30분 동안 진행됩니다.
                      </p>
                    </section>
                    <aside className="card summary-card">
                      <div className="card-title">
                        <h3>예약 안내</h3>
                        <span className="step">03</span>
                      </div>
                      <div className="session-icon">
                        <Users size={27} />
                      </div>
                      <h3 className="session-title">나를 위한 1:1 상담</h3>
                      <p className="muted">오롯이 당신에게 집중하는 30분</p>
                      <div className="summary-detail">
                        <div>
                          <span>선택 날짜</span>
                          <strong>
                            {currentSelected
                              ? pretty(currentSelected.date)
                              : "날짜와 시간을 골라주세요"}
                          </strong>
                        </div>
                        <div>
                          <span>상담 시간</span>
                          <strong>
                            {currentSelected
                              ? `${currentSelected.time} · 30분`
                              : "아직 선택하지 않았어요"}
                          </strong>
                        </div>
                        <div>
                          <span>신청 유형</span>
                          <strong className="purple">
                            {currentSelected
                              ? currentSelected.total
                                ? "대기 신청"
                                : "바로 예약"
                              : "—"}
                          </strong>
                        </div>
                      </div>
                      <button
                        className="primary full"
                        disabled={
                          !currentSelected ||
                          !!own ||
                          busy ||
                          !currentSelected.open ||
                          !future(currentSelected.date, currentSelected.time)
                        }
                        onClick={() =>
                          currentSelected &&
                          act({ action: "join", slotId: currentSelected.id })
                        }
                      >
                        {busy ? (
                          <LoaderCircle size={18} className="spin" />
                        ) : own ? (
                          "이미 신청한 시간이에요"
                        ) : currentSelected?.total ? (
                          "대기 신청하기"
                        ) : (
                          "이 시간 예약하기"
                        )}
                        <ArrowRight size={17} />
                      </button>
                      <p className="summary-note">
                        {currentSelected?.total
                          ? "예약 취소 시 대기 순서대로 자동 확정됩니다."
                          : "신청 시점의 접수 순서에 따라 예약 또는 대기로 등록돼요."}
                      </p>
                      <div className="help-box">
                        <strong>원하는 시간이 마감됐나요?</strong>
                        <p>
                          대기를 신청해 보세요.
                          <br />
                          빈자리가 생기면 순서대로 예약돼요.
                        </p>
                      </div>
                    </aside>
                  </div>
                  <section className="how-it-works">
                    <div>
                      <span className="how-number">01</span>
                      <p>
                        <strong>시간을 고르고</strong>
                        <small>내 일정에 맞는 30분을 선택해요.</small>
                      </p>
                    </div>
                    <ArrowRight size={18} />
                    <div>
                      <span className="how-number">02</span>
                      <p>
                        <strong>간편하게 신청하고</strong>
                        <small>마감된 시간은 대기할 수 있어요.</small>
                      </p>
                    </div>
                    <ArrowRight size={18} />
                    <div>
                      <span className="how-number">03</span>
                      <p>
                        <strong>내 예약에서 확인해요</strong>
                        <small>예약과 대기 현황을 한눈에 봐요.</small>
                      </p>
                    </div>
                  </section>
                </>
              )}
              {tab === "mine" && (
                <>
                  <div className="page-heading">
                    <span className="eyebrow">YOUR NEXT MOMENT</span>
                    <h1>내 예약·대기</h1>
                    <p>다가올 만남과 대기 순번을 확인하세요.</p>
                  </div>
                  <div className="stats">
                    <div className="card">
                      <CalendarCheck />
                      <span>
                        다가오는 예약
                        <strong>
                          {confirmed.length}
                          <small>건</small>
                        </strong>
                      </span>
                    </div>
                    <div className="card">
                      <Clock3 />
                      <span>
                        대기 중
                        <strong>
                          {waiting.length}
                          <small>건</small>
                        </strong>
                      </span>
                    </div>
                    <div className="card">
                      <CheckCircle2 />
                      <span>
                        전체 신청 내역
                        <strong>
                          {mine.length}
                          <small>건</small>
                        </strong>
                      </span>
                    </div>
                  </div>
                  <div className="list-toolbar">
                    <h2>신청 내역</h2>
                    <div className="segmented">
                      <button
                        className={filter === "active" ? "active" : ""}
                        onClick={() => setFilter("active")}
                      >
                        다가오는 일정
                      </button>
                      <button
                        className={filter === "all" ? "active" : ""}
                        onClick={() => setFilter("all")}
                      >
                        전체 내역
                      </button>
                    </div>
                  </div>
                  <div className="entry-list">
                    {(filter === "active" ? upcoming : mine)
                      .slice()
                      .sort((a, b) =>
                        filter === "active"
                          ? (a.date + a.time).localeCompare(b.date + b.time)
                          : b.id - a.id,
                      )
                      .map((e) => (
                        <article key={e.id} className="card entry">
                          <div className="entry-date">
                            <strong>{Number(e.date.slice(8))}</strong>
                            <span>{Number(e.date.slice(5, 7))}월</span>
                          </div>
                          <div className="entry-main">
                            <span
                              className={
                                "badge " +
                                (e.active && e.position === 1
                                  ? "green"
                                  : e.active
                                    ? "amber"
                                    : "gray")
                              }
                            >
                              {status(e)}
                            </span>
                            <h3>나를 위한 1:1 상담</h3>
                            <p>
                              {pretty(e.date)} <span>·</span> {e.time}{" "}
                              <span>·</span> 30분
                            </p>
                            {e.active &&
                              e.position > 1 &&
                              future(e.date, e.time) && (
                                <small>
                                  내 앞에 {e.position - 1}명이 있어요. 빈자리가
                                  생기면 자동 확정됩니다.
                                </small>
                              )}
                          </div>
                          {e.active && future(e.date, e.time) && (
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() => setCancel(e)}
                            >
                              {e.position === 1 ? "예약 취소" : "대기 취소"}
                            </button>
                          )}
                        </article>
                      ))}
                    {!(filter === "active" ? upcoming : mine).length && (
                      <div className="card empty">
                        <CalendarDays size={35} />
                        <h3>아직 등록된 일정이 없어요</h3>
                        <p>나를 위한 30분, 지금 골라볼까요?</p>
                        <button
                          className="primary"
                          onClick={() => setTab("book")}
                        >
                          예약하러 가기 <ArrowRight size={17} />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="refresh-note">
                    <RefreshCw size={13} />
                    대기 순번은 15초마다 새로고침됩니다. 자동 확정 결과도
                    이곳에서 확인하세요.
                  </p>
                </>
              )}
              {tab === "admin" && data.user?.admin && (
                <>
                  <div className="page-heading">
                    <span className="eyebrow">WORKSPACE OVERVIEW</span>
                    <h1>예약 운영 관리</h1>
                    <p>예약 시간을 열고, 상담 신청 현황을 관리하세요.</p>
                  </div>
                  <div className="stats">
                    <div className="card">
                      <CalendarDays />
                      <span>
                        열린 시간
                        <strong>
                          {
                            slots.filter(
                              (s) => s.open && future(s.date, s.time),
                            ).length
                          }
                          <small>개</small>
                        </strong>
                      </span>
                    </div>
                    <div className="card">
                      <CalendarCheck />
                      <span>
                        예약 확정
                        <strong>
                          {
                            data.all.filter(
                              (e) =>
                                e.active &&
                                e.position === 1 &&
                                future(e.date, e.time),
                            ).length
                          }
                          <small>명</small>
                        </strong>
                      </span>
                    </div>
                    <div className="card">
                      <Users />
                      <span>
                        대기 중
                        <strong>
                          {
                            data.all.filter(
                              (e) =>
                                e.active &&
                                e.position > 1 &&
                                future(e.date, e.time),
                            ).length
                          }
                          <small>명</small>
                        </strong>
                      </span>
                    </div>
                  </div>
                  <section className="card admin-create">
                    <h3>
                      <Plus size={18} />
                      예약 시간 추가
                    </h3>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        act({ action: "create", date: newDate, time: newTime });
                      }}
                    >
                      <label>
                        날짜
                        <input
                          required
                          type="date"
                          min={data.today}
                          value={newDate}
                          onChange={(e) => setNewDate(e.target.value)}
                        />
                      </label>
                      <label>
                        시작 시간
                        <input
                          required
                          type="time"
                          step="1800"
                          value={newTime}
                          onChange={(e) => setNewTime(e.target.value)}
                        />
                      </label>
                      <button disabled={busy} className="primary" type="submit">
                        <Plus size={17} />
                        시간 추가
                      </button>
                    </form>
                  </section>
                  <section className="card admin-table">
                    <div className="table-heading">
                      <h3>시간별 접수 현황</h3>
                      <input
                        aria-label="조회 날짜"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                      />
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>시간</th>
                            <th>접수 상태</th>
                            <th>예약자</th>
                            <th>대기</th>
                            <th>운영</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dateSlots.map((s) => {
                            const a = data.all.filter(
                              (e) => e.slot_id === s.id && e.active,
                            );
                            return (
                              <tr key={s.id}>
                                <td>
                                  <strong>{s.time}</strong>
                                  <small>30분 상담</small>
                                </td>
                                <td>
                                  <span
                                    className={
                                      "badge " + (s.open ? "green" : "gray")
                                    }
                                  >
                                    {s.open ? "접수 중" : "마감"}
                                  </span>
                                </td>
                                <td>
                                  {a.find((e) => e.position === 1)?.name || "—"}
                                  {a.find((e) => e.position === 1) && (
                                    <small>
                                      {a.find((e) => e.position === 1)?.email}
                                    </small>
                                  )}
                                </td>
                                <td>
                                  {a.filter((e) => e.position > 1).length}명
                                  {a
                                    .filter((e) => e.position > 1)
                                    .map((e) => (
                                      <small key={e.id}>
                                        {e.position - 1}. {e.name}
                                      </small>
                                    ))}
                                </td>
                                <td>
                                  <button
                                    className="secondary small"
                                    disabled={busy}
                                    onClick={() =>
                                      act({ action: "toggle", slotId: s.id })
                                    }
                                  >
                                    {s.open ? "접수 마감" : "다시 열기"}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {!dateSlots.length && (
                        <div className="empty">
                          <p>등록된 시간이 없어요. 위에서 시간을 추가하세요.</p>
                        </div>
                      )}
                    </div>
                    <p className="table-note">
                      접수를 마감해도 기존 예약·대기는 유지됩니다. 대기 승격은
                      접수 마감 여부와 관계없이 적용됩니다.
                    </p>
                  </section>
                </>
              )}
            </>
          )}
          <footer>
            <span className="footer-brand">제시간에.</span>
            <span>당신의 시간을 소중하게.</span>
            <span>© {new Date().getFullYear()} JESIGANE</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={20} />
          <span>{toast}</span>
          <button aria-label="알림 닫기" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {cancel && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-title"
            className="modal"
          >
            <button
              className="modal-close icon-button"
              aria-label="닫기"
              onClick={() => setCancel(null)}
              disabled={busy}
            >
              <X size={20} />
            </button>
            <div className="session-icon">
              <CalendarDays size={26} />
            </div>
            <h2 id="cancel-title">
              {cancel.position === 1
                ? "예약을 취소할까요?"
                : "대기를 취소할까요?"}
            </h2>
            <p>
              {pretty(cancel.date)} {cancel.time}
            </p>
            <p className="muted">
              예약을 취소하면 첫 번째 대기자가 자동으로 확정됩니다. 다시
              신청하면 접수 순서가 새로 정해져요.
            </p>
            <div className="modal-actions">
              <button
                className="secondary"
                onClick={() => setCancel(null)}
                disabled={busy}
              >
                유지하기
              </button>
              <button
                className="primary"
                autoFocus
                disabled={busy}
                onClick={() => act({ action: "cancel", id: cancel.id })}
              >
                {busy ? "취소 중…" : "취소하기"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
