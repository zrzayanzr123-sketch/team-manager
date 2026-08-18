import React, { useState, useEffect, useRef, useMemo, createContext, useContext } from "react";
import {
  Plus, Minus, Trash2, X, ChevronLeft, ChevronRight, UserPlus, Pencil, Check, LogOut,
  Settings, ArrowLeft, Palette, LogIn,
} from "lucide-react";
import { supabase } from "./supabaseClient";

// ---------- Theme system (purple / black / white, with selectable accent colours) ----------
function hexToRgb(hex) {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbaFromHex(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
function mixHex(hex, target, amount) {
  const c1 = hexToRgb(hex);
  const c2 = hexToRgb(target);
  const r = Math.round(c1.r + (c2.r - c1.r) * amount);
  const g = Math.round(c1.g + (c2.g - c1.g) * amount);
  const b = Math.round(c1.b + (c2.b - c1.b) * amount);
  return `rgb(${r}, ${g}, ${b})`;
}

const THEME_LIST = [
  { key: "purple", label: "Purple", accent: "#a855f7" },
  { key: "blue", label: "Blue", accent: "#3b82f6" },
  { key: "emerald", label: "Emerald", accent: "#10b981" },
  { key: "rose", label: "Rose", accent: "#f43f5e" },
  { key: "amber", label: "Amber", accent: "#f59e0b" },
  { key: "teal", label: "Teal", accent: "#14b8a6" },
  { key: "crimson", label: "Crimson", accent: "#dc2626" },
  { key: "indigo", label: "Indigo", accent: "#6366f1" },
];

function getTheme(key) {
  const found = THEME_LIST.find((t) => t.key === key) || THEME_LIST[0];
  const accent = found.accent;
  return {
    key: found.key,
    bg: "#0b0714",
    bgGlow: `radial-gradient(ellipse 900px 500px at 50% -10%, ${rgbaFromHex(accent, 0.32)} 0%, #0b0714 60%)`,
    card: "rgba(32, 18, 52, 0.55)",
    cardSoft: "rgba(24, 14, 40, 0.6)",
    border: rgbaFromHex(accent, 0.22),
    borderStrong: rgbaFromHex(accent, 0.45),
    purple: accent,
    purpleDeep: mixHex(accent, "#000000", 0.35),
    purpleLight: mixHex(accent, "#ffffff", 0.4),
    white: "#f5f2ff",
    muted: "#9884b4",
    mutedDark: "#6b5a8a",
    danger: "#f87171",
    amber: "#f0b74a",
  };
}

const ThemeContext = createContext(getTheme("purple"));
const useTheme = () => useContext(ThemeContext);

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
function isActiveOnDate(m, iso) {
  return !m.deleted || iso <= m.deletedAt;
}
function round1(nn) {
  return Math.round(nn * 10) / 10;
}

// ---------- Small UI atoms (all theme-aware) ----------
function StatCard({ label, value, big, danger }) {
  const C = useTheme();
  const accentColor = danger ? C.danger : C.purple;
  return (
    <div
      style={{
        background: danger
          ? `linear-gradient(160deg, ${rgbaFromHex(C.danger, 0.22)}, rgba(20,10,35,0.4))`
          : "linear-gradient(160deg, rgba(120,60,220,0.28), rgba(20,10,35,0.4))",
        border: `1px solid ${danger ? rgbaFromHex(C.danger, 0.45) : C.borderStrong}`,
        borderRadius: 18,
        boxShadow: `0 0 24px ${rgbaFromHex(accentColor, 0.1)}`,
      }}
      className="flex-1 min-w-[90px] px-3 py-4 flex flex-col items-center justify-center text-center"
    >
      <div style={{ fontFamily: DISPLAY_FONT, color: C.white, fontSize: big ? 30 : 24, fontWeight: 700, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontFamily: MONO_FONT, color: danger ? C.danger : C.purpleLight, fontSize: 11, letterSpacing: 1.5, marginTop: 6 }}>
        {label}
      </div>
    </div>
  );
}

function Segmented({ value, onChange }) {
  const C = useTheme();
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

function Stepper({ value, onChange, disabled, small }) {
  const C = useTheme();
  const s = small ? 22 : 26;
  return (
    <div className="flex items-center gap-1.5" style={{ opacity: disabled ? 0.35 : 1 }}>
      <button
        disabled={disabled}
        onClick={() => onChange(Math.max(0, value - 1))}
        style={{
          width: s,
          height: s,
          borderRadius: 999,
          border: `1px solid ${C.border}`,
          background: C.cardSoft,
          color: C.white,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Minus size={small ? 11 : 13} />
      </button>
      <div style={{ fontFamily: DISPLAY_FONT, color: C.white, fontSize: small ? 15 : 18, width: small ? 18 : 22, textAlign: "center" }}>
        {value}
      </div>
      <button
        disabled={disabled}
        onClick={() => onChange(value + 1)}
        style={{
          width: s,
          height: s,
          borderRadius: 999,
          border: `1px solid ${C.purpleDeep}`,
          background: C.purple,
          color: "#0b0714",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Plus size={small ? 11 : 13} />
      </button>
    </div>
  );
}

function LabeledStepper({ label, value, onChange, disabled }) {
  const C = useTheme();
  return (
    <div className="flex flex-col items-center gap-1">
      <div style={{ fontFamily: MONO_FONT, color: C.mutedDark, fontSize: 9, letterSpacing: 0.5 }}>{label}</div>
      <Stepper value={value} onChange={onChange} disabled={disabled} small />
    </div>
  );
}

function Field({ label, children }) {
  const C = useTheme();
  return (
    <div className="flex flex-col gap-1.5">
      <div style={{ fontFamily: MONO_FONT, fontSize: 10.5, letterSpacing: 1, color: C.purpleLight }}>{label}</div>
      {children}
    </div>
  );
}

function inputStyle(C) {
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
  const C = useTheme();
  return (
    <div style={{ background: C.cardSoft, border: `1px solid ${C.border}`, borderRadius: 12 }} className="flex-1 py-2 text-center">
      <div style={{ fontFamily: DISPLAY_FONT, color: C.white, fontSize: 16, fontWeight: 700 }}>{value}</div>
      <div style={{ fontFamily: MONO_FONT, color: C.mutedDark, fontSize: 8.5, letterSpacing: 1, marginTop: 1 }}>{label}</div>
    </div>
  );
}

function EmptyState({ text }) {
  const C = useTheme();
  return (
    <div style={{ border: `1px dashed ${C.border}`, borderRadius: 18, color: C.muted }} className="p-8 text-center">
      <div style={{ fontFamily: MONO_FONT, fontSize: 12.5, lineHeight: 1.6 }}>{text}</div>
    </div>
  );
}

// ---------- Auth modal (sign in / sign up / forgot password) ----------
function AuthModal({ initialMode = "signin", onClose }) {
  const C = useTheme();
  const [mode, setMode] = useState(initialMode); // signin | signup | forgot-email | forgot-code
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
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
        setInfo("Account created. If email confirmation is enabled, check your inbox before logging in.");
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
      } else if (mode === "forgot-email") {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setInfo("If that email has an account, a code has been sent to it.");
        setMode("forgot-code");
      } else if (mode === "forgot-code") {
        const { error: otpError } = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
        if (otpError) throw otpError;
        const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
        if (pwError) throw pwError;
        setInfo("Password updated. You're logged in.");
        setTimeout(onClose, 900);
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const titles = {
    signin: "Log In",
    signup: "Sign Up",
    "forgot-email": "Reset Password",
    "forgot-code": "Enter Code",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(6,3,12,0.8)", zIndex: 60 }} className="flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#150b26", border: `1px solid ${C.borderStrong}`, borderRadius: 20, width: "100%", maxWidth: 380 }} className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div style={{ fontFamily: DISPLAY_FONT, color: C.white, fontSize: 20, fontWeight: 700 }}>{titles[mode]}</div>
          <button onClick={onClose} style={{ color: C.mutedDark }}>
            <X size={18} />
          </button>
        </div>

        {(mode === "signin" || mode === "signup") && (
          <div className="flex gap-2 mb-4">
            {["signin", "signup"].map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => {
                  setMode(m);
                  setError("");
                  setInfo("");
                }}
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
        )}

        <form onSubmit={submit} className="flex flex-col gap-4">
          {(mode === "signin" || mode === "signup" || mode === "forgot-email") && (
            <Field label="EMAIL">
              <input style={inputStyle(C)} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
          )}
          {(mode === "signin" || mode === "signup") && (
            <Field label="PASSWORD">
              <input style={inputStyle(C)} type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            </Field>
          )}
          {mode === "forgot-code" && (
            <>
              <Field label="CODE FROM EMAIL">
                <input style={inputStyle(C)} value={code} onChange={(e) => setCode(e.target.value)} required />
              </Field>
              <Field label="NEW PASSWORD">
                <input style={inputStyle(C)} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} required />
              </Field>
            </>
          )}

          {mode === "signin" && (
            <button
              type="button"
              onClick={() => {
                setMode("forgot-email");
                setError("");
                setInfo("");
              }}
              style={{ fontFamily: MONO_FONT, color: C.mutedDark, fontSize: 11, textDecoration: "underline", textAlign: "left" }}
            >
              Forgot password?
            </button>
          )}

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
            {busy
              ? "PLEASE WAIT…"
              : mode === "signin"
              ? "LOG IN"
              : mode === "signup"
              ? "CREATE ACCOUNT"
              : mode === "forgot-email"
              ? "SEND CODE"
              : "RESET PASSWORD"}
          </button>

          {mode === "forgot-email" && (
            <button type="button" onClick={() => setMode("signin")} style={{ fontFamily: MONO_FONT, color: C.mutedDark, fontSize: 11, textDecoration: "underline" }}>
              Back to log in
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

// ---------- Week navigation hook (used independently by Team Data & My Data) ----------
function useWeekNav() {
  const [weekOffset, setWeekOffset] = useState(0);
  const today = useMemo(() => new Date(), []);
  const todayISO = toISO(today);
  const weekStart = useMemo(() => addDays(startOfWeek(today), weekOffset * 7), [today, weekOffset]);
  const weekDates = useMemo(() => [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(weekStart, i)), [weekStart]);
  const visibleDates = useMemo(() => {
    const isCurrent = weekOffset === 0;
    const list = isCurrent ? weekDates.filter((d) => toISO(d) <= todayISO) : weekDates;
    return [...list].reverse();
  }, [weekDates, weekOffset, todayISO]);
  return { weekOffset, setWeekOffset, weekStart, weekDates, visibleDates, todayISO };
}

// ---------- Data persistence hook (Supabase when logged in, localStorage as guest) ----------
const GUEST_KEY = "team-manager-guest-data";

function useAppData(session) {
  const [loaded, setLoaded] = useState(false);
  const [members, setMembers] = useState([]);
  const [records, setRecords] = useState({});
  const [themeKey, setThemeKey] = useState("purple");
  const [saveState, setSaveState] = useState("idle");
  const saveTimer = useRef(null);
  const userId = session?.user?.id || null;

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    (async () => {
      if (userId) {
        const { data } = await supabase.from("team_data").select("data").eq("user_id", userId).maybeSingle();
        if (cancelled) return;
        if (data && data.data) {
          setMembers(data.data.members || DEFAULT_DATA.members);
          setRecords(data.data.records || {});
          setThemeKey(data.data.theme || "purple");
        } else {
          await supabase.from("team_data").upsert({ user_id: userId, data: { ...DEFAULT_DATA, theme: "purple" } });
          setMembers(DEFAULT_DATA.members);
          setRecords({});
          setThemeKey("purple");
        }
      } else {
        try {
          const raw = localStorage.getItem(GUEST_KEY);
          const parsed = raw ? JSON.parse(raw) : null;
          setMembers(parsed?.members || DEFAULT_DATA.members);
          setRecords(parsed?.records || {});
          setThemeKey(parsed?.theme || "purple");
        } catch (e) {
          setMembers(DEFAULT_DATA.members);
          setRecords({});
          setThemeKey("purple");
        }
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!loaded) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const payload = { members, records, theme: themeKey };
      if (userId) {
        const { error } = await supabase.from("team_data").upsert({ user_id: userId, data: payload });
        setSaveState(error ? "idle" : "saved");
      } else {
        try {
          localStorage.setItem(GUEST_KEY, JSON.stringify(payload));
          setSaveState("saved");
        } catch (e) {
          setSaveState("idle");
        }
      }
    }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [members, records, themeKey, loaded, userId]);

  return { loaded, members, setMembers, records, setRecords, themeKey, setThemeKey, saveState };
}

// ---------- Main App ----------
export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = guest

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{ background: "#0b0714", minHeight: "100vh" }} className="flex items-center justify-center">
        <div style={{ fontFamily: MONO_FONT, color: "#9884b4", letterSpacing: 2, fontSize: 12 }}>LOADING…</div>
      </div>
    );
  }

  return <Shell session={session} />;
}

function Shell({ session }) {
  const app = useAppData(session);
  const theme = getTheme(app.themeKey);

  if (!app.loaded) {
    return (
      <div style={{ background: "#0b0714", minHeight: "100vh" }} className="flex items-center justify-center">
        <div style={{ fontFamily: MONO_FONT, color: "#9884b4", letterSpacing: 2, fontSize: 12 }}>LOADING…</div>
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={theme}>
      <TeamManager session={session} app={app} />
    </ThemeContext.Provider>
  );
}

function TeamManager({ session, app }) {
  const C = useTheme();
  const { members, setMembers, records, setRecords, themeKey, setThemeKey, saveState } = app;
  const [page, setPage] = useState("team-data");
  const [showAdd, setShowAdd] = useState(false);
  const [authModal, setAuthModal] = useState(null); // null | "signin" | "signup"

  const todayISO = toISO(new Date());

  function getEntry(iso, memberId) {
    return records[iso]?.[memberId] || { status: null, sales: 0, bts: 0, ss: 0, c: 0 };
  }

  function setEntry(iso, memberId, patch) {
    setRecords((prev) => {
      const day = { ...(prev[iso] || {}) };
      const current = day[memberId] || { status: null, sales: 0, bts: 0, ss: 0, c: 0 };
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
    const unscheduledCount = entries.filter((e) => e.status === "unscheduled").length;
    return { totalSales, pieceAvg, scoring, inCount, unscheduledCount };
  }

  function computeMemberWeekStats(memberId, weekDatesArr) {
    let totalSales = 0,
      totalBTS = 0,
      totalSS = 0,
      totalC = 0,
      daysWorked = 0,
      soldDays = 0;
    weekDatesArr.forEach((d) => {
      const iso = toISO(d);
      const e = getEntry(iso, memberId);
      if (e.status === "in") {
        daysWorked += 1;
        totalSales += e.sales || 0;
        totalBTS += e.bts || 0;
        totalSS += e.ss || 0;
        totalC += e.c || 0;
        if ((e.sales || 0) > 0) soldDays += 1;
      }
    });
    const pieceAvg = daysWorked ? totalSales / daysWorked : 0;
    const scoring = daysWorked ? (soldDays / daysWorked) * 100 : 0;
    return { totalSales, totalBTS, totalSS, totalC, pieceAvg, scoring, daysWorked };
  }

  function computeTeamWeekStats(weekDatesArr) {
    let totalSales = 0;
    let totalInPersonDays = 0;
    let soldPersonDays = 0;
    let unscheduledCount = 0;
    const perMember = {};
    members.forEach((m) => (perMember[m.id] = { sales: 0, days: 0 }));
    weekDatesArr.forEach((d) => {
      const iso = toISO(d);
      const ds = computeDayStats(iso);
      totalSales += ds.totalSales;
      unscheduledCount += ds.unscheduledCount;
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
    return { totalSales, weeklyPieceAvg, weeklyScoring, unscheduledCount };
  }

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
              {!session ? "BROWSING AS GUEST" : saveState === "saving" ? "SAVING…" : "ALL CHANGES SAVED"}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setPage("settings")} title="Settings" style={{ color: C.mutedDark, padding: 6 }}>
              <Settings size={18} />
            </button>
            {session ? (
              <button onClick={signOut} title="Log out" style={{ color: C.mutedDark, padding: 6 }}>
                <LogOut size={18} />
              </button>
            ) : (
              <button
                onClick={() => setAuthModal("signin")}
                style={{
                  fontFamily: MONO_FONT,
                  fontSize: 10.5,
                  letterSpacing: 1,
                  color: "#0b0714",
                  background: C.purple,
                  borderRadius: 999,
                  padding: "7px 12px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <LogIn size={13} /> LOG IN
              </button>
            )}
          </div>
        </div>

        {page === "settings" ? (
          <SettingsPage
            session={session}
            themeKey={themeKey}
            setThemeKey={setThemeKey}
            onBack={() => setPage("team-data")}
            onRequestAuth={() => setAuthModal("signin")}
          />
        ) : (
          <>
            {/* Nav tabs */}
            <div className="flex mb-6" style={{ borderBottom: `1px solid ${C.border}` }}>
              {[
                { key: "team-data", label: "Team Data" },
                { key: "my-data", label: "My Data" },
                { key: "my-team", label: "My Team" },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setPage(t.key)}
                  style={{
                    fontFamily: MONO_FONT,
                    fontSize: 12,
                    letterSpacing: 0.5,
                    color: page === t.key ? C.white : C.mutedDark,
                    padding: "10px 4px",
                    marginRight: 16,
                    borderBottom: page === t.key ? `2px solid ${C.purple}` : "2px solid transparent",
                    fontWeight: page === t.key ? 700 : 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.label.toUpperCase()}
                </button>
              ))}
            </div>

            {page === "team-data" && (
              <TeamDataPage
                membersForDay={membersForDay}
                computeDayStats={computeDayStats}
                computeTeamWeekStats={computeTeamWeekStats}
                getEntry={getEntry}
                setEntry={setEntry}
              />
            )}
            {page === "my-data" && (
              <MyDataPage getEntry={getEntry} setEntry={setEntry} computeMemberWeekStats={computeMemberWeekStats} />
            )}
            {page === "my-team" && (
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
          </>
        )}
      </div>

      {authModal && <AuthModal initialMode={authModal} onClose={() => setAuthModal(null)} />}
    </div>
  );
}

// ---------- Week nav header (shared look for Team Data & My Data) ----------
function WeekNavHeader({ weekStart, weekOffset, setWeekOffset }) {
  const C = useTheme();
  const weekEnd = addDays(weekStart, 6);
  return (
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
  );
}

// ---------- Team Data Page ----------
function TeamDataPage({ membersForDay, computeDayStats, computeTeamWeekStats, getEntry, setEntry }) {
  const C = useTheme();
  const nav = useWeekNav();
  const weekStats = computeTeamWeekStats(nav.weekDates);

  return (
    <div>
      <WeekNavHeader weekStart={nav.weekStart} weekOffset={nav.weekOffset} setWeekOffset={nav.setWeekOffset} />

      <div className="flex gap-2.5 mb-3">
        <StatCard label="SALES" value={weekStats.totalSales} big />
        <StatCard label="PIECE AVG" value={round1(weekStats.weeklyPieceAvg)} />
        <StatCard label="SCORING" value={`${Math.round(weekStats.weeklyScoring)}%`} />
      </div>

      {weekStats.unscheduledCount > 0 && (
        <div className="flex gap-2.5 mb-7">
          <StatCard label="UNSCHEDULED ABSENCES" value={weekStats.unscheduledCount} danger />
        </div>
      )}
      {weekStats.unscheduledCount === 0 && <div className="mb-4" />}

      {nav.visibleDates.length === 0 ? (
        <EmptyState text="No days in this week yet." />
      ) : (
        <div className="flex flex-col gap-4">
          {nav.visibleDates.map((d) => {
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

// ---------- My Data Page (Zayan's own tracking, synced with Team Data) ----------
function MyDataPage({ getEntry, setEntry, computeMemberWeekStats }) {
  const C = useTheme();
  const nav = useWeekNav();
  const stats = computeMemberWeekStats(ZAYAN_ID, nav.weekDates);
  const hasSales = stats.totalSales >= 1;

  return (
    <div>
      <WeekNavHeader weekStart={nav.weekStart} weekOffset={nav.weekOffset} setWeekOffset={nav.setWeekOffset} />

      <div className="flex gap-2.5 mb-3">
        <StatCard label="SALES" value={stats.totalSales} big />
        <StatCard label="PIECE AVG" value={round1(stats.pieceAvg)} />
        <StatCard label="SCORING" value={`${Math.round(stats.scoring)}%`} />
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        <MiniStat label="BTS" value={Math.round(stats.totalBTS)} />
        <MiniStat label="SS" value={Math.round(stats.totalSS)} />
        <MiniStat label="C" value={Math.round(stats.totalC)} />
        <MiniStat label="SU" value={Math.round(stats.totalSales)} />
      </div>

      {hasSales && (
        <div className="flex gap-2 mb-7 flex-wrap">
          <MiniStat label="BTS / SALE" value={Math.round(stats.totalBTS / stats.totalSales)} />
          <MiniStat label="SS / SALE" value={Math.round(stats.totalSS / stats.totalSales)} />
          <MiniStat label="C / SALE" value={Math.round(stats.totalC / stats.totalSales)} />
        </div>
      )}
      {!hasSales && <div className="mb-4" />}

      {nav.visibleDates.length === 0 ? (
        <EmptyState text="No days in this week yet." />
      ) : (
        <div className="flex flex-col gap-4">
          {nav.visibleDates.map((d) => {
            const iso = toISO(d);
            const entry = getEntry(iso, ZAYAN_ID);
            const disabled = entry.status !== "in";
            return (
              <div key={iso} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20 }} className="p-4">
                <div style={{ fontFamily: DISPLAY_FONT, color: C.white, fontSize: 19, fontWeight: 700, marginBottom: 12 }}>
                  {fmtDayLong(d)}
                </div>
                <Segmented value={entry.status} onChange={(status) => setEntry(iso, ZAYAN_ID, { status })} />
                <div className="grid grid-cols-4 gap-2 mt-4">
                  <LabeledStepper label="SU" value={entry.sales || 0} disabled={disabled} onChange={(v) => setEntry(iso, ZAYAN_ID, { sales: v })} />
                  <LabeledStepper label="BTS" value={entry.bts || 0} disabled={disabled} onChange={(v) => setEntry(iso, ZAYAN_ID, { bts: v })} />
                  <LabeledStepper label="SS" value={entry.ss || 0} disabled={disabled} onChange={(v) => setEntry(iso, ZAYAN_ID, { ss: v })} />
                  <LabeledStepper label="C" value={entry.c || 0} disabled={disabled} onChange={(v) => setEntry(iso, ZAYAN_ID, { c: v })} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- Settings Page ----------
function SettingsPage({ session, themeKey, setThemeKey, onBack, onRequestAuth }) {
  const C = useTheme();
  const [email, setEmail] = useState(session?.user?.email || "");
  const [newPassword, setNewPassword] = useState("");
  const [emailMsg, setEmailMsg] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [busyEmail, setBusyEmail] = useState(false);
  const [busyPw, setBusyPw] = useState(false);

  async function updateEmail() {
    setEmailMsg("");
    setBusyEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      setEmailMsg("Check your inbox to confirm the new email address.");
    } catch (err) {
      setEmailMsg(err.message || "Something went wrong.");
    } finally {
      setBusyEmail(false);
    }
  }

  async function updatePassword() {
    setPwMsg("");
    setBusyPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPwMsg("Password updated.");
      setNewPassword("");
    } catch (err) {
      setPwMsg(err.message || "Something went wrong.");
    } finally {
      setBusyPw(false);
    }
  }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 mb-6" style={{ color: C.mutedDark }}>
        <ArrowLeft size={16} />
        <span style={{ fontFamily: MONO_FONT, fontSize: 12, letterSpacing: 1 }}>BACK</span>
      </button>

      <div style={{ fontFamily: MONO_FONT, color: C.purpleLight, fontSize: 11, letterSpacing: 1.5 }} className="mb-3">
        ACCOUNT
      </div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18 }} className="p-4 mb-8">
        {session ? (
          <div className="flex flex-col gap-5">
            <Field label="EMAIL">
              <div className="flex gap-2">
                <input style={inputStyle(C)} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <button
                  disabled={busyEmail}
                  onClick={updateEmail}
                  style={{ fontFamily: MONO_FONT, fontSize: 11, color: "#0b0714", background: C.purple, borderRadius: 10, padding: "0 14px", fontWeight: 700 }}
                >
                  SAVE
                </button>
              </div>
              {emailMsg && <div style={{ fontFamily: MONO_FONT, color: C.purpleLight, fontSize: 10.5, marginTop: 4 }}>{emailMsg}</div>}
            </Field>
            <Field label="NEW PASSWORD">
              <div className="flex gap-2">
                <input style={inputStyle(C)} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} />
                <button
                  disabled={busyPw || newPassword.length < 6}
                  onClick={updatePassword}
                  style={{ fontFamily: MONO_FONT, fontSize: 11, color: "#0b0714", background: C.purple, borderRadius: 10, padding: "0 14px", fontWeight: 700 }}
                >
                  SAVE
                </button>
              </div>
              {pwMsg && <div style={{ fontFamily: MONO_FONT, color: C.purpleLight, fontSize: 10.5, marginTop: 4 }}>{pwMsg}</div>}
            </Field>
          </div>
        ) : (
          <div className="flex flex-col gap-3 items-start">
            <div style={{ fontFamily: MONO_FONT, color: C.muted, fontSize: 12.5, lineHeight: 1.6 }}>
              Log in to manage your account email and password.
            </div>
            <button
              onClick={onRequestAuth}
              style={{ fontFamily: MONO_FONT, fontSize: 11.5, color: "#0b0714", background: C.purple, borderRadius: 999, padding: "9px 16px", fontWeight: 700 }}
            >
              LOG IN
            </button>
          </div>
        )}
      </div>

      <div style={{ fontFamily: MONO_FONT, color: C.purpleLight, fontSize: 11, letterSpacing: 1.5 }} className="mb-3 flex items-center gap-2">
        <Palette size={13} /> APPEARANCE
      </div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18 }} className="p-4">
        <div className="grid grid-cols-4 gap-3">
          {THEME_LIST.map((t) => {
            const active = t.key === themeKey;
            return (
              <button key={t.key} onClick={() => setThemeKey(t.key)} className="flex flex-col items-center gap-1.5">
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 999,
                    background: `linear-gradient(160deg, ${t.accent}, ${mixHex(t.accent, "#000000", 0.4)})`,
                    border: active ? `2px solid ${C.white}` : "2px solid transparent",
                    boxShadow: active ? `0 0 12px ${rgbaFromHex(t.accent, 0.6)}` : "none",
                  }}
                />
                <div style={{ fontFamily: MONO_FONT, fontSize: 9, color: active ? C.white : C.mutedDark }}>{t.label}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- My Team Page ----------
function MyTeamPage({ activeMembers, childrenOf, eligibleMentors, addMember, updateMember, deleteMember, showAdd, setShowAdd }) {
  const C = useTheme();
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

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20 }} className="p-4 mb-8 overflow-x-auto flex justify-center">
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
  const C = useTheme();
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
  const C = useTheme();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(member.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => setName(member.name), [member.name]);

  return (
    <div style={{ background: C.card, border: `1px solid ${isSelf ? C.borderStrong : C.border}`, borderRadius: 16 }} className="p-3.5">
      <div className="flex items-center justify-between gap-2 mb-3">
        {editing ? (
          <input
            style={inputStyle(C)}
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
          <select style={inputStyle(C)} value={member.stage} onChange={(e) => onUpdate({ stage: e.target.value })}>
            {STAGES.map((s) => (
              <option key={s} value={s} style={{ background: "#1a0f2e" }}>
                Stage {s}
              </option>
            ))}
          </select>
        </Field>
        {!isSelf && (
          <Field label="MENTOR">
            <select style={inputStyle(C)} value={member.mentorId || ZAYAN_ID} onChange={(e) => onUpdate({ mentorId: e.target.value })}>
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
  const C = useTheme();
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
            <input style={inputStyle(C)} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </Field>
          <Field label="MENTOR">
            <select style={inputStyle(C)} value={mentorId} onChange={(e) => setMentorId(e.target.value)}>
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
            <select style={inputStyle(C)} value={stage} onChange={(e) => setStage(e.target.value)}>
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
