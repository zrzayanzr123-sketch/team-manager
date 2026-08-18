import React, { useState, useEffect, useRef, useMemo } from "react";
import { Plus, Minus, Trash2, X, ChevronLeft, ChevronRight, UserPlus, Pencil, Check, LogOut } from "lucide-react";
import { supabase } from "./supabaseClient";

// ---------- Palette (purple / black / white) ----------
const C = {
  bg: "#0b0714",
  bgGlow: "radial-gradient(ellipse 900px 500px at 50% -10%, #2c1152 0%, #0b0714 60%)",
  card: "rgba(32, 18, 52, 0.55)",
  cardSoft: "rgba(24, 14, 40, 0.6)",
  border: "rgba(168, 121, 255, 0.22)",
  borderStrong: "rgba(180, 130, 255, 0.45)",
  purple: "#a855f7",
  purpleDeep: "#7c3aed",
  purpleLight: "#c9b3ff",
  white: "#f5f2ff",
  muted: "#9884b4",
  mutedDark: "#6b5a8a",
  danger: "#f87171",
  amber: "#f0b74a",
};

const DISPLAY_FONT = 'Georgia, "Times New Roman", serif';
const MONO_FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const STAGES = ["1", "2", "3", "3+", "4", "5", "6", "7", "8", "9", "10"];
const stageIdx = (s) => STAGES.indexOf(s);
const canMentor = (s) => stageIdx(s) >= stageIdx("3");

const ZAYAN_ID = "zayan";
const DEFAULT_DATA = {
  members: [{ id: ZAYAN_ID, name: "Zayan", stage: "10", mentorId: null, deleted: false, deletedAt: null }],
  records: {},
};

// ---------- Date helpers ----------
function startOfWeek(d) {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
}
function addDays(d, n) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt;
}
function toISO(d) {
  const dt = new Date(d);
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().slice(0, 10);
}
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDayLong(d) {
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtDayShort(d) {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
function round1(n) {
  return Math.round(n * 10) / 10;
}
function isActiveOnDate(m, iso) {
  return !m.deleted || iso <= m.deletedAt;
}

// ---------- Small UI atoms ----------
function StatCard({ label, value, big }) {
  return (
    <div
      style={{
        background: "linear-gradient(160deg, rgba(120,60,220,0.28), rgba(20,10,35,0.4))",
        border: `1px solid ${C.borderStrong}`,
        borderRadius: 18,
        boxShadow: "0 0 24px rgba(140,80,255,0.08)",
      }}
      className="flex-1 min-w-[90px] px-3 py-4 flex flex-col items-center justify-center text-center"
    >
      <div style={{ fontFamily: DISPLAY_FONT, color: C.white, fontSize: big ? 30 : 24, fontWeight: 700, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontFamily: MONO_FONT, color: C.purpleLight, fontSize: 11, letterSpacing: 1.5, marginTop: 6 }}>
        {label}
      </div>
    </div>
  );
}

function Segmented({ value, onChange }) {
  const opts = [
    { key: "in", label: "In", color: C.purple },
    { key: "absent", label: "Absent", color: C.muted },
    { key: "unscheduled", label: "Unscheduled Absence", color: C.danger },
  ];
  return (
    <div className="flex gap-1.5 flex-wrap">
      {opts.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            style={{
              fontFamily: MONO_FONT,
              fontSize: 10.5,
              letterSpacing: 0.3,
              padding: "6px 10px",
              borderRadius: 999,
              border: `1px solid ${active ? o.color : C.border}`,
              background: active ? o.color : "transparent",
              color: active ? "#0b0714" : C.muted,
              fontWeight: active ? 700 : 500,
              whiteSpace: "nowrap",
              transition: "all .15s",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Stepper({ value, onChange, disabled }) {
  return (
    <div className="flex items-center gap-2" style={{ opacity: disabled ? 0.35 : 1 }}>
      <button
        disabled={disabled}
        onClick={() => onChange(Math.max(0, value - 1))}
        style={{
          width: 26,
          height: 26,
          borderRadius: 999,
          border: `1px solid ${C.border}`,
          background: C.cardSoft,
          color: C.white,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Minus size={13} />
      </button>
      <div style={{ fontFamily: DISPLAY_FONT, color: C.white, fontSize: 18, width: 22, textAlign: "center" }}>
        {value}
      </div>
      <button
        disabled={disabled}
        onClick={() => onChange(value + 1)}
        style={{
          width: 26,
          height: 26,
          borderRadius: 999,
          border: `1px solid ${C.purpleDeep}`,
          background: C.purple,
          color: "#0b0714",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Plus size={13} />
      </button>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div style={{ fontFamily: MONO_FONT, fontSize: 10.5, letterSpacing: 1, color: C.purpleLight }}>{label}</div>
      {children}
    </div>
  );
}

function inputStyle() {
  return {
    fontFamily: MONO_FONT,
    fontSize: 14,
    color: C.white,
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: "9px 12px",
    outline: "none",
    width: "100%",
  };
}

function MiniStat({ label, value }) {
  return (
    <div style={{ background: C.cardSoft, border: `1px solid ${C.border}`, borderRadius: 12 }} className="flex-1 py-2 text-center">
      <div style={{ fontFamily: DISPLAY_FONT, color: C.white, fontSize: 16, fontWeight: 700 }}>{value}</div>
      <div style={{ fontFamily: MONO_FONT, color: C.mutedDark, fontSize: 8.5, letterSpacing: 1, marginTop: 1 }}>{label}</div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ border: `1px dashed ${C.border}`, borderRadius: 18, color: C.muted }} className="p-8 text-center">
      <div style={{ fontFamily: MONO_FONT, fontSize: 12.5, lineHeight: 1.6 }}>{text}</div>
    </div>
  );
}

// ---------- Auth screen ----------
function AuthScreen() {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo("Account created. If email confirmation is enabled, check your inbox before signing in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: C.bgGlow, minHeight: "100vh" }} className="flex items-center justify-center px-5">
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div className="text-center mb-8">
          <h1 style={{ fontFamily: DISPLAY_FONT, color: C.white, fontSize: 34, fontWeight: 700 }}>Team Manager</h1>
          <div style={{ fontFamily: MONO_FONT, color: C.purple, fontSize: 12, letterSpacing: 2, marginTop: 4 }}>
            VELORA PROMOTIONS
          </div>
        </div>

        <form
          onSubmit={submit}
          style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20 }}
          className="p-5 flex flex-col gap-4"
        >
          <div className="flex gap-2 mb-1">
            {["signin", "signup"].map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setMode(m)}
                style={{
                  flex: 1,
                  fontFamily: MONO_FONT,
                  fontSize: 11.5,
                  letterSpacing: 1,
                  padding: "8px 0",
                  borderRadius: 999,
                  border: `1px solid ${mode === m ? C.purple : C.border}`,
                  background: mode === m ? C.purple : "transparent",
                  color: mode === m ? "#0b0714" : C.muted,
                  fontWeight: 700,
                }}
              >
                {m === "signin" ? "LOG IN" : "SIGN UP"}
              </button>
            ))}
          </div>

          <Field label="EMAIL">
            <input style={inputStyle()} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="PASSWORD">
            <input
              style={inputStyle()}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </Field>

          {error && <div style={{ fontFamily: MONO_FONT, color: C.danger, fontSize: 11.5 }}>{error}</div>}
          {info && <div style={{ fontFamily: MONO_FONT, color: C.purpleLight, fontSize: 11.5 }}>{info}</div>}

          <button
            disabled={busy}
            type="submit"
            style={{
              fontFamily: MONO_FONT,
              fontSize: 12.5,
              letterSpacing: 1,
              color: "#0b0714",
              background: busy ? C.mutedDark : C.purple,
              borderRadius: 999,
              padding: "12px 0",
              fontWeight: 700,
            }}
          >
            {busy ? "PLEASE WAIT…" : mode === "signin" ? "LOG IN" : "CREATE ACCOUNT"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------- Main App ----------
export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh" }} className="flex items-center justify-center">
        <div style={{ fontFamily: MONO_FONT, color: C.muted, letterSpacing: 2, fontSize: 12 }}>LOADING…</div>
      </div>
    );
  }

  if (!session) return <AuthScreen />;

  return <TeamManager session={session} />;
}

function TeamManager({ session }) {
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState("team-data");
  const [members, setMembers] = useState([]);
  const [records, setRecords] = useState({});
  const [weekOffset, setWeekOffset] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const saveTimer = useRef(null);
  const userId = session.user.id;

  // load from Supabase
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("team_data").select("data").eq("user_id", userId).maybeSingle();
      if (cancelled) return;
      if (data && data.data) {
        setMembers(data.data.members || DEFAULT_DATA.members);
        setRecords(data.data.records || {});
      } else {
        // first time — create the row
        await supabase.from("team_data").upsert({ user_id: userId, data: DEFAULT_DATA });
        setMembers(DEFAULT_DATA.members);
        setRecords(DEFAULT_DATA.records);
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // debounced autosave
  useEffect(() => {
    if (!loaded) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase.from("team_data").upsert({ user_id: userId, data: { members, records } });
      setSaveState(error ? "idle" : "saved");
    }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [members, records, loaded, userId]);

  const today = useMemo(() => new Date(), []);
  const todayISO = toISO(today);
  const weekStart = useMemo(() => addDays(startOfWeek(today), weekOffset * 7), [today, weekOffset]);
  const weekDates = useMemo(() => [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(weekStart, i)), [weekStart]);

  const visibleDates = useMemo(() => {
    const isCurrent = weekOffset === 0;
    const list = isCurrent ? weekDates.filter((d) => toISO(d) <= todayISO) : weekDates;
    return [...list].reverse();
  }, [weekDates, weekOffset, todayISO]);

  function getEntry(iso, memberId) {
    return records[iso]?.[memberId] || { status: null, sales: 0 };
  }

  function setEntry(iso, memberId, patch) {
    setRecords((prev) => {
      const day = { ...(prev[iso] || {}) };
      const current = day[memberId] || { status: null, sales: 0 };
      day[memberId] = { ...current, ...patch };
      return { ...prev, [iso]: day };
    });
  }

  function membersForDay(iso) {
    return members.filter((m) => isActiveOnDate(m, iso));
  }

  function computeDayStats(iso) {
    const entries = membersForDay(iso).map((m) => getEntry(iso, m.id));
    const inEntries = entries.filter((e) => e.status === "in");
    const totalSales = inEntries.reduce((s, e) => s + (e.sales || 0), 0);
    const inCount = inEntries.length;
    const pieceAvg = inCount ? totalSales / inCount : 0;
    const soldCount = inEntries.filter((e) => (e.sales || 0) > 0).length;
    const scoring = inCount ? (soldCount / inCount) * 100 : 0;
    return { totalSales, pieceAvg, scoring, inCount };
  }

  const weekStats = useMemo(() => {
    let totalSales = 0;
    let totalInPersonDays = 0;
    let soldPersonDays = 0;
    const perMember = {};
    members.forEach((m) => (perMember[m.id] = { sales: 0, days: 0 }));
    weekDates.forEach((d) => {
      const iso = toISO(d);
      const ds = computeDayStats(iso);
      totalSales += ds.totalSales;
      membersForDay(iso).forEach((m) => {
        const e = getEntry(iso, m.id);
        if (e.status === "in") {
          perMember[m.id].days += 1;
          perMember[m.id].sales += e.sales || 0;
          totalInPersonDays += 1;
          if ((e.sales || 0) > 0) soldPersonDays += 1;
        }
      });
    });
    const individualAvgs = Object.values(perMember)
      .filter((p) => p.days >= 1)
      .map((p) => p.sales / p.days);
    const weeklyPieceAvg = individualAvgs.length
      ? individualAvgs.reduce((a, b) => a + b, 0) / individualAvgs.length
      : 0;
    const weeklyScoring = totalInPersonDays ? (soldPersonDays / totalInPersonDays) * 100 : 0;
    return { totalSales, weeklyPieceAvg, weeklyScoring };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, records, weekDates]);

  // ---------- tree helpers (active members only) ----------
  const activeMembers = useMemo(() => members.filter((m) => !m.deleted), [members]);

  const childrenOf = useMemo(() => {
    const map = {};
    activeMembers.forEach((m) => {
      if (!m.mentorId) return;
      if (!map[m.mentorId]) map[m.mentorId] = [];
      map[m.mentorId].push(m.id);
    });
    return map;
  }, [activeMembers]);

  function getDescendantIds(id) {
    const out = [];
    const stack = [...(childrenOf[id] || [])];
    while (stack.length) {
      const cur = stack.pop();
      out.push(cur);
      stack.push(...(childrenOf[cur] || []));
    }
    return out;
  }

  function eligibleMentors(excludeId) {
    const blocked = new Set(excludeId ? [excludeId, ...getDescendantIds(excludeId)] : []);
    return activeMembers.filter((m) => canMentor(m.stage) && !blocked.has(m.id));
  }

  function addMember({ name, mentorId, stage }) {
    const id = "m_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    setMembers((prev) => [...prev, { id, name, stage, mentorId, deleted: false, deletedAt: null }]);
  }

  function updateMember(id, patch) {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function deleteMember(id) {
    const target = members.find((m) => m.id === id);
    if (!target) return;
    const fallbackMentor = target.mentorId;
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === id) return { ...m, deleted: true, deletedAt: todayISO };
        if (m.mentorId === id) return { ...m, mentorId: fallbackMentor };
        return m;
      })
    );
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (!loaded) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh" }} className="flex items-center justify-center">
        <div style={{ fontFamily: MONO_FONT, color: C.muted, letterSpacing: 2, fontSize: 12 }}>LOADING…</div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bgGlow, minHeight: "100vh" }}>
      <div className="max-w-md mx-auto px-4 pb-24 pt-6">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h1 style={{ fontFamily: DISPLAY_FONT, color: C.white, fontSize: 34, fontWeight: 700, lineHeight: 1.05 }}>
              Team Manager
            </h1>
            <div style={{ fontFamily: MONO_FONT, color: C.purple, fontSize: 12, letterSpacing: 2, marginTop: 4 }}>
              VELORA PROMOTIONS
            </div>
            <div style={{ fontFamily: MONO_FONT, color: C.mutedDark, fontSize: 10, marginTop: 6 }}>
              {saveState === "saving" ? "SAVING…" : "ALL CHANGES SAVED"}
            </div>
          </div>
          <button onClick={signOut} title="Log out" style={{ color: C.mutedDark, padding: 6 }}>
            <LogOut size={18} />
          </button>
        </div>

        {/* Nav tabs */}
        <div className="flex mb-6" style={{ borderBottom: `1px solid ${C.border}` }}>
          {[
            { key: "team-data", label: "Team Data" },
            { key: "my-team", label: "My Team" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setPage(t.key)}
              style={{
                fontFamily: MONO_FONT,
                fontSize: 13,
                letterSpacing: 1,
                color: page === t.key ? C.white : C.mutedDark,
                padding: "10px 6px",
                marginRight: 22,
                borderBottom: page === t.key ? `2px solid ${C.purple}` : "2px solid transparent",
                fontWeight: page === t.key ? 700 : 500,
              }}
            >
              {t.label.toUpperCase()}
            </button>
          ))}
        </div>

        {page === "team-data" ? (
          <TeamDataPage
            membersForDay={membersForDay}
            weekStart={weekStart}
            weekOffset={weekOffset}
            setWeekOffset={setWeekOffset}
            visibleDates={visibleDates}
            computeDayStats={computeDayStats}
            weekStats={weekStats}
            getEntry={getEntry}
            setEntry={setEntry}
          />
        ) : (
          <MyTeamPage
            activeMembers={activeMembers}
            childrenOf={childrenOf}
            eligibleMentors={eligibleMentors}
            addMember={addMember}
            updateMember={updateMember}
            deleteMember={deleteMember}
            showAdd={showAdd}
            setShowAdd={setShowAdd}
          />
        )}
      </div>
    </div>
  );
}

// ---------- Team Data Page ----------
function TeamDataPage({
  membersForDay,
  weekStart,
  weekOffset,
  setWeekOffset,
  visibleDates,
  computeDayStats,
  weekStats,
  getEntry,
  setEntry,
}) {
  const weekEnd = addDays(weekStart, 6);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setWeekOffset((w) => w - 1)} style={{ color: C.purpleLight, border: `1px solid ${C.border}`, borderRadius: 999, padding: 6 }}>
          <ChevronLeft size={16} />
        </button>
        <div className="text-center">
          <div style={{ fontFamily: MONO_FONT, color: C.purpleLight, fontSize: 11, letterSpacing: 1.5 }}>
            WEEK OF {fmtDayShort(weekStart).toUpperCase()} – {fmtDayShort(weekEnd).toUpperCase()}
          </div>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} style={{ fontFamily: MONO_FONT, color: C.muted, fontSize: 10, textDecoration: "underline", marginTop: 2 }}>
              back to this week
            </button>
          )}
        </div>
        <button onClick={() => setWeekOffset((w) => w + 1)} style={{ color: C.purpleLight, border: `1px solid ${C.border}`, borderRadius: 999, padding: 6 }}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="flex gap-2.5 mb-7">
        <StatCard label="WEEK SALES" value={weekStats.totalSales} big />
        <StatCard label="PIECE AVG" value={round1(weekStats.weeklyPieceAvg)} />
        <StatCard label="SCORING" value={`${Math.round(weekStats.weeklyScoring)}%`} />
      </div>

      {visibleDates.length === 0 ? (
        <EmptyState text="No days in this week yet." />
      ) : (
        <div className="flex flex-col gap-4">
          {visibleDates.map((d) => {
            const iso = toISO(d);
            const ds = computeDayStats(iso);
            const dayMembers = membersForDay(iso);
            return (
              <div key={iso} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20 }} className="p-4">
                <div style={{ fontFamily: DISPLAY_FONT, color: C.white, fontSize: 19, fontWeight: 700 }}>{fmtDayLong(d)}</div>
                <div className="flex gap-2 mt-3 mb-4">
                  <MiniStat label="SALES" value={ds.totalSales} />
                  <MiniStat label="PIECE AVG" value={round1(ds.pieceAvg)} />
                  <MiniStat label="SCORING" value={`${Math.round(ds.scoring)}%`} />
                </div>
                <div className="flex flex-col gap-3">
                  {dayMembers.map((m) => {
                    const entry = getEntry(iso, m.id);
                    return (
                      <div key={m.id} style={{ borderTop: `1px solid ${C.border}` }} className="pt-3 flex flex-col gap-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div style={{ fontFamily: MONO_FONT, color: C.white, fontSize: 13.5 }}>{m.name}</div>
                          <Stepper value={entry.sales || 0} disabled={entry.status !== "in"} onChange={(v) => setEntry(iso, m.id, { sales: v })} />
                        </div>
                        <Segmented value={entry.status} onChange={(status) => setEntry(iso, m.id, { status })} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- My Team Page ----------
function MyTeamPage({ activeMembers, childrenOf, eligibleMentors, addMember, updateMember, deleteMember, showAdd, setShowAdd }) {
  const zayan = activeMembers.find((m) => m.id === ZAYAN_ID);
  const others = activeMembers.filter((m) => m.id !== ZAYAN_ID);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div style={{ fontFamily: MONO_FONT, color: C.purpleLight, fontSize: 11, letterSpacing: 1.5 }}>FAMILY TREE</div>
        <button
          onClick={() => setShowAdd(true)}
          style={{
            fontFamily: MONO_FONT,
            fontSize: 11.5,
            letterSpacing: 0.5,
            color: "#0b0714",
            background: C.purple,
            borderRadius: 999,
            padding: "8px 14px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontWeight: 700,
          }}
        >
          <UserPlus size={14} /> ADD MEMBER
        </button>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20 }} className="p-4 mb-8 overflow-x-auto">
        <TreeDiagram members={activeMembers} childrenOf={childrenOf} />
      </div>

      <div style={{ fontFamily: MONO_FONT, color: C.purpleLight, fontSize: 11, letterSpacing: 1.5 }} className="mb-3">
        MY TEAM
      </div>

      <div className="flex flex-col gap-3">
        {zayan && (
          <RosterRow
            member={zayan}
            isSelf
            eligibleMentors={[]}
            onUpdate={(patch) => updateMember(zayan.id, patch)}
            onDelete={() => {}}
          />
        )}
        {others.map((m) => (
          <RosterRow
            key={m.id}
            member={m}
            eligibleMentors={eligibleMentors(m.id)}
            onUpdate={(patch) => updateMember(m.id, patch)}
            onDelete={() => deleteMember(m.id)}
          />
        ))}
      </div>

      {showAdd && (
        <AddMemberModal
          eligibleMentors={eligibleMentors(null)}
          onClose={() => setShowAdd(false)}
          onAdd={(data) => {
            addMember(data);
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}

function TreeDiagram({ members, childrenOf }) {
  const spacingX = 108;
  const spacingY = 100;
  const marginX = 60;
  const marginY = 40;

  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));
  if (!memberById[ZAYAN_ID]) return null;

  const positions = {};
  let cursor = 0;
  let maxDepth = 0;

  function layout(nodeId, depth) {
    maxDepth = Math.max(maxDepth, depth);
    const kids = childrenOf[nodeId] || [];
    if (kids.length === 0) {
      const x = cursor;
      cursor += 1;
      positions[nodeId] = { x, depth };
      return x;
    }
    const xs = kids.map((k) => layout(k, depth + 1));
    const x = (Math.min(...xs) + Math.max(...xs)) / 2;
    positions[nodeId] = { x, depth };
    return x;
  }
  layout(ZAYAN_ID, 0);

  const width = cursor * spacingX + marginX * 2;
  const height = (maxDepth + 1) * spacingY + marginY * 2;
  const px = (x) => marginX + x * spacingX;
  const py = (depth) => marginY + depth * spacingY;

  const lines = [];
  members.forEach((m) => {
    if (m.id === ZAYAN_ID || !m.mentorId) return;
    const pos = positions[m.id];
    const parentPos = positions[m.mentorId];
    if (!pos || !parentPos) return;
    const x1 = px(parentPos.x);
    const y1 = py(parentPos.depth) + 22;
    const x2 = px(pos.x);
    const y2 = py(pos.depth) - 22;
    const midY = (y1 + y2) / 2;
    lines.push(
      <path key={m.id} d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`} stroke="rgba(168,121,255,0.35)" strokeWidth="1.5" fill="none" />
    );
  });

  return (
    <div style={{ position: "relative", width, height }}>
      <svg width={width} height={height} style={{ position: "absolute", top: 0, left: 0 }}>
        {lines}
      </svg>
      {members.map((m) => {
        const pos = positions[m.id];
        if (!pos) return null;
        const isSelf = m.id === ZAYAN_ID;
        const size = isSelf ? 46 : 40;
        return (
          <div key={m.id} style={{ position: "absolute", left: px(pos.x) - 48, top: py(pos.depth) - (isSelf ? 24 : 22), width: 96 }} className="flex flex-col items-center">
            <div
              style={{
                width: size,
                height: size,
                borderRadius: 999,
                background: isSelf ? `linear-gradient(160deg, ${C.purple}, ${C.purpleDeep})` : C.cardSoft,
                border: `${isSelf ? 2 : 1.5}px solid ${C.borderStrong}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: isSelf ? "0 0 18px rgba(168,121,255,0.45)" : "none",
              }}
            >
              <span style={{ fontFamily: MONO_FONT, color: isSelf ? "#0b0714" : C.purpleLight, fontSize: isSelf ? 13 : 11, fontWeight: 700 }}>
                {m.stage}
              </span>
            </div>
            <div style={{ fontFamily: MONO_FONT, color: C.white, fontSize: isSelf ? 11.5 : 10.5, fontWeight: isSelf ? 700 : 500, marginTop: 4, textAlign: "center", maxWidth: 92, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {m.name}
            </div>
            {isSelf && <div style={{ fontFamily: MONO_FONT, color: C.mutedDark, fontSize: 8 }}>LEADER</div>}
          </div>
        );
      })}
    </div>
  );
}

function RosterRow({ member, isSelf, eligibleMentors, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(member.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => setName(member.name), [member.name]);

  return (
    <div style={{ background: C.card, border: `1px solid ${isSelf ? C.borderStrong : C.border}`, borderRadius: 16 }} className="p-3.5">
      <div className="flex items-center justify-between gap-2 mb-3">
        {editing ? (
          <input
            style={inputStyle()}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (name.trim()) onUpdate({ name: name.trim() });
              setEditing(false);
            }}
            autoFocus
          />
        ) : (
          <button onClick={() => setEditing(true)} className="flex items-center gap-2">
            <span style={{ fontFamily: DISPLAY_FONT, color: C.white, fontSize: 16, fontWeight: 700 }}>{member.name}</span>
            {isSelf && (
              <span style={{ fontFamily: MONO_FONT, color: C.purpleLight, fontSize: 9, letterSpacing: 1 }}>LEADER</span>
            )}
            <Pencil size={12} color={C.mutedDark} />
          </button>
        )}
        {!isSelf &&
          (confirmDelete ? (
            <div className="flex items-center gap-2">
              <span style={{ fontFamily: MONO_FONT, fontSize: 10, color: C.danger }}>Delete?</span>
              <button onClick={onDelete} style={{ background: C.danger, color: "#0b0714", borderRadius: 999, padding: 5 }}>
                <Check size={13} />
              </button>
              <button onClick={() => setConfirmDelete(false)} style={{ border: `1px solid ${C.border}`, color: C.muted, borderRadius: 999, padding: 5 }}>
                <X size={13} />
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} style={{ color: C.mutedDark }}>
              <Trash2 size={15} />
            </button>
          ))}
      </div>

      <div className={isSelf ? "grid grid-cols-1" : "grid grid-cols-2 gap-3"}>
        <Field label="STAGE">
          <select style={inputStyle()} value={member.stage} onChange={(e) => onUpdate({ stage: e.target.value })}>
            {STAGES.map((s) => (
              <option key={s} value={s} style={{ background: "#1a0f2e" }}>
                Stage {s}
              </option>
            ))}
          </select>
        </Field>
        {!isSelf && (
          <Field label="MENTOR">
            <select style={inputStyle()} value={member.mentorId || ZAYAN_ID} onChange={(e) => onUpdate({ mentorId: e.target.value })}>
              <option value={ZAYAN_ID} style={{ background: "#1a0f2e" }}>
                Zayan (Leader)
              </option>
              {eligibleMentors
                .filter((mm) => mm.id !== ZAYAN_ID)
                .map((mm) => (
                  <option key={mm.id} value={mm.id} style={{ background: "#1a0f2e" }}>
                    {mm.name} (Stage {mm.stage})
                  </option>
                ))}
            </select>
          </Field>
        )}
      </div>
    </div>
  );
}

function AddMemberModal({ eligibleMentors, onClose, onAdd }) {
  const [name, setName] = useState("");
  const [mentorId, setMentorId] = useState(ZAYAN_ID);
  const [stage, setStage] = useState("1");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(6,3,12,0.75)", zIndex: 50 }} className="flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#150b26", border: `1px solid ${C.borderStrong}`, borderRadius: 20, width: "100%", maxWidth: 380 }} className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div style={{ fontFamily: DISPLAY_FONT, color: C.white, fontSize: 20, fontWeight: 700 }}>Add Team Member</div>
          <button onClick={onClose} style={{ color: C.mutedDark }}>
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <Field label="NAME">
            <input style={inputStyle()} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </Field>
          <Field label="MENTOR">
            <select style={inputStyle()} value={mentorId} onChange={(e) => setMentorId(e.target.value)}>
              <option value={ZAYAN_ID} style={{ background: "#1a0f2e" }}>
                Zayan (Leader)
              </option>
              {eligibleMentors
                .filter((mm) => mm.id !== ZAYAN_ID)
                .map((mm) => (
                  <option key={mm.id} value={mm.id} style={{ background: "#1a0f2e" }}>
                    {mm.name} (Stage {mm.stage})
                  </option>
                ))}
            </select>
          </Field>
          <Field label="STAGE">
            <select style={inputStyle()} value={stage} onChange={(e) => setStage(e.target.value)}>
              {STAGES.map((s) => (
                <option key={s} value={s} style={{ background: "#1a0f2e" }}>
                  Stage {s}
                </option>
              ))}
            </select>
          </Field>

          <button
            disabled={!name.trim()}
            onClick={() => onAdd({ name: name.trim(), mentorId, stage })}
            style={{
              fontFamily: MONO_FONT,
              fontSize: 12.5,
              letterSpacing: 1,
              color: "#0b0714",
              background: name.trim() ? C.purple : C.mutedDark,
              borderRadius: 999,
              padding: "12px 0",
              fontWeight: 700,
              marginTop: 4,
            }}
          >
            ADD TO TEAM
          </button>
        </div>
      </div>
    </div>
  );
}
