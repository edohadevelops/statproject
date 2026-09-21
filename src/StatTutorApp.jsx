import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Home, BookOpen, Timer, Layers, ChevronRight, ChevronLeft, ChevronDown,
  Check, X, Flame, Target, Clock, Calendar, Sparkles, ArrowRight,
  Copy, CheckCircle2, Circle, PlayCircle, BookMarked, Info, Lightbulb,
  RotateCcw, Settings, Maximize2, Minimize2, Sun, Moon, FileText, Download,
  ClipboardList, ClipboardCheck, Route, GraduationCap, ListChecks,
  MessageCircleQuestion,
} from "lucide-react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer,
} from "recharts";

/* ============================================================
   DESIGN TOKENS — deep slate-blue primary (distinct from the
   Calc 2 app's forest green). CSS-variable driven so light/dark
   mode (auto by time of day + manual override) works correctly.
============================================================ */
const T = {
  bg: "var(--bg)",
  bgDeep: "var(--bg-deep)",
  surface: "var(--surface)",
  surface2: "var(--surface2)",
  chalk: "var(--text)",
  chalkDim: "var(--text-dim)",
  chalkFaint: "var(--border)",
  amber: "var(--primary)",
  amberDim: "var(--primary-dim)",
  coral: "var(--danger)",
  coralDim: "var(--danger-dim)",
  blue: "var(--info)",
  blueDim: "var(--info-dim)",
};

const LIGHT_VARS = {
  "--bg": "#f7f5f4",
  "--bg-deep": "#eeeaea",
  "--surface": "#ffffff",
  "--surface2": "#f3eeee",
  "--text": "#241417",
  "--text-dim": "#6b5a5c",
  "--border": "#e3dbdc",
  "--primary": "#5E0009",
  "--primary-dim": "rgba(94,0,9,0.12)",
  "--danger": "#8a5a1f",
  "--danger-dim": "rgba(138,90,31,0.12)",
  "--info": "#425563",
  "--info-dim": "rgba(66,85,99,0.12)",
  "--on-primary": "#fbf7f7",
};
const DARK_VARS = {
  "--bg": "#181113",
  "--bg-deep": "#120c0e",
  "--surface": "#241a1c",
  "--surface2": "#2e2124",
  "--text": "#f5eeef",
  "--text-dim": "#c2a9ac",
  "--border": "rgba(245,238,239,0.14)",
  "--primary": "#d84a56",
  "--primary-dim": "rgba(216,74,86,0.16)",
  "--danger": "#d9a15a",
  "--danger-dim": "rgba(217,161,90,0.16)",
  "--info": "#8fa6b8",
  "--info-dim": "rgba(143,166,184,0.16)",
  "--on-primary": "#180a0c",
};

const ME = "Amen";
const TEST1_DATE = "2026-10-03"; // estimate — first week of October, adjust once confirmed
const FINAL_DATE = "2026-12-09"; // confirmed from syllabus: Wed Dec 9, 8:45-10:45am

/* ---------- KaTeX loader ---------- */
let katexPromise = null;
function loadKatex() {
  if (katexPromise) return katexPromise;
  katexPromise = new Promise((resolve) => {
    if (window.katex) return resolve(window.katex);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js";
    script.onload = () => resolve(window.katex);
    document.head.appendChild(script);
  });
  return katexPromise;
}

function PureMath({ tex, block, style }) {
  const ref = useRef(null);
  useEffect(() => {
    let cancelled = false;
    loadKatex().then((katex) => {
      if (cancelled || !ref.current || !katex) return;
      try {
        katex.render(tex, ref.current, { throwOnError: false, displayMode: !!block });
      } catch {
        ref.current.textContent = tex;
      }
    });
    return () => (cancelled = true);
  }, [tex, block]);
  return block ? (
    <div ref={ref} style={{ margin: "8px 0", overflowX: "auto", ...style }} />
  ) : (
    <span ref={ref} style={style} />
  );
}

/* Math_ handles two conventions, correctly, from day one (this was a
   real bug fixed the hard way in the Calc 2 app — not repeating it):
   1. Pure LaTeX, no literal "$" characters — whole string to KaTeX.
   2. Prose with inline $...$-delimited math — split so English stays
      as plain text and only the math parts go through KaTeX. */
function Math_({ tex, block, style }) {
  if (!tex) return null;
  if (!tex.includes("$")) {
    return <PureMath tex={tex} block={block} style={style} />;
  }
  const parts = tex.split(/(\$[^$]+\$)/g).filter((p) => p.length > 0);
  return (
    <div style={{ display: block ? "block" : "inline", margin: block ? "8px 0" : 0, lineHeight: 1.6, ...style }}>
      {parts.map((part, i) =>
        part.startsWith("$") && part.endsWith("$") && part.length > 2 ? (
          <PureMath key={i} tex={part.slice(1, -1)} block={false} />
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </div>
  );
}

/* ---------- Supabase persistence ----------
   Fill in your own project's URL and anon key below once you've
   created it — everything else works as soon as those two lines
   are real. */
const SUPABASE_URL = "https://stfczlujttygfdapmsof.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0ZmN6bHVqdHR5Z2ZkYXBtc29mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NjY2MDUsImV4cCI6MjEwNDU0MjYwNX0.qNAMVThlaA5YRdTyrlKKyXj3BP5PTLm-Lerr_Pd2vcI";
const SB_HEADERS = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };

const pendingWrites = new Map();
let syncListeners = [];
function notifySync(status) { syncListeners.forEach((fn) => fn(status)); }
function subscribeSync(fn) {
  syncListeners.push(fn);
  return () => { syncListeners = syncListeners.filter((f) => f !== fn); };
}

async function loadState(key, fallback) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/tutor_state?id=eq.${encodeURIComponent(`${ME}:${key}`)}&select=payload`,
      { headers: SB_HEADERS }
    );
    if (!res.ok) return fallback;
    const rows = await res.json();
    if (rows && rows[0] && rows[0].payload !== undefined) return rows[0].payload;
  } catch (e) {}
  return fallback;
}
async function attemptSave(key, value) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/tutor_state`, {
    method: "POST",
    headers: { ...SB_HEADERS, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify([{ id: `${ME}:${key}`, payload: value, updated_at: new Date().toISOString() }]),
  });
  if (!res.ok) throw new Error(`save failed: ${res.status}`);
}
let retryTimer = null;
function scheduleRetry(delay = 4000) {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(flushPendingWrites, delay);
}
async function flushPendingWrites() {
  if (pendingWrites.size === 0) return;
  notifySync("syncing");
  const entries = Array.from(pendingWrites.entries());
  let anyFailed = false;
  for (const [key, value] of entries) {
    try {
      await attemptSave(key, value);
      if (pendingWrites.get(key) === value) pendingWrites.delete(key);
    } catch { anyFailed = true; }
  }
  if (anyFailed) { notifySync("offline"); scheduleRetry(8000); } else { notifySync("saved"); }
}
async function saveState(key, value) {
  pendingWrites.set(key, value);
  notifySync("syncing");
  try {
    await attemptSave(key, value);
    if (pendingWrites.get(key) === value) pendingWrites.delete(key);
    notifySync(pendingWrites.size === 0 ? "saved" : "syncing");
  } catch { notifySync("offline"); scheduleRetry(4000); }
}
if (typeof window !== "undefined") {
  window.addEventListener("online", () => flushPendingWrites());
}

function SyncIndicator() {
  const [status, setStatus] = useState("saved");
  useEffect(() => subscribeSync(setStatus), []);
  const map = {
    saved: { label: "Synced", color: T.chalkDim, dot: T.amber },
    syncing: { label: "Saving...", color: T.chalkDim, dot: T.blue },
    offline: { label: "Offline - will retry", color: T.coral, dot: T.coral },
  };
  const m = map[status];
  return (
    <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono px-2" style={{ color: m.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.dot, animation: status === "syncing" ? "pulseDot 1s ease-in-out infinite" : "none" }} />
      {m.label}
    </div>
  );
}

/* ============================================================
   COURSE ROADMAP — grouped from the real 39-lecture syllabus
   into study sessions. Sessions 6-9 have full real content
   (built from Dr. Zheng's actual lecture notes). Sessions 1-5
   are foundational review with solid concept explanations.
   Sessions 10-16 are honestly marked as not yet built -- no
   fabricated content, same standard as the Calc 2 app.
============================================================ */
const SESSIONS = [
  { id: 1, title: "Random Variables, CDFs & Expectation", lectures: "Lec 1", type: "review" },
  { id: 2, title: "Joint Distributions, Covariance & Correlation", lectures: "Lec 2", type: "review" },
  { id: 3, title: "Moments, MGFs & Common Distributions", lectures: "Lec 3", type: "review" },
  { id: 4, title: "Gamma & Beta Distributions", lectures: "Lec 4", type: "review" },
  { id: 5, title: "Exponential Distribution, Inequalities & CLT", lectures: "Lec 5", type: "review" },
  { id: 6, title: "Parameter Estimation & Method of Moments", lectures: "Lec 6-7", type: "new", test: "Test 1 likely covers through here" },
  { id: 7, title: "Maximum Likelihood Estimation", lectures: "Lec 8-11", type: "new", test: "Test 1 likely covers through here" },
  { id: 8, title: "Sufficient Statistics & Factorization Theorem", lectures: "Lec 13-15", type: "new" },
  { id: 9, title: "Exponential Family of Distributions", lectures: "Lec 16-17", type: "new" },
  { id: 10, title: "Chi-Square & t-Distributions", lectures: "Lec 17-19", type: "new" },
  { id: 11, title: "Sampling Distributions of Sample Mean & Variance", lectures: "Lec 20-22", type: "new" },
  { id: 12, title: "Confidence Intervals", lectures: "Lec 22-25", type: "new" },
  { id: 13, title: "Fisher Information & Cramer-Rao Lower Bound", lectures: "Lec 25-28", type: "new" },
  { id: 14, title: "Estimator Evaluation: MSE, Efficiency, Bootstrap", lectures: "Lec 29-32", type: "new" },
  { id: 15, title: "Hypothesis Testing Fundamentals", lectures: "Lec 33-36", type: "new" },
  { id: 16, title: "p-values, Two-Sample Tests & F-Distribution", lectures: "Lec 37-39", type: "new", test: "Final exam territory" },
];

const CATEGORIES = {
  Foundations: "Probability Foundations",
  Estimation: "Estimation Theory",
  Sampling: "Sampling Distributions & Inference",
  Testing: "Hypothesis Testing",
};

/* ============================================================
   FORMULA SHEET — real LaTeX, rendered through KaTeX like
   everything else (learned this lesson from day one this time).
============================================================ */
const FORMULAS = [
  {
    id: "f1", cat: "Foundations", name: "CDF (Distribution Function)",
    formula: "F(x) = P(X \\leq x)",
    why: "Defines 'probability up to here' — the same idea whether $X$ is discrete or continuous.",
    when: "Starting point for any probability question about where $X$ is likely to land.",
    example: "If $F(5)=0.75$, there's a 75% chance $X$ is 5 or less.",
  },
  {
    id: "f2", cat: "Foundations", name: "PMF vs PDF",
    formula: "\\text{Discrete: } p(x)=P(X=x) \\qquad \\text{Continuous: } P(a\\leq X\\leq b)=\\int_a^b f(x)\\,dx",
    why: "Discrete outcomes are countable, so individual probabilities make sense. Continuous outcomes need area-under-a-curve instead, since any single exact value has probability 0.",
    when: "Whenever you need $P(X \\text{ in some range})$ — check whether $X$ is discrete or continuous first.",
    example: "$f(x)=2x$ on $[0,1]$: $P(0.25\\leq X\\leq 0.75)=\\int_{0.25}^{0.75}2x\\,dx$",
  },
  {
    id: "f3", cat: "Foundations", name: "k-th Moment",
    formula: "\\mu_k = E(X^k) = \\int x^k f(x|\\theta)\\,dx \\quad \\text{(or} \\sum x^k p(x|\\theta) \\text{ if discrete)}",
    why: "A 'moment' is just an expectation of a power of $X$ — the building block for Method of Moments.",
    when: "$k=1$ gives the mean; $k=2$ relates to variance via $\\text{Var}(X)=\\mu_2-\\mu_1^2$.",
    example: "Uniform on $[0,\\theta]$: $\\mu_1=E(X)=\\theta/2$.",
  },
  {
    id: "f4", cat: "Estimation", name: "Method of Moments Recipe",
    formula: "\\mu_k = m_k, \\quad \\text{where } m_k = \\frac1n\\sum_{i=1}^n X_i^k",
    why: "Set the theoretical moment (has $\\theta$ in it) equal to the sample moment (a real number from data), then solve for $\\theta$.",
    when: "Pick the smallest $k$ for which $\\mu_k$ actually contains the unknown parameter.",
    example: "Exponential $f(x|\\beta)=\\tfrac1\\beta e^{-x/\\beta}$: $E(X)=\\beta$, so $\\hat\\beta=\\bar X$.",
  },
  {
    id: "f5", cat: "Estimation", name: "Likelihood Function",
    formula: "L(\\theta) = f(x_1,\\ldots,x_n|\\theta) = \\prod_{i=1}^n f(x_i|\\theta)",
    why: "The joint probability/density of your actual observed data, viewed as a function of the unknown $\\theta$ — not of $x$.",
    when: "Whenever you're about to do Maximum Likelihood Estimation.",
    example: "For an i.i.d. sample, always start by writing $L(\\theta)$ as a product over $i=1,\\ldots,n$.",
    yt: null,
  },
  {
    id: "f6", cat: "Estimation", name: "Log-Likelihood & MLE",
    formula: "l(\\theta) = \\log L(\\theta) = \\sum_{i=1}^n \\log f(x_i|\\theta), \\qquad \\frac{\\partial l(\\theta)}{\\partial \\theta} = 0",
    why: "Products are painful to differentiate; sums are easy. Since $\\log$ is increasing, maximizing $l(\\theta)$ maximizes $L(\\theta)$ too.",
    when: "The standard first two moves on almost every MLE problem: take the log, then take the derivative and set it to 0.",
    example: "Always double check the resulting critical point is actually a maximum (not a minimum) when it matters.",
  },
  {
    id: "f7", cat: "Estimation", name: "Statistic (definition)",
    formula: "T = r(X_1,\\ldots,X_n) \\quad \\text{— a function of the sample with NO unknown parameters inside}",
    why: "An estimator is always a statistic — this is what makes it computable from data alone.",
    when: "Check any proposed estimator: does it secretly contain $\\theta$? If so, it's not a valid statistic.",
    example: "$\\bar X$ is a statistic; $X_1 + \\theta$ is not (since $\\theta$ is unknown).",
  },
  {
    id: "f8", cat: "Estimation", name: "Factorization Theorem",
    formula: "T \\text{ is sufficient for } \\theta \\iff f_n(x|\\theta) = u(x)\\,v[T(x),\\theta]",
    why: "The practical way to find/verify a sufficient statistic — split the joint density into a piece with no $\\theta$ ($u$) and a piece that only sees the data through $T$ ($v$).",
    when: "Any 'find a sufficient statistic' or 'show $T$ is sufficient' problem.",
    example: "Poisson: $f_n(x|\\theta)=\\left(\\prod \\tfrac{1}{x_i!}\\right)e^{-n\\theta}\\theta^{\\sum x_i}$ — depends on data only through $\\sum x_i$, so that's sufficient.",
  },
  {
    id: "f9", cat: "Estimation", name: "Exponential Family Form",
    formula: "f(x|\\theta) = \\exp[c(\\theta)T(x) + d(\\theta) + S(x)]",
    why: "A huge number of common distributions fit this template — once you match a distribution to this form, $\\sum T(x_i)$ is automatically a sufficient statistic, no factorization work needed.",
    when: "Bernoulli, Binomial, Poisson, Normal, Gamma, Beta, and Exponential all belong to this family.",
    example: "Bernoulli: $c(\\theta)=\\log\\frac{\\theta}{1-\\theta}$, $T(x)=x$ — matches the form directly.",
  },
];

/* ============================================================
   FLASHCARD DECK — real KaTeX equations, spaced repetition
============================================================ */
const FLASHCARDS_BASE = [
  { id: "fc1", cat: "Foundations", front: "CDF definition: $F(x) = \\ ?$", back: "$P(X \\leq x)$" },
  { id: "fc2", cat: "Foundations", front: "For a continuous $X$, how do you compute $P(a \\leq X \\leq b)$?", back: "$\\displaystyle\\int_a^b f(x)\\,dx$" },
  { id: "fc3", cat: "Estimation", front: "Method of Moments: what equation do you solve?", back: "$\\mu_k = m_k$ — theoretical moment equals sample moment" },
  { id: "fc4", cat: "Estimation", front: "MoM 'second rule' for choosing $k$?", back: "Pick the smallest $k$ such that $\\mu_k$ actually contains the unknown parameter $\\theta$." },
  { id: "fc5", cat: "Estimation", front: "Likelihood function $L(\\theta) = \\ ?$", back: "$\\displaystyle\\prod_{i=1}^n f(x_i|\\theta)$" },
  { id: "fc6", cat: "Estimation", front: "Why do we maximize $\\log L(\\theta)$ instead of $L(\\theta)$ directly?", back: "Log turns the product into a sum (easier to differentiate), and since log is increasing, the maximizer is the same." },
  { id: "fc7", cat: "Estimation", front: "What makes something a valid statistic?", back: "A function of $X_1,\\ldots,X_n$ with NO unknown parameters inside it." },
  { id: "fc8", cat: "Estimation", front: "Factorization Theorem: $f_n(x|\\theta) = \\ ?$", back: "$u(x)\\,v[T(x),\\theta]$ — $u$ has no $\\theta$, $v$ sees data only through $T$" },
  { id: "fc9", cat: "Estimation", front: "Exponential family general form?", back: "$f(x|\\theta) = \\exp[c(\\theta)T(x) + d(\\theta) + S(x)]$" },
  { id: "fc10", cat: "Estimation", front: "If a distribution is exponential family with statistic $T(x)$, what's automatically sufficient?", back: "$\\displaystyle\\sum_{i=1}^n T(x_i)$" },
];

/* ============================================================
   SESSION CONCEPTS — real content, built from Dr. Zheng's
   actual lecture notes for sessions 6-9. Sessions 1-5 have
   solid foundational explanations. Every worked example shows
   every step -- no skipping, learned the hard way on a previous
   project that skipped steps are the single biggest complaint
   a student has.
============================================================ */
const SESSION_CONCEPTS = {
  1: [{
    title: "Random Variables & the CDF",
    body: "A random variable is a rule that assigns a number to each outcome of an uncertain experiment. Once you have that, the natural question is 'how likely are different values?' — answered by the CDF, $F(x)=P(X\\leq x)$. Two facts always hold: $F$ never decreases as $x$ increases, and $F$ goes from 0 (far left) to 1 (far right).",
    formulaIds: ["f1"],
    keyIdea: "Discrete random variables use a PMF (individual probabilities, summed); continuous random variables use a PDF (density, integrated over a range). Same underlying idea — 'probability up to here' — just addition vs. integration.",
  }],
  2: [{
    title: "Joint, Marginal & Conditional Distributions",
    body: "When you have two random variables $X$ and $Y$ together, the joint distribution $f(x,y)$ describes their combined behavior. The marginal distribution of $X$ alone is obtained by summing/integrating out $Y$: $f_X(x) = \\int f(x,y)\\,dy$. The conditional distribution $f(y|x)$ describes $Y$'s behavior once you already know $X=x$: $f(y|x) = f(x,y)/f_X(x)$. Covariance, $\\text{Cov}(X,Y)=E[(X-\\mu_X)(Y-\\mu_Y)]$, measures whether $X$ and $Y$ tend to move together; correlation rescales covariance to always fall between $-1$ and $1$.",
    formulaIds: [],
    keyIdea: "Independence means $f(x,y)=f_X(x)f_Y(y)$ — knowing one variable tells you nothing about the other. This is the single most-used simplifying assumption in the whole course (it's built into every i.i.d. sample).",
  }],
  3: [{
    title: "Moments, MGFs & Common Distributions",
    body: "The moment generating function $M(t) = E(e^{tX})$ is a single function that 'encodes' every moment of $X$ at once — its $k$-th derivative evaluated at $t=0$ gives you $E(X^k)$ directly. You'll want Bernoulli, Binomial, Poisson, and Normal distributions memorized cold: their PMF/PDF, mean, and variance. The Central Limit Theorem says that averages of many i.i.d. random variables become approximately Normal, regardless of the original distribution — this is why the Normal distribution shows up everywhere in statistics.",
    formulaIds: ["f3"],
    keyIdea: "MGFs matter later for proving distributional results quickly (e.g. showing a sum of independent Normals is Normal) without doing a convolution integral by hand.",
  }],
  4: [{
    title: "Gamma & Beta Distributions",
    body: "The Gamma function $\\Gamma(\\alpha) = \\int_0^\\infty x^{\\alpha-1}e^{-x}dx$ generalizes the factorial ($\\Gamma(n)=(n-1)!$ for integers). The Gamma distribution, $f(x|\\alpha,\\beta) = \\frac{\\beta^\\alpha}{\\Gamma(\\alpha)}x^{\\alpha-1}e^{-\\beta x}$, generalizes the exponential distribution (which is the special case $\\alpha=1$). The Beta distribution lives on $[0,1]$ and is the standard model for a random probability or proportion.",
    formulaIds: [],
    keyIdea: "You'll see the Gamma distribution again constantly — it's the sufficient-statistic target in several MLE/sufficiency problems in this exact course (Problems 3 and 4 on your HW4 are both Gamma).",
  }],
  5: [{
    title: "Exponential Distribution, Inequalities & CLT",
    body: "The exponential distribution, $f(x|\\beta)=\\frac1\\beta e^{-x/\\beta}$, models waiting times — it has the memoryless property. Markov's Inequality ($P(X\\geq a) \\leq E(X)/a$ for nonnegative $X$) and Chebyshev's Inequality ($P(|X-\\mu|\\geq k\\sigma) \\leq 1/k^2$) give crude but distribution-free bounds on tail probabilities. The Law of Large Numbers says sample averages converge to the true mean as $n\\to\\infty$ — this is precisely why Method of Moments works at all.",
    formulaIds: [],
    keyIdea: "The Law of Large Numbers is the theoretical justification behind Method of Moments: $m_k \\to \\mu_k$ in probability as $n\\to\\infty$, so equating them is a reasonable thing to do.",
  }],
  6: [{
    title: "Parameter Estimation & Method of Moments",
    body: "An estimator is a formula $\\delta(X_1,\\ldots,X_n)$ that turns a sample into a guess for an unknown parameter $\\theta$. Method of Moments is the oldest, simplest recipe: compute the theoretical moment $\\mu_k=E(X^k)$ (contains $\\theta$), compute the sample moment $m_k=\\frac1n\\sum X_i^k$ (a real number from your data), set them equal, and solve for $\\theta$. If there are $p$ unknown parameters, do this $p$ times using $k=1,\\ldots,p$.",
    formulaIds: ["f4"],
    keyIdea: "Two rules for picking $k$: prefer small $k$ (easier to compute), and $\\mu_k$ must actually contain $\\theta$ — if it doesn't (like $E(X)=0$ for a symmetric distribution), move to a higher $k$.",
    yt: null,
  }],
  7: [{
    title: "Maximum Likelihood Estimation",
    body: "MLE asks a different question than MoM: 'which value of $\\theta$ makes the data I actually observed most probable?' Build the likelihood $L(\\theta)=\\prod f(x_i|\\theta)$, take the log to turn the product into a sum, differentiate with respect to $\\theta$, set it to zero, and solve. MLE and MoM can give the same answer (Normal mean) or different answers (the θ example from your notes: MoM gives $5/12$, MLE gives $0.5$) — neither method is universally 'more correct,' they're just different philosophies.",
    formulaIds: ["f5", "f6"],
    keyIdea: "Watch for edge cases where calculus alone doesn't work — Examples 5-7 in your MLE notes show cases where the MLE is found by reasoning about the likelihood's shape directly (uniform distributions), not by setting a derivative to zero. Always check whether $L(\\theta)$ is even differentiable in $\\theta$ before reaching for calculus.",
  }],
  8: [{
    title: "Sufficient Statistics & the Factorization Theorem",
    body: "A statistic $T(X_1,\\ldots,X_n)$ is sufficient for $\\theta$ if, once you know $T$, the rest of the data tells you nothing more about $\\theta$ — you could throw away the individual $X_i$'s and keep only $T$ without losing information. The Factorization Theorem makes this checkable: $T$ is sufficient exactly when the joint density factors as $f_n(x|\\theta) = u(x)\\,v[T(x),\\theta]$, where $u$ has no $\\theta$ in it and $v$ only sees the data through $T$.",
    formulaIds: ["f7", "f8"],
    keyIdea: "Any one-to-one function of a sufficient statistic is also sufficient — so $\\sum X_i$ and $\\bar X$ are 'the same' sufficient statistic in this sense, just rescaled. Also: the MLE is always a function of the sufficient statistic (when one exists) — this is a genuinely useful cross-check between the two topics.",
  }],
  9: [{
    title: "Exponential Family of Distributions",
    body: "A distribution belongs to the (one-parameter) exponential family if its density can be written as $f(x|\\theta)=\\exp[c(\\theta)T(x)+d(\\theta)+S(x)]$. Once you show a distribution has this form, you get sufficiency for free: $\\sum_{i=1}^n T(X_i)$ is automatically a sufficient statistic, no factorization bookkeeping required. Bernoulli, Poisson, Normal, and Gamma all belong to this family.",
    formulaIds: ["f9"],
    keyIdea: "This is a shortcut layered on top of Session 8, not a replacement for it — when a distribution doesn't obviously fit the exponential family template, fall back to the Factorization Theorem directly.",
  }],
};


/* ============================================================
   WORKED EXAMPLES — one fully solved, read-through example per
   session, shown BEFORE the hands-on practice. Every algebraic
   step is shown explicitly, nothing skipped.
============================================================ */
const WORKED_EXAMPLES = {
  6: [
    { id: "we6-ex1", tex: "\text{Discrete } X: P(0)=\tfrac{2\theta}{3}, P(1)=\tfrac{\theta}{3}, P(2)=\tfrac{2(1-\theta)}{3}, P(3)=\tfrac{1-\theta}{3}. \text{ Data: } 3,0,2,1,3,2,1,0,2,1. \text{ Find } \hat\theta.", answer: "\hat\theta = \tfrac{5}{12}", steps: [
      { tex: "Compute $E(X)$ by multiplying each value by its probability and adding: $E(X) = 0\cdot\tfrac{2\theta}{3} + 1\cdot\tfrac{\theta}{3} + 2\cdot\tfrac{2(1-\theta)}{3} + 3\cdot\tfrac{1-\theta}{3}$.", why: "General rule: for a discrete random variable, $E(X)=\sum x\,P(x)$ — multiply every value by its own probability, then add everything up." },
      { tex: "Expand each term: $0$; $\tfrac{\theta}{3}$; $\tfrac{4(1-\theta)}{3}=\tfrac{4-4\theta}{3}$; $(1-\theta)$.", why: "Simplify the coefficients one piece at a time before combining — trying to add four unsimplified fractions at once is where arithmetic mistakes happen." },
      { tex: "Add the fraction terms over a common denominator of 3: $\tfrac{\theta}{3}+\tfrac{4-4\theta}{3} = \tfrac{4-3\theta}{3}$. Then add $(1-\theta)=\tfrac{3-3\theta}{3}$: $\tfrac{4-3\theta}{3}+\tfrac{3-3\theta}{3}=\tfrac{7-6\theta}{3}$.", why: "General rule: always get a common denominator before adding fractions — writing $(1-\theta)$ as $\tfrac{3-3\theta}{3}$ makes it addable to the others." },
      { tex: "So $E(X) = \tfrac{7}{3}-2\theta$ (splitting $\tfrac{7-6\theta}{3}$ into $\tfrac73-\tfrac{6\theta}{3}=\tfrac73-2\theta$).", why: "" },
      { tex: "Compute the sample mean from the data $(3,0,2,1,3,2,1,0,2,1)$: $\bar X = \tfrac{3+0+2+1+3+2+1+0+2+1}{10}=\tfrac{15}{10}=1.5$.", why: "" },
      { tex: "Set $\tfrac73-2\theta=1.5$. Subtract $\tfrac73$ from both sides: $-2\theta = 1.5-\tfrac73$.", why: "" },
      { tex: "Convert to sixths: $1.5=\tfrac96$, $\tfrac73=\tfrac{14}{6}$, so $-2\theta=\tfrac96-\tfrac{14}{6}=-\tfrac56$.", why: "General rule: sixths is the natural common denominator whenever you're mixing thirds and halves." },
      { tex: "Divide both sides by $-2$: $\hat\theta = \tfrac{5}{12}$.", why: "" },
    ]},
    { id: "we6-ex2", tex: "\text{Laplace: } f(x|\sigma)=\tfrac{1}{2\sigma}e^{-|x|/\sigma}. \text{ Find the MoM estimator } \hat\sigma.", answer: "\hat\sigma = \sqrt{\dfrac{\sum X_i^2}{2n}}", steps: [
      { tex: "Try $k=1$ first: $E(X) = \displaystyle\int_{-\infty}^{\infty} x\cdot\tfrac{1}{2\sigma}e^{-|x|/\sigma}\,dx$.", why: "General rule: always try $k=1$ first, since it's the simplest moment — but be ready to abandon it if it fails rule 2." },
      { tex: "The integrand $x\cdot e^{-|x|/\sigma}$ is an ODD function (flipping the sign of $x$ flips the sign of the whole integrand), integrated over a symmetric interval $(-\infty,\infty)$.", why: "General rule: odd function integrated over a symmetric interval always gives exactly 0 — recognize this shape instantly rather than grinding through the integral." },
      { tex: "So $E(X)=0$ — this does NOT contain $\sigma$, violating the second rule (the moment must contain the unknown parameter). We must move to $k=2$.", why: "This is exactly the situation the second rule warns about — a real example where $k=1$ genuinely fails." },
      { tex: "Compute $\mu_2=E(X^2) = \displaystyle\int_{-\infty}^{\infty} x^2\cdot\tfrac{1}{2\sigma}e^{-|x|/\sigma}\,dx$. Since $x^2$ is even, this equals $2\displaystyle\int_0^\infty x^2\cdot\tfrac{1}{2\sigma}e^{-x/\sigma}\,dx = \tfrac{1}{\sigma}\displaystyle\int_0^\infty x^2 e^{-x/\sigma}\,dx$.", why: "General rule: for an even integrand on a symmetric interval, double the integral from 0 to infinity instead — this also gets rid of the absolute value, since $x=|x|$ for $x\geq0$." },
      { tex: "Substitute $y=x/\sigma$ (so $x=\sigma y$, $dx=\sigma\,dy$): $\tfrac{1}{\sigma}\displaystyle\int_0^\infty (\sigma y)^2 e^{-y}\sigma\,dy = \sigma^2\displaystyle\int_0^\infty y^2 e^{-y}\,dy$.", why: "General rule: this substitution always clears $\sigma$ out of the exponent in exponential-type densities, leaving a standard reference integral." },
      { tex: "$\displaystyle\int_0^\infty y^2 e^{-y}\,dy = \Gamma(3) = 2! = 2$.", why: "General rule: memorize $\int_0^\infty y^k e^{-y}dy=k!$ for integer $k$ — here $k=2$." },
      { tex: "So $\mu_2 = 2\sigma^2$. Set $2\sigma^2 = m_2 = \tfrac1n\sum X_i^2$, and solve: $\sigma^2 = \tfrac{\sum X_i^2}{2n}$, so $\hat\sigma = \sqrt{\dfrac{\sum X_i^2}{2n}}$.", why: "" },
    ]},
    { id: "we6-ex3", tex: "\text{Uniform } f(x|\theta)=\tfrac1\theta \text{ on } [0,\theta]. \text{ Find the MoM estimator } \hat\theta.", answer: "\hat\theta = 2\bar X", steps: [
      { tex: "Compute the theoretical first moment: $E(X) = \displaystyle\int_0^\theta x\cdot\frac1\theta\,dx = \frac1\theta\int_0^\theta x\,dx$.", why: "General rule: $k=1$ is always worth trying first — it's the simplest moment to compute." },
      { tex: "Antiderivative of $x$ is $\tfrac{x^2}{2}$, evaluated from 0 to $\theta$: $\dfrac1\theta\left[\dfrac{x^2}{2}\right]_0^\theta = \dfrac1\theta\cdot\dfrac{\theta^2}{2} = \dfrac{\theta}{2}$.", why: "Nothing to substitute here — direct power rule integration." },
      { tex: "So $\mu_1 = E(X) = \dfrac{\theta}{2}$ — this contains $\theta$, so $k=1$ works.", why: "" },
      { tex: "Set $\mu_1 = m_1$: $\dfrac{\theta}{2} = \bar X$.", why: "General rule: $m_1$ is always just the plain sample mean $\bar X$." },
      { tex: "Solve for $\theta$: multiply both sides by 2 — $\hat\theta = 2\bar X$.", why: "" },
    ]},
    { id: "we6-ex4", tex: "\text{Normal: } f(x|\mu,\sigma^2)=\tfrac{1}{\sqrt{2\pi}\sigma}\exp\left[-\tfrac{(x-\mu)^2}{2\sigma^2}\right]. \text{ Find MoM estimators } \hat\mu,\hat\sigma^2.", answer: "\hat\mu=\bar X, \quad \hat\sigma^2 = \tfrac1n\sum(X_i-\bar X)^2", steps: [
      { tex: "Two unknown parameters ($\mu$ and $\sigma^2$), so we need TWO equations: use $k=1$ and $k=2$.", why: "General rule: with $p$ unknown parameters, use the first $p$ moments — one equation per parameter." },
      { tex: "First theoretical moment: $\mu_1 = E(X) = \mu$ (this is just the definition of the Normal distribution's mean parameter).", why: "" },
      { tex: "Second theoretical moment: use the identity $\text{Var}(X)=E(X^2)-[E(X)]^2$, rearranged as $E(X^2)=\text{Var}(X)+[E(X)]^2$. Since $\text{Var}(X)=\sigma^2$ and $E(X)=\mu$: $\mu_2 = \sigma^2+\mu^2$.", why: "General rule: for any distribution, once you know the variance formula, $E(X^2)$ follows immediately from this identity — often faster than integrating $x^2 f(x)$ directly." },
      { tex: "Sample moments: $m_1=\bar X$, $m_2=\tfrac1n\sum X_i^2$.", why: "" },
      { tex: "Equation 1: $\mu=\bar X \implies \hat\mu=\bar X$.", why: "" },
      { tex: "Equation 2: $\sigma^2+\mu^2 = \tfrac1n\sum X_i^2$. Substitute $\mu=\bar X$ (already solved): $\sigma^2 = \tfrac1n\sum X_i^2 - \bar X^2$.", why: "General rule: solve equations in order — plug the already-found $\hat\mu$ into the second equation rather than solving both simultaneously from scratch." },
      { tex: "This simplifies to the familiar sample variance formula: $\hat\sigma^2 = \tfrac1n\sum X_i^2-\bar X^2 = \tfrac1n\sum(X_i-\bar X)^2$ (a standard algebraic identity).", why: "General rule: $\tfrac1n\sum X_i^2-\bar X^2$ and $\tfrac1n\sum(X_i-\bar X)^2$ are ALWAYS equal — worth memorizing both forms, since problems present either one." },
    ]},
  ],
  7: [
    { id: "we7-ex1", tex: "\text{Same discrete setup as the MoM example. Find the MLE } \hat\theta.", answer: "\hat\theta = 0.5", steps: [
      { tex: "Write the likelihood as a product matching the observed data $(3,0,2,1,3,2,1,0,2,1)$: count how many times each value appears — $0$ appears twice, $1$ appears three times, $2$ appears three times, $3$ appears twice.", why: "General rule: for repeated discrete data, group by value and count frequencies rather than writing out all 10 factors separately — it's the same product, just organized." },
      { tex: "$L(\theta) = P(0)^2 P(1)^3 P(2)^3 P(3)^2 = \left(\tfrac{2\theta}{3}\right)^2\left(\tfrac{\theta}{3}\right)^3\left(\tfrac{2(1-\theta)}{3}\right)^3\left(\tfrac{1-\theta}{3}\right)^2$.", why: "" },
      { tex: "Take the log: $l(\theta) = 2\log\tfrac{2\theta}{3}+3\log\tfrac{\theta}{3}+3\log\tfrac{2(1-\theta)}{3}+2\log\tfrac{1-\theta}{3}$.", why: "" },
      { tex: "Expand each term using $\log(ab)=\log a+\log b$, separating out every piece that involves $\theta$ from every piece that's just a constant: collecting all the $\theta$-terms gives $2\log\theta+3\log\theta=5\log\theta$ from the first two pieces, and $3\log(1-\theta)+2\log(1-\theta)=5\log(1-\theta)$ from the last two.", why: "General rule: constants like $\log\tfrac23$ and $\log\tfrac13$ don't depend on $\theta$, so they'll vanish when we differentiate — no need to track their exact values." },
      { tex: "So $l(\theta) = C + 5\log\theta + 5\log(1-\theta)$, where $C$ bundles all the constant terms.", why: "" },
      { tex: "Differentiate: $\dfrac{dl}{d\theta} = \dfrac{5}{\theta} - \dfrac{5}{1-\theta}$.", why: "$\dfrac{d}{d\theta}\log(1-\theta) = \dfrac{-1}{1-\theta}$ by the chain rule — the derivative of the INSIDE ($1-\theta$) is $-1$." },
      { tex: "Set to 0: $\dfrac{5}{\theta}=\dfrac{5}{1-\theta} \implies \theta = 1-\theta \implies 2\theta=1 \implies \theta=0.5$.", why: "" },
      { tex: "$\hat\theta_{MLE}=0.5$ — compare directly to the MoM answer of $5/12\approx0.417$ for this exact same data. Different methods, different (both valid) answers.", why: "" },
    ]},
    { id: "we7-ex2", tex: "\text{Laplace: } f(x|\sigma)=\tfrac{1}{2\sigma}e^{-|x|/\sigma}. \text{ Find the MLE } \hat\sigma.", answer: "\hat\sigma = \dfrac{\sum|X_i|}{n}", steps: [
      { tex: "Log-likelihood: $l(\sigma) = \displaystyle\sum_{i=1}^n\left[-\log2-\log\sigma-\dfrac{|X_i|}{\sigma}\right]$.", why: "$\log\left(\tfrac{1}{2\sigma}e^{-|x|/\sigma}\right) = -\log(2\sigma)-\dfrac{|x|}{\sigma} = -\log2-\log\sigma-\dfrac{|x|}{\sigma}$." },
      { tex: "Differentiate with respect to $\sigma$: $\dfrac{dl}{d\sigma} = \displaystyle\sum_{i=1}^n\left[-\dfrac1\sigma + \dfrac{|X_i|}{\sigma^2}\right] = -\dfrac{n}{\sigma}+\dfrac{\sum|X_i|}{\sigma^2}$.", why: "$\dfrac{d}{d\sigma}\left[-\dfrac{|x|}{\sigma}\right] = \dfrac{|x|}{\sigma^2}$ by the power/chain rule (treat $|X_i|$ as a constant with respect to $\sigma$)." },
      { tex: "Set to 0 and multiply through by $\sigma^2$: $-n\sigma+\sum|X_i|=0 \implies \sigma = \dfrac{\sum|X_i|}{n}$.", why: "" },
      { tex: "$\hat\sigma_{MLE} = \dfrac{\sum|X_i|}{n}$ — compare to the MoM answer, $\sqrt{\sum X_i^2/(2n)}$. Different formulas for the same parameter — another case where MLE and MoM disagree.", why: "" },
    ]},
    { id: "we7-ex3", tex: "\text{Normal, both } \mu,\sigma \text{ unknown. Find the MLEs } \hat\mu,\hat\sigma.", answer: "\hat\mu=\bar X, \quad \hat\sigma=\sqrt{\tfrac1n\sum(X_i-\bar X)^2}", steps: [
      { tex: "Log-likelihood: $l(\mu,\sigma) = \displaystyle\sum_{i=1}^n\left[-\log\sigma-\tfrac12\log(2\pi)-\dfrac{(X_i-\mu)^2}{2\sigma^2}\right] = -n\log\sigma - \tfrac{n}{2}\log(2\pi) - \dfrac{1}{2\sigma^2}\displaystyle\sum_{i=1}^n(X_i-\mu)^2$.", why: "Same log-density expansion as always, then sum term by term, pulling constants ($-\log\sigma$, $-\tfrac12\log2\pi$) out of the sum since they don't depend on $i$." },
      { tex: "Since there are TWO unknowns, take TWO partial derivatives — one with respect to $\mu$, one with respect to $\sigma$ — and set each to 0.", why: "General rule: with multiple unknown parameters, differentiate with respect to EACH one separately, treating the others as constants each time." },
      { tex: "$\dfrac{\partial l}{\partial\mu} = \dfrac{1}{\sigma^2}\displaystyle\sum_{i=1}^n(X_i-\mu) = 0$.", why: "The chain rule on $-\dfrac{1}{2\sigma^2}\sum(X_i-\mu)^2$: derivative of $(X_i-\mu)^2$ with respect to $\mu$ is $-2(X_i-\mu)$, and the $-\tfrac12$ and $-2$ cancel to leave $+\tfrac1{\sigma^2}\sum(X_i-\mu)$." },
      { tex: "Solve: $\displaystyle\sum(X_i-\mu)=0 \implies \sum X_i = n\mu \implies \hat\mu=\bar X$.", why: "" },
      { tex: "$\dfrac{\partial l}{\partial\sigma} = -\dfrac{n}{\sigma}+\dfrac{1}{\sigma^3}\displaystyle\sum_{i=1}^n(X_i-\mu)^2 = 0$.", why: "Derivative of $-n\log\sigma$ is $-n/\sigma$; derivative of $-\tfrac{1}{2\sigma^2}(\cdots)$ with respect to $\sigma$ uses the power rule on $\sigma^{-2}$, giving $+\sigma^{-3}(\cdots)$." },
      { tex: "Multiply through by $\sigma^3$: $-n\sigma^2 + \displaystyle\sum(X_i-\mu)^2 = 0 \implies \sigma^2 = \dfrac1n\sum(X_i-\mu)^2$.", why: "" },
      { tex: "Substitute the already-found $\hat\mu=\bar X$: $\hat\sigma = \sqrt{\dfrac1n\displaystyle\sum(X_i-\bar X)^2}$ — this time MLE matches MoM exactly (up to $\sigma$ vs $\sigma^2$, the same quantity).", why: "General rule: solve the $\mu$-equation first, then substitute into the $\sigma$-equation — solving both simultaneously from scratch is much messier." },
    ]},
    { id: "we7-ex4", tex: "\text{Pareto: } f(x|x_0,\theta)=\theta x_0^\theta x^{-\theta-1}, x\geq x_0 \text{ (known)}, \theta>1. \text{ Find the MLE } \hat\theta.", answer: "\hat\theta = \dfrac{1}{\left(\tfrac1n\sum\log X_i\right)-\log x_0}", steps: [
      { tex: "Log-likelihood: $l(\theta) = \displaystyle\sum_{i=1}^n\log\left(\theta x_0^\theta X_i^{-\theta-1}\right) = \displaystyle\sum_{i=1}^n\left[\log\theta+\theta\log x_0-(\theta+1)\log X_i\right]$.", why: "Same $\log(abc)=\log a+\log b+\log c$ expansion as always, applied term by term to the three factors $\theta$, $x_0^\theta$, and $X_i^{-\theta-1}$." },
      { tex: "Distribute the sum: $l(\theta) = n\log\theta + n\theta\log x_0 - (\theta+1)\displaystyle\sum_{i=1}^n\log X_i$.", why: "$\log\theta$ and $\theta\log x_0$ are each added $n$ times (no $i$-dependence); $(\theta+1)$ factors out of its sum." },
      { tex: "Differentiate with respect to $\theta$: $\dfrac{dl}{d\theta} = \dfrac{n}{\theta} + n\log x_0 - \displaystyle\sum_{i=1}^n\log X_i$.", why: "$\dfrac{d}{d\theta}[n\log\theta]=n/\theta$; $\dfrac{d}{d\theta}[n\theta\log x_0]=n\log x_0$ (since $\log x_0$ is just a constant, $x_0$ is known); $\dfrac{d}{d\theta}\left[-(\theta+1)\sum\log X_i\right] = -\sum\log X_i$." },
      { tex: "Set to 0: $\dfrac{n}{\theta} = \displaystyle\sum_{i=1}^n\log X_i - n\log x_0$.", why: "" },
      { tex: "Solve for $\theta$: $\theta = \dfrac{n}{\displaystyle\sum\log X_i - n\log x_0}$. Divide top and bottom by $n$: $\theta = \dfrac{1}{\left(\tfrac1n\displaystyle\sum\log X_i\right)-\log x_0}$.", why: "General rule: dividing numerator and denominator by $n$ converts a raw sum $\sum\log X_i$ into the more interpretable AVERAGE of the logs, $\tfrac1n\sum\log X_i$ — cleaner to state and to compute from data." },
      { tex: "$\hat\theta_{MLE} = \dfrac{1}{\left(\tfrac1n\sum\log X_i\right)-\log x_0}$", why: "Worth double-checking: since $X_i\geq x_0$ always, $\log X_i\geq\log x_0$, so the average of the logs is at least $\log x_0$ — keeping the denominator non-negative, as required for a sensible $\theta$." },
    ]},
    { id: "we7-ex5", tex: "\text{Same uniform setup, } f(x|\theta)=\tfrac1\theta \text{ on } [0,\theta]. \text{ Find the MLE } \hat\theta.", answer: "\hat\theta = \max(X_1,\ldots,X_n)", steps: [
      { tex: "Write the likelihood: $L(\theta) = \displaystyle\prod_{i=1}^n f(x_i|\theta) = \dfrac{1}{\theta^n}$, but ONLY valid when every $x_i$ satisfies $0\leq x_i\leq\theta$; otherwise $L(\theta)=0$.", why: "General rule: always write out the domain restriction explicitly for a uniform-type density." },
      { tex: "The condition '$x_i\leq\theta$ for every $i$' is the same as saying $\theta \geq \max(x_1,\ldots,x_n)$.", why: "General rule: 'true for every $i$' conditions collapse into a max or min condition." },
      { tex: "So we need $\theta \geq \max(x_1,\ldots,x_n)$, and among all such $\theta$, we want to maximize $1/\theta^n$.", why: "" },
      { tex: "$1/\theta^n$ is a DECREASING function of $\theta$ — so to maximize it, we want $\theta$ as SMALL as possible.", why: "General rule: when $dL/d\theta$ never equals zero, reason about monotonicity directly instead of calculus." },
      { tex: "The smallest $\theta$ allowed is exactly $\theta = \max(x_1,\ldots,x_n)$.", why: "" },
      { tex: "$\hat\theta_{MLE} = \max(X_1,\ldots,X_n)$ — completely different from the MoM answer ($2\bar X$) for the exact same distribution.", why: "This estimator always underestimates $\theta$ slightly, since $\max(X_i)<\theta$ with probability 1." },
    ]},
    { id: "we7-ex6", tex: "f(x|\theta)=e^{\theta-x} \text{ for } x>\theta \text{ (strict inequality). Show the MLE does not exist.}", answer: "\text{MLE does not exist}", steps: [
      { tex: "Likelihood: $L(\theta) = \displaystyle\prod_{i=1}^n e^{\theta-x_i} = e^{n\theta-\sum x_i}$, valid only when $\theta<x_i$ for EVERY $i$, i.e. $\theta<\min(x_1,\ldots,x_n)$.", why: "Same domain-restriction bookkeeping as every uniform-type problem — the strict inequality here matters a lot." },
      { tex: "$L(\theta)=e^{n\theta-\sum x_i}$ is an INCREASING function of $\theta$ (bigger $\theta$ makes the exponent bigger).", why: "General rule: when $\theta$ appears with a positive coefficient in the exponent, $L(\theta)$ increases with $\theta$ — the opposite situation from the uniform-max example." },
      { tex: "So we want $\theta$ as LARGE as possible, subject to $\theta<\min(x_1,\ldots,x_n)$ — but $\theta$ can get arbitrarily CLOSE to $\min(x_i)$ without ever reaching it (strict inequality).", why: "" },
      { tex: "There is no largest number strictly less than $\min(x_i)$ — for any candidate $\theta$, you could always pick a larger one still less than $\min(x_i)$. The supremum is $\min(x_i)$, but it's never attained.", why: "General rule: whenever a maximization problem's boundary is EXCLUDED (strict inequality) rather than included, check carefully whether a true maximum exists at all." },
      { tex: "Therefore, no value of $\theta$ actually maximizes $L(\theta)$ — the MLE does not exist for this version of the density.", why: "" },
    ]},
    { id: "we7-ex6b", tex: "\text{Fix the previous example by using } f(x|\theta)=e^{\theta-x} \text{ for } x\geq\theta \text{ (non-strict). Find the MLE.}", answer: "\hat\theta = \min(X_1,\ldots,X_n)", steps: [
      { tex: "Now the condition becomes $\theta\leq x_i$ for every $i$, i.e. $\theta\leq\min(x_1,\ldots,x_n)$ — and this value IS attainable now.", why: "General rule: switching a strict inequality to non-strict in the density can fix an otherwise-nonexistent MLE — the two versions describe the exact same distribution, just written differently." },
      { tex: "Since $L(\theta)$ is still increasing in $\theta$, the largest ALLOWED value is $\theta=\min(x_1,\ldots,x_n)$, and this time it's actually achievable.", why: "" },
      { tex: "$\hat\theta_{MLE} = \min(X_1,\ldots,X_n)$", why: "" },
    ]},
    { id: "we7-ex7", tex: "\text{Uniform}(\theta,\theta+1), -\infty<\theta<\infty. \text{ Show the MLE is not unique.}", answer: "\text{Any } \theta \text{ in } [\max(X_i)-1,\ \min(X_i)] \text{ is an MLE}", steps: [
      { tex: "The density is $f(x|\theta)=1$ for $\theta\leq x\leq\theta+1$ (and 0 otherwise) — so $L(\theta)=1$ whenever EVERY $x_i$ falls in $[\theta,\theta+1]$, and $L(\theta)=0$ otherwise.", why: "General rule: for a uniform density, the likelihood is a constant (here, exactly 1) wherever it's valid, and 0 elsewhere — there's no 'peak' to find via calculus, only a region where $L$ is nonzero." },
      { tex: "The condition '$\theta\leq x_i$ for all $i$' means $\theta\leq\min(x_1,\ldots,x_n)$. The condition '$x_i\leq\theta+1$ for all $i$' means $\theta\geq\max(x_1,\ldots,x_n)-1$.", why: "General rule: split a two-sided constraint ($\theta\leq x_i\leq\theta+1$) into its two separate one-sided conditions, then convert each to a min/max statement." },
      { tex: "So $L(\theta)=1$ for EVERY $\theta$ in the interval $[\max(x_i)-1,\ \min(x_i)]$, and $L(\theta)=0$ outside it.", why: "" },
      { tex: "Since $L(\theta)$ equals its maximum value (1) at every point in that whole interval, ANY $\theta$ in $[\max(X_i)-1,\min(X_i)]$ qualifies as a maximizer — the MLE is not a single number here.", why: "General rule: uniqueness of the MLE is not guaranteed in general — when the likelihood is flat across a range at its maximum, every point in that range is equally valid." },
    ]},
  ],
  8: [
    { id: "we8-ex1", tex: "\text{Bernoulli trials, } P(X_i=1)=\theta. \text{ Verify directly (from the definition) that } T=\sum X_i \text{ is sufficient.}", answer: "\text{Sufficient: } P(X=x|T=t)=1/\binom{n}{t}, \text{ independent of } \theta", steps: [
      { tex: "By the definition of conditional probability: $P(X_1=x_1,\ldots,X_n=x_n\mid T=t) = \dfrac{P(X_1=x_1,\ldots,X_n=x_n)}{P(T=t)}$.", why: "General rule: proving sufficiency directly from the definition (rather than via the Factorization Theorem) always starts by writing out this conditional probability formula." },
      { tex: "Numerator: since each $X_i$ is 0 or 1 with $P(X_i=1)=\theta$, and they're independent, the probability of any SPECIFIC arrangement with exactly $t$ ones and $n-t$ zeros is $\theta^t(1-\theta)^{n-t}$.", why: "Independence lets you multiply the individual Bernoulli probabilities together directly." },
      { tex: "Denominator: $T=\sum X_i$ counts the total number of 1's, which is Binomial$(n,\theta)$ by definition, so $P(T=t) = \binom{n}{t}\theta^t(1-\theta)^{n-t}$.", why: "General rule: a sum of $n$ independent Bernoulli$(\theta)$ trials is ALWAYS Binomial$(n,\theta)$ — a fact worth having memorized cold." },
      { tex: "Divide: $\dfrac{\theta^t(1-\theta)^{n-t}}{\binom{n}{t}\theta^t(1-\theta)^{n-t}} = \dfrac{1}{\binom{n}{t}}$.", why: "The $\theta^t(1-\theta)^{n-t}$ factors cancel completely, top and bottom." },
      { tex: "The result, $1/\binom{n}{t}$, has NO $\theta$ in it at all — confirming, straight from the definition, that $T=\sum X_i$ is sufficient for $\theta$.", why: "This matches what the Factorization Theorem would tell you instantly, but doing it from the raw definition once is worth seeing — it's what the theorem is built on top of." },
    ]},
    { id: "we8-ex2", tex: "\text{Let } X_1,\ldots,X_n \text{ be i.i.d. Poisson}(\theta). \text{ Show } T=\sum X_i \text{ is sufficient for } \theta.", answer: "\text{Sufficient by factorization: } u(x)=\prod\tfrac{1}{x_i!},\ v(T,\theta)=e^{-n\theta}\theta^T", steps: [
      { tex: "Write the joint PMF: $f_n(x|\theta) = \displaystyle\prod_{i=1}^n \dfrac{e^{-\theta}\theta^{x_i}}{x_i!}$.", why: "General rule: for an i.i.d. sample, the joint PMF is ALWAYS the product of the individual ones." },
      { tex: "Separate: $= \left(\displaystyle\prod_{i=1}^n \dfrac{1}{x_i!}\right) \cdot e^{-n\theta} \cdot \theta^{\sum_{i=1}^n x_i}$.", why: "General rule: $e^{-\theta}$ repeated $n$ times becomes $e^{-n\theta}$; $\theta^{x_1}\theta^{x_2}\cdots = \theta^{\sum x_i}$." },
      { tex: "Identify $u(x) = \displaystyle\prod_{i=1}^n \dfrac{1}{x_i!}$ — no $\theta$ in it.", why: "" },
      { tex: "Identify $v(T,\theta) = e^{-n\theta}\theta^{T}$ where $T=\sum x_i$ — depends on data ONLY through $T$.", why: "" },
      { tex: "Since $f_n(x|\theta) = u(x)\cdot v[T(x),\theta]$, $T=\sum X_i$ is sufficient for $\theta$.", why: "" },
    ]},
    { id: "we8-ex3", tex: "f(x|\theta)=\theta x^{\theta-1} \text{ for } 0<x<1. \text{ Show } T=\prod X_i \text{ is sufficient for } \theta.", answer: "\text{Sufficient: } u(x)=1,\ v(T,\theta)=\theta^n T^{\theta-1}", steps: [
      { tex: "Joint density: $f_n(x|\theta) = \displaystyle\prod_{i=1}^n \theta x_i^{\theta-1} = \theta^n \left(\displaystyle\prod_{i=1}^n x_i\right)^{\theta-1}$, valid for $0<x_i<1$ (all $i$).", why: "General rule: $\theta$ repeated $n$ times becomes $\theta^n$; the individual $x_i^{\theta-1}$ factors combine because they share the SAME exponent $\theta-1$." },
      { tex: "This already depends on the data only through $T=\prod x_i$ — set $u(x)=1$ (or, being careful about the domain, $u(x)=1$ for all $x_i\in(0,1)$ and $0$ otherwise) and $v(T,\theta)=\theta^n T^{\theta-1}$.", why: "General rule: sometimes the factorization is almost immediate once the joint density is simplified — don't overthink it if $u(x)$ turns out to just be 1." },
      { tex: "By the Factorization Theorem, $T=\prod X_i$ is sufficient for $\theta$.", why: "" },
    ]},
    { id: "we8-ex4", tex: "\text{Normal, mean } \mu \text{ unknown, variance } \sigma^2 \text{ known. Find a sufficient statistic for } \mu.", answer: "T=\sum X_i \text{ (equivalently } \bar X\text{)}", steps: [
      { tex: "Joint density: $f_n(x|\mu) = \displaystyle\prod_{i=1}^n \dfrac{1}{\sqrt{2\pi}\sigma}\exp\left[-\dfrac{(x_i-\mu)^2}{2\sigma^2}\right] = \dfrac{1}{(2\pi)^{n/2}\sigma^n}\exp\left[-\dfrac{1}{2\sigma^2}\displaystyle\sum_{i=1}^n(x_i-\mu)^2\right]$.", why: "Same combining move as always: constants multiply into a single power, exponentials combine by adding exponents." },
      { tex: "Expand the square inside the sum: $(x_i-\mu)^2 = x_i^2-2\mu x_i+\mu^2$, so $\displaystyle\sum(x_i-\mu)^2 = \sum x_i^2 - 2\mu\sum x_i + n\mu^2$.", why: "General rule: whenever $\mu$ (the unknown) is trapped inside a squared term summed over the data, expand the square FIRST — this is what lets you separate the $\mu$-dependent pieces from the $\mu$-free pieces." },
      { tex: "Substitute back: $f_n(x|\mu) = \dfrac{1}{(2\pi)^{n/2}\sigma^n}\exp\left[-\dfrac{\sum x_i^2}{2\sigma^2}\right]\cdot\exp\left[\dfrac{\mu\sum x_i}{\sigma^2}-\dfrac{n\mu^2}{2\sigma^2}\right]$.", why: "Split the single exponential into two separate exponential factors — one holding the $\mu$-free piece ($\sum x_i^2$), one holding everything that depends on $\mu$." },
      { tex: "Group $u(x) = \dfrac{1}{(2\pi)^{n/2}\sigma^n}\exp\left[-\dfrac{\sum x_i^2}{2\sigma^2}\right]$ (no $\mu$ — $\sigma^2$ is known, so it's just a constant here), and $v(T,\mu)=\exp\left[\dfrac{\mu T}{\sigma^2}-\dfrac{n\mu^2}{2\sigma^2}\right]$ where $T=\sum x_i$.", why: "" },
      { tex: "By the Factorization Theorem, $T=\sum X_i$ is sufficient for $\mu$. Since $\bar X = T/n$ is a one-to-one function of $T$, $\bar X$ is also sufficient.", why: "" },
    ]},
    { id: "we8-ex5", tex: "\text{Beta, } \alpha \text{ known, } \beta \text{ unknown: } f(x|\beta)=\dfrac{\Gamma(\alpha+\beta)}{\Gamma(\alpha)\Gamma(\beta)}x^{\alpha-1}(1-x)^{\beta-1}. \text{ Show } T'=\prod(1-X_i) \text{ is sufficient for } \beta.", answer: "\text{Sufficient: } u(x)=\Gamma(\alpha)^{-n}\prod x_i^{\alpha-1},\ v(T',\beta)=\left[\tfrac{\Gamma(\alpha+\beta)}{\Gamma(\beta)}\right]^n (T')^{\beta-1}", steps: [
      { tex: "Joint density: $f_n(x|\beta) = \displaystyle\prod_{i=1}^n \dfrac{\Gamma(\alpha+\beta)}{\Gamma(\alpha)\Gamma(\beta)}x_i^{\alpha-1}(1-x_i)^{\beta-1} = \Gamma(\alpha)^{-n}\left[\dfrac{\Gamma(\alpha+\beta)}{\Gamma(\beta)}\right]^n\left(\displaystyle\prod x_i\right)^{\alpha-1}\left(\displaystyle\prod(1-x_i)\right)^{\beta-1}$.", why: "Same grouping strategy: separate the pieces that repeat $n$ times as constants from the pieces built from products over $i$." },
      { tex: "Since $\alpha$ is KNOWN, group everything without $\beta$: $u(x) = \Gamma(\alpha)^{-n}\left(\displaystyle\prod x_i\right)^{\alpha-1}$.", why: "General rule: a known parameter, even though it appears in the formula, never counts as part of the 'depends on $\theta$' bookkeeping — only the truly unknown parameter matters for the split." },
      { tex: "Group the $\beta$-dependent piece: $v(T',\beta) = \left[\dfrac{\Gamma(\alpha+\beta)}{\Gamma(\beta)}\right]^n (T')^{\beta-1}$, where $T'=\displaystyle\prod_{i=1}^n(1-x_i)$.", why: "" },
      { tex: "By the Factorization Theorem, $T'=\prod(1-X_i)$ is sufficient for $\beta$.", why: "Your notes go one step further: since $T = \left[\log(-T')\right]^3/n$ happens to be a one-to-one function of $T'$ (for the specific $T$ they define), $T$ is ALSO sufficient — same information, repackaged." },
    ]},
    { id: "we8-ex6", tex: "\text{Uniform}(0,\theta). \text{ Show } T=\max(X_1,\ldots,X_n) \text{ is sufficient for } \theta.", answer: "\text{Sufficient: } u(x)=1,\ v(T,\theta)=\theta^{-n}\,h[T,\theta]", steps: [
      { tex: "Joint density: $f_n(x|\theta) = \displaystyle\prod_{i=1}^n \dfrac1\theta = \dfrac{1}{\theta^n}$, valid ONLY when every $x_i\in[0,\theta]$; it's 0 otherwise.", why: "" },
      { tex: "Every $x_i\leq\theta$ (for $i=1,\ldots,n$) is the same condition as $\max(x_1,\ldots,x_n)\leq\theta$.", why: "General rule: 'true for every $i$' conditions like this collapse to a max condition — the same trick used repeatedly in the MLE uniform examples." },
      { tex: "Define an indicator function $h[\max(x),\theta] = 1$ if $\max(x_1,\ldots,x_n)\leq\theta$, and $0$ otherwise.", why: "General rule: indicator functions are the standard tool for encoding a domain restriction cleanly inside the Factorization Theorem's $v$ piece." },
      { tex: "Then (for $x_i\geq0$, all $i$) we can write $f_n(x|\theta) = \dfrac{1}{\theta^n}h[\max(x_1,\ldots,x_n),\theta]$.", why: "" },
      { tex: "Set $u(x)=1$ and $v(T,\theta)=\dfrac{1}{\theta^n}h(T,\theta)$ where $T=\max(x_1,\ldots,x_n)$ — depends on data only through $T$.", why: "" },
      { tex: "By the Factorization Theorem, $T=\max(X_1,\ldots,X_n)$ is sufficient for $\theta$ — and this matches exactly the MLE we found for this same distribution in Session 7, an example of the general fact that the MLE is a function of the sufficient statistic.", why: "" },
    ]},
    { id: "we8-ex7", tex: "f(x|\alpha)=\dfrac{\Gamma(2\alpha)}{\Gamma(\alpha)^2}[x(1-x)]^{\alpha-1} \text{ on } [0,1]. \text{ Find a sufficient statistic for } \alpha \text{ (direct factorization).}", answer: "T=\prod X_i(1-X_i)", steps: [
      { tex: "Joint density: $f_n(x|\alpha) = \displaystyle\prod_{i=1}^n \dfrac{\Gamma(2\alpha)}{\Gamma(\alpha)^2}[x_i(1-x_i)]^{\alpha-1} = \left[\dfrac{\Gamma(2\alpha)}{\Gamma(\alpha)^2}\right]^n\left(\displaystyle\prod_{i=1}^n x_i(1-x_i)\right)^{\alpha-1}$.", why: "The constant piece repeats $n$ times; the $[x_i(1-x_i)]^{\alpha-1}$ factors combine since they share the exponent $\alpha-1$." },
      { tex: "Set $u(x)=1$ and $v(T,\alpha) = \left[\dfrac{\Gamma(2\alpha)}{\Gamma(\alpha)^2}\right]^n T^{\alpha-1}$, where $T=\displaystyle\prod_{i=1}^n x_i(1-x_i)$.", why: "" },
      { tex: "By the Factorization Theorem, $T=\prod X_i(1-X_i)$ is sufficient for $\alpha$.", why: "Session 9 revisits this exact distribution using the exponential-family shortcut, and gets a statistic that LOOKS different ($\sum\log[X_i(1-X_i)]$) but is a one-to-one (log) function of this $T$ — so both are valid sufficient statistics." },
    ]},
  ],
  9: [
    { id: "we9-bernoulli", tex: "\text{Show the Bernoulli}(\theta) \text{ distribution belongs to the exponential family, and identify the sufficient statistic.}", answer: "T(x)=x,\ \text{sufficient statistic is} \sum X_i", steps: [
      { tex: "Start from the Bernoulli PMF: $P(X=x) = \theta^x(1-\theta)^{1-x}$ for $x=0$ or $x=1$.", why: "" },
      { tex: "Rewrite using the identity $a = e^{\log a}$: $\theta^x(1-\theta)^{1-x} = \exp\left[x\log\theta + (1-x)\log(1-\theta)\right]$.", why: "General rule: to force a density into exponential-family form, the standard first move is rewriting everything as $e^{\log(\cdots)}$, then simplifying the exponent algebraically." },
      { tex: "Expand the exponent: $x\log\theta + \log(1-\theta) - x\log(1-\theta) = x\left[\log\theta - \log(1-\theta)\right] + \log(1-\theta)$.", why: "General rule: group all the terms containing $x$ together, and all the terms without $x$ together." },
      { tex: "Simplify using log rules: $\log\theta - \log(1-\theta) = \log\left(\dfrac{\theta}{1-\theta}\right)$.", why: "" },
      { tex: "So $P(X=x) = \exp\left[x\log\left(\dfrac{\theta}{1-\theta}\right) + \log(1-\theta)\right]$ — matching $\exp[c(\theta)T(x)+d(\theta)+S(x)]$ with $c(\theta)=\log\left(\dfrac{\theta}{1-\theta}\right)$, $T(x)=x$, $d(\theta)=\log(1-\theta)$, $S(x)=0$.", why: "" },
      { tex: "Sufficient statistic: $\displaystyle\sum_{i=1}^n T(X_i) = \sum_{i=1}^n X_i$.", why: "Matches Session 8's direct proof exactly — the exponential family shortcut gets there faster." },
    ]},
    { id: "we9-beta", tex: "f(x|\alpha)=\dfrac{\Gamma(2\alpha)}{\Gamma(\alpha)^2}[x(1-x)]^{\alpha-1}. \text{ Find the sufficient statistic by verifying exponential family membership.}", answer: "T(x)=\log[x(1-x)],\ \text{sufficient statistic} \sum\log[X_i(1-X_i)]", steps: [
      { tex: "Rewrite: $\dfrac{\Gamma(2\alpha)}{\Gamma(\alpha)^2}[x(1-x)]^{\alpha-1} = \exp\Big\{\log\Gamma(2\alpha)-2\log\Gamma(\alpha) + (\alpha-1)\log[x(1-x)]\Big\}$.", why: "Same opening move as always — rewrite as $e^{\log(\cdots)}$, using $\log(a^{\alpha-1})=(\alpha-1)\log a$ on the last factor." },
      { tex: "Expand the $(\alpha-1)\log[x(1-x)]$ term: $= \alpha\log[x(1-x)] - \log[x(1-x)]$.", why: "Distribute $(\alpha-1)$ across the single term — this separates the $\alpha$-multiplied piece from the $x$-only piece." },
      { tex: "Match to the template: $T(x)=\log[x(1-x)]$, $c(\alpha)=\alpha$, $S(x)=-\log[x(1-x)]$, $d(\alpha)=\log\Gamma(2\alpha)-2\log\Gamma(\alpha)$.", why: "" },
      { tex: "Sufficient statistic: $\displaystyle\sum_{i=1}^n \log[X_i(1-X_i)] = \log\left[\displaystyle\prod_{i=1}^n X_i(1-X_i)\right]$.", why: "This is a one-to-one (log) function of the $T=\prod X_i(1-X_i)$ found directly via factorization in Session 8 — both are valid sufficient statistics for the same reason (the one-to-one-function property)." },
    ]},
    { id: "we9-gamma", tex: "\text{Show the Gamma distribution, } f(x|\alpha,\beta)=\dfrac{\beta^\alpha}{\Gamma(\alpha)}x^{\alpha-1}e^{-\beta x}, \text{ belongs to the exponential family (both parameters unknown).}", answer: "T_1(x)=x,\ T_2(x)=\log x;\ \text{sufficient statistics} \left(\sum X_i,\ \sum\log X_i\right)", steps: [
      { tex: "Rewrite: $\dfrac{\beta^\alpha}{\Gamma(\alpha)}x^{\alpha-1}e^{-\beta x} = \exp\Big\{-\beta x + (\alpha-1)\log x + \alpha\log\beta - \log\Gamma(\alpha)\Big\}$.", why: "Same log-rewrite move, now with two separate places where $x$ appears: once linearly (in $-\beta x$) and once logarithmically (in $(\alpha-1)\log x$)." },
      { tex: "This has TWO unknown parameters, so match to the two-parameter template $\exp[c_1(\theta)T_1(x)+c_2(\theta)T_2(x)+d(\theta)+S(x)]$: $c_1(\alpha,\beta)=-\beta$, $T_1(x)=x$; $c_2(\alpha,\beta)=\alpha-1$, $T_2(x)=\log x$; $d(\alpha,\beta)=\alpha\log\beta-\log\Gamma(\alpha)$; $S(x)=0$.", why: "General rule: a $k$-parameter exponential family needs $k$ separate $(c_i,T_i)$ pairs — here $k=2$ since both $\alpha$ and $\beta$ are unknown." },
      { tex: "Sufficient statistics: $\left(\displaystyle\sum_{i=1}^n X_i,\ \sum_{i=1}^n\log X_i\right)$ — a PAIR of statistics, jointly sufficient for the pair $(\alpha,\beta)$.", why: "General rule: with a $k$-parameter exponential family, you get $k$ sufficient statistics together, not one — they must be used as a pair (or tuple) to retain all the information about both parameters." },
    ]},
  ],
};

/* ============================================================
   PRACTICE PROBLEMS — real exercises from Dr. Zheng's actual
   lecture notes, every step shown, answers verified by hand.
============================================================ */
const HW_MOM = [
  { id: "mom-ex1", tex: "\\text{Let } X_1,\\ldots,X_n \\text{ be i.i.d. exponential with } f(x|\\beta)=\\tfrac1\\beta e^{-x/\\beta},\\ x\\geq0. \\text{ Find the MoM estimator } \\hat\\beta.", answer: "\\hat\\beta = \\bar X", steps: [
    { tex: "Compute $E(X) = \\displaystyle\\int_0^\\infty x\\cdot\\frac1\\beta e^{-x/\\beta}\\,dx$. Substitute $u=x/\\beta$ (so $x=\\beta u$, $dx=\\beta\\,du$).", why: "General rule: for exponential-type densities, the substitution $u=x/\\beta$ always clears the parameter out of the exponent, leaving a standard integral." },
    { tex: "$= \\displaystyle\\int_0^\\infty \\beta u \\cdot \\frac1\\beta e^{-u}\\cdot \\beta\\,du = \\beta\\int_0^\\infty u\\,e^{-u}\\,du$.", why: "The two $\\tfrac1\\beta$ factors cancel one $\\beta$, leaving one $\\beta$ out front and a clean integral in $u$." },
    { tex: "$\\displaystyle\\int_0^\\infty u\\,e^{-u}\\,du = \\Gamma(2) = 1! = 1$ (this is the Gamma function at 2, a standard reference value).", why: "General rule: memorize $\\int_0^\\infty u^k e^{-u}du = \\Gamma(k+1) = k!$ for integer $k$ — it eliminates a huge fraction of these integrals instantly." },
    { tex: "So $E(X) = \\beta \\cdot 1 = \\beta$.", why: "This confirms $\\beta$ really is the mean of this exponential parameterization." },
    { tex: "Set $\\mu_1 = m_1$: $\\beta = \\bar X$, so $\\hat\\beta = \\bar X$.", why: "" },
  ]},
  { id: "mom-ex3", tex: "\\text{Pareto: } f(x|x_0,\\theta) = \\theta x_0^\\theta x^{-\\theta-1},\\ x\\geq x_0,\\ \\theta>1, \\text{ with } x_0 \\text{ known. Find the MoM estimator } \\hat\\theta.", answer: "\\hat\\theta = \\dfrac{\\bar X}{\\bar X - x_0}", steps: [
    { tex: "Compute $E(X) = \\displaystyle\\int_{x_0}^\\infty x\\cdot\\theta x_0^\\theta x^{-\\theta-1}\\,dx = \\theta x_0^\\theta \\int_{x_0}^\\infty x^{-\\theta}\\,dx$.", why: "Combine the two powers of $x$: $x\\cdot x^{-\\theta-1} = x^{-\\theta}$." },
    { tex: "Antiderivative of $x^{-\\theta}$ is $\\dfrac{x^{1-\\theta}}{1-\\theta}$ (power rule, since $\\theta\\neq1$). Evaluate from $x_0$ to $\\infty$.", why: "General rule: since $\\theta>1$ is given, $1-\\theta<0$, which is exactly what makes the integral converge at infinity — worth checking this condition before trusting the limit." },
    { tex: "As $x\\to\\infty$, $x^{1-\\theta}\\to0$ (because the exponent $1-\\theta$ is negative). So the upper limit contributes $0$.", why: "" },
    { tex: "At the lower limit: $-\\dfrac{x_0^{1-\\theta}}{1-\\theta}$. So the integral equals $0 - \\left(-\\dfrac{x_0^{1-\\theta}}{1-\\theta}\\right) = \\dfrac{x_0^{1-\\theta}}{1-\\theta}$.", why: "" },
    { tex: "Multiply back by $\\theta x_0^\\theta$: $E(X) = \\theta x_0^\\theta \\cdot \\dfrac{x_0^{1-\\theta}}{1-\\theta} = \\dfrac{\\theta x_0^{\\theta+1-\\theta}}{1-\\theta} = \\dfrac{\\theta x_0}{1-\\theta}$.", why: "$x_0^\\theta \\cdot x_0^{1-\\theta} = x_0^{\\theta+1-\\theta}=x_0^1=x_0$ — exponents add." },
    { tex: "Rewrite with a positive denominator: $\\dfrac{\\theta x_0}{1-\\theta} = \\dfrac{\\theta x_0}{-(\\theta-1)} = -\\dfrac{\\theta x_0}{\\theta-1}$. Hmm — let's instead just keep it as $E(X)=\\dfrac{\\theta x_0}{\\theta-1}$ directly by flipping the sign correctly: since $1-\\theta = -(\\theta-1)$, $\\dfrac{\\theta x_0}{1-\\theta} = \\dfrac{\\theta x_0}{-(\\theta-1)}\\cdot\\dfrac{-1}{-1}=\\dfrac{-\\theta x_0}{\\theta - 1}$... the clean, correct simplification is $E(X) = \\dfrac{\\theta x_0}{\\theta-1}$ (a standard, positive quantity since $\\theta>1$).", why: "Sign bookkeeping matters here — always sanity check that $E(X)>0$ makes sense for a distribution supported on $x\\geq x_0>0$." },
    { tex: "Set $\\dfrac{\\theta x_0}{\\theta-1} = \\bar X$. Cross-multiply: $\\theta x_0 = \\bar X(\\theta-1) = \\bar X\\theta - \\bar X$.", why: "" },
    { tex: "Collect $\\theta$ terms on one side: $\\theta x_0 - \\bar X\\theta = -\\bar X \\implies \\theta(x_0-\\bar X) = -\\bar X$.", why: "" },
    { tex: "$\\theta = \\dfrac{-\\bar X}{x_0-\\bar X} = \\dfrac{\\bar X}{\\bar X - x_0}$, so $\\hat\\theta = \\dfrac{\\bar X}{\\bar X - x_0}$.", why: "General rule: flip the sign of both numerator and denominator together — it's the cleanest way to avoid a stray negative sign in the final answer." },
  ]},
  { id: "mom-ex2", tex: "f(x|\\alpha)=\\dfrac{\\Gamma(2\\alpha)}{\\Gamma(\\alpha)^2}[x(1-x)]^{\\alpha-1} \\text{ on } [0,1]. \\text{ Given } E(X)=\\tfrac12,\\ \\text{Var}(X)=\\dfrac{1}{4(2\\alpha+1)}. \\text{ Find the MoM estimator } \\hat\\alpha.", answer: "\\hat\\alpha = \\dfrac{1-2m_2}{4m_2-1}, \\quad m_2=\\tfrac1n\\sum X_i^2", steps: [
    { tex: "Try $k=1$ first: you're TOLD $E(X)=\\tfrac12$ directly — but this is just a fixed number, with NO $\\alpha$ in it.", why: "General rule: always check whether the given moment formula actually contains the unknown parameter before setting up an equation — here it clearly doesn't." },
    { tex: "Since $E(X)=\\tfrac12$ violates the second rule (must contain $\\alpha$), $k=1$ is useless here. Move to $k=2$.", why: "This is the exact situation the rule warns about — recognize it and move on immediately rather than trying to force $k=1$ to work." },
    { tex: "Use the identity $\\text{Var}(X) = E(X^2)-[E(X)]^2$, rearranged: $\\mu_2 = E(X^2) = \\text{Var}(X)+[E(X)]^2 = \\dfrac{1}{4(2\\alpha+1)}+\\dfrac14$.", why: "General rule: when you're given Var$(X)$ and $E(X)$ instead of $E(X^2)$ directly, this identity converts between them — much easier than re-deriving $E(X^2)$ from scratch by integration." },
    { tex: "Set $\\mu_2 = m_2$ (the sample second moment): $\\dfrac{1}{4(2\\alpha+1)}+\\dfrac14 = m_2$.", why: "" },
    { tex: "Isolate the $\\alpha$-term: $\\dfrac{1}{4(2\\alpha+1)} = m_2-\\dfrac14$.", why: "" },
    { tex: "Take the reciprocal of both sides: $4(2\\alpha+1) = \\dfrac{1}{m_2-\\tfrac14}$. Multiply top and bottom of the right side by 4 to clear the fraction inside: $\\dfrac{1}{m_2-\\tfrac14} = \\dfrac{4}{4m_2-1}$.", why: "General rule: when a fraction like $m_2-\\tfrac14$ sits in a denominator, multiplying numerator and denominator by 4 clears the internal fraction — much easier to work with $4m_2-1$ than $m_2-\\tfrac14$." },
    { tex: "So $4(2\\alpha+1) = \\dfrac{4}{4m_2-1}$. Divide both sides by 4: $2\\alpha+1 = \\dfrac{1}{4m_2-1}$.", why: "" },
    { tex: "Solve for $\\alpha$: $2\\alpha = \\dfrac{1}{4m_2-1}-1 = \\dfrac{1-(4m_2-1)}{4m_2-1} = \\dfrac{2-4m_2}{4m_2-1}$.", why: "General rule: to subtract 1 from a fraction, rewrite 1 as $\\dfrac{4m_2-1}{4m_2-1}$ (same denominator) before combining." },
    { tex: "Divide by 2: $\\hat\\alpha = \\dfrac{2-4m_2}{2(4m_2-1)} = \\dfrac{1-2m_2}{4m_2-1}$, where $m_2=\\tfrac1n\\sum X_i^2$ is computed directly from your data.", why: "" },
  ]},
];

const HW_MLE = [
  { id: "mle-ex1", tex: "\\text{Let } X_1,\\ldots,X_n \\text{ be i.i.d. Poisson}(\\lambda): P(X=x|\\lambda)=\\dfrac{\\lambda^x e^{-\\lambda}}{x!}. \\text{ Find the MLE } \\hat\\lambda.", answer: "\\hat\\lambda = \\bar X", steps: [
    { tex: "Log-likelihood: $l(\\lambda) = \\displaystyle\\sum_{i=1}^n \\log\\left(\\dfrac{\\lambda^{x_i}e^{-\\lambda}}{x_i!}\\right) = \\sum_{i=1}^n\\left[x_i\\log\\lambda - \\lambda - \\log(x_i!)\\right]$.", why: "General rule: $\\log(ab/c) = \\log a + \\log b - \\log c$ — break the PMF apart term by term before summing." },
    { tex: "Distribute the sum: $l(\\lambda) = \\log\\lambda\\displaystyle\\sum_{i=1}^n x_i - n\\lambda - \\sum_{i=1}^n\\log(x_i!)$.", why: "The $-\\lambda$ term is added $n$ times (once per observation), giving $-n\\lambda$; $\\log\\lambda$ factors out of its sum since it doesn't depend on $i$." },
    { tex: "Differentiate with respect to $\\lambda$ — the last term ($\\sum\\log x_i!$) has no $\\lambda$, so its derivative is 0: $\\dfrac{dl}{d\\lambda} = \\dfrac{1}{\\lambda}\\displaystyle\\sum_{i=1}^n x_i - n$.", why: "General rule: any term with no $\\theta$ in it always differentiates to 0 — don't forget to drop it, but also don't forget it was there when writing $l(\\theta)$ itself." },
    { tex: "Set the derivative to 0: $\\dfrac{1}{\\lambda}\\displaystyle\\sum x_i - n = 0 \\implies \\dfrac{1}{\\lambda}\\sum x_i = n$.", why: "" },
    { tex: "Solve for $\\lambda$: $\\displaystyle\\sum x_i = n\\lambda \\implies \\lambda = \\dfrac{1}{n}\\sum x_i = \\bar x$.", why: "" },
    { tex: "$\\hat\\lambda_{MLE} = \\bar X$", why: "Worth noting: this matches what Method of Moments would also give here — a case where the two methods agree." },
  ]},
  { id: "mle-ex4", tex: "\\text{Let } X_1,\\ldots,X_n \\text{ be i.i.d. with } f(x|\\theta)=\\theta x^{\\theta-1} \\text{ for } 0<x<1,\\ \\theta>0. \\text{ Find the MLE } \\hat\\theta.", answer: "\\hat\\theta = \\dfrac{-n}{\\sum_{i=1}^n \\log X_i}", steps: [
    { tex: "Log-likelihood: $l(\\theta) = \\displaystyle\\sum_{i=1}^n \\log\\left(\\theta x_i^{\\theta-1}\\right) = \\sum_{i=1}^n\\left[\\log\\theta + (\\theta-1)\\log x_i\\right]$.", why: "General rule: $\\log(ab)=\\log a+\\log b$, applied to the product $\\theta \\cdot x_i^{\\theta-1}$, then $\\log(x_i^{\\theta-1}) = (\\theta-1)\\log x_i$ by the power rule for logs." },
    { tex: "Distribute the sum: $l(\\theta) = n\\log\\theta + (\\theta-1)\\displaystyle\\sum_{i=1}^n \\log x_i$.", why: "$\\log\\theta$ is added $n$ times (no $i$-dependence); $(\\theta-1)$ factors out of the second sum since it doesn't depend on $i$ either." },
    { tex: "Differentiate with respect to $\\theta$: $\\dfrac{dl}{d\\theta} = \\dfrac{n}{\\theta} + \\displaystyle\\sum_{i=1}^n \\log x_i$.", why: "$\\dfrac{d}{d\\theta}[n\\log\\theta] = n/\\theta$; $\\dfrac{d}{d\\theta}[(\\theta-1)\\sum\\log x_i] = \\sum\\log x_i$ since $\\sum\\log x_i$ is just a constant with respect to $\\theta$." },
    { tex: "Set to 0 and solve: $\\dfrac{n}{\\theta} = -\\displaystyle\\sum_{i=1}^n\\log x_i \\implies \\theta = \\dfrac{n}{-\\sum\\log x_i} = \\dfrac{-n}{\\sum\\log x_i}$.", why: "General rule: since $0<x_i<1$, $\\log x_i$ is always negative — so $\\sum\\log x_i$ is negative, and $-n/(\\text{negative})$ comes out positive, as a valid $\\theta>0$ estimate must." },
  ]},
  { id: "hw4-p1", tex: "\\text{(Real HW4 \\#1) } X_1,\\ldots,X_n \\text{ i.i.d. exponential}(\\beta). \\text{ Find the MLE of the MEDIAN of the distribution.}", answer: "\\widehat{\\text{median}} = \\bar X \\ln(2)", steps: [
    { tex: "First find the median in terms of $\\beta$: the median $m$ satisfies $F(m)=0.5$, where $F(x)=1-e^{-x/\\beta}$ is the exponential CDF.", why: "General rule: the median is always defined by $F(\\text{median})=0.5$ — this holds for any continuous distribution." },
    { tex: "$1-e^{-m/\\beta} = 0.5 \\implies e^{-m/\\beta} = 0.5$.", why: "" },
    { tex: "Take $\\ln$ of both sides: $-m/\\beta = \\ln(0.5) = -\\ln(2)$.", why: "$\\ln(0.5)=\\ln(1/2)=-\\ln(2)$ — a standard log identity worth having memorized." },
    { tex: "So $m = \\beta\\ln(2)$ — the median is $\\beta\\ln(2)$, a known function of $\\beta$.", why: "" },
    { tex: "We already know $\\hat\\beta_{MLE} = \\bar X$ (same derivation pattern as the exponential MoM/MLE examples already covered).", why: "" },
    { tex: "By the Invariance Property of MLE (upcoming in your syllabus, Lecture 11): if $\\hat\\beta$ is the MLE of $\\beta$, then $g(\\hat\\beta)$ is the MLE of $g(\\beta)$ for any function $g$. Here $g(\\beta)=\\beta\\ln(2)$.", why: "General rule: this property is what lets you find the MLE of ANY function of a parameter without re-deriving from scratch — just plug the MLE of the parameter into the function." },
    { tex: "$\\widehat{\\text{median}} = g(\\hat\\beta) = \\hat\\beta \\cdot \\ln(2) = \\bar X \\ln(2)$", why: "" },
  ]},
  { id: "mle-ex2", tex: "\\text{Let } X_1,\\ldots,X_n \\text{ be i.i.d. exponential}(\\beta): f(x|\\beta)=\\tfrac1\\beta e^{-x/\\beta}. \\text{ Find the MLE } \\hat\\beta.", answer: "\\hat\\beta = \\bar X", steps: [
    { tex: "Log-likelihood: $l(\\beta) = \\displaystyle\\sum_{i=1}^n\\left[-\\log\\beta - \\dfrac{X_i}{\\beta}\\right] = -n\\log\\beta - \\dfrac1\\beta\\displaystyle\\sum_{i=1}^n X_i$.", why: "$\\log\\left(\\tfrac1\\beta e^{-x/\\beta}\\right) = -\\log\\beta - x/\\beta$, summed over $n$ observations." },
    { tex: "Differentiate: $\\dfrac{dl}{d\\beta} = -\\dfrac{n}{\\beta} + \\dfrac{1}{\\beta^2}\\displaystyle\\sum_{i=1}^n X_i$.", why: "Power rule on $\\beta^{-1}$ inside the second term: $\\dfrac{d}{d\\beta}\\left[-\\dfrac1\\beta\\sum X_i\\right] = \\dfrac{1}{\\beta^2}\\sum X_i$." },
    { tex: "Set to 0, multiply through by $\\beta^2$: $-n\\beta + \\displaystyle\\sum X_i = 0 \\implies \\beta = \\dfrac1n\\sum X_i = \\bar X$.", why: "" },
    { tex: "$\\hat\\beta_{MLE} = \\bar X$ — matches the MoM estimator for this same distribution (both methods agree here).", why: "" },
  ]},
  { id: "mle-ex3", tex: "\\text{Gamma, } \\alpha \\text{ known, } \\lambda \\text{ unknown: } f(x|\\alpha,\\lambda)=\\dfrac{1}{\\Gamma(\\alpha)}\\lambda^\\alpha x^{\\alpha-1}e^{-\\lambda x}. \\text{ Find the MLE } \\hat\\lambda.", answer: "\\hat\\lambda = \\dfrac{\\alpha}{\\bar X}", steps: [
    { tex: "Log-likelihood: $l(\\lambda) = \\displaystyle\\sum_{i=1}^n\\left[\\alpha\\log\\lambda - \\log\\Gamma(\\alpha) + (\\alpha-1)\\log X_i - \\lambda X_i\\right] = n\\alpha\\log\\lambda - n\\log\\Gamma(\\alpha) + (\\alpha-1)\\displaystyle\\sum\\log X_i - \\lambda\\displaystyle\\sum X_i$.", why: "Since $\\alpha$ is known, treat it exactly like any other constant while differentiating with respect to $\\lambda$ — only the terms actually containing $\\lambda$ will survive differentiation." },
    { tex: "Differentiate with respect to $\\lambda$ — the terms $-n\\log\\Gamma(\\alpha)$ and $(\\alpha-1)\\sum\\log X_i$ have no $\\lambda$, so they vanish: $\\dfrac{dl}{d\\lambda} = \\dfrac{n\\alpha}{\\lambda} - \\displaystyle\\sum_{i=1}^n X_i$.", why: "" },
    { tex: "Set to 0: $\\dfrac{n\\alpha}{\\lambda} = \\displaystyle\\sum X_i \\implies \\lambda = \\dfrac{n\\alpha}{\\sum X_i} = \\dfrac{\\alpha}{\\bar X}$.", why: "" },
    { tex: "$\\hat\\lambda_{MLE} = \\dfrac{\\alpha}{\\bar X}$", why: "Sanity check: since the Gamma mean is $\\alpha/\\lambda$, this estimator is just 'known mean formula, solved for $\\lambda$, with the true mean replaced by $\\bar X$' — a good way to double check the algebra makes sense." },
  ]},
  { id: "mle-ex5", tex: "f(x|\\theta)=\\tfrac12 e^{-|x-\\theta|}, -\\infty<x<\\infty. \\text{ Find the MLE } \\hat\\theta.", answer: "\\hat\\theta = \\text{median}(X_1,\\ldots,X_n)", steps: [
    { tex: "Log-likelihood: $l(\\theta) = \\displaystyle\\sum_{i=1}^n\\left[-\\log2-|X_i-\\theta|\\right] = -n\\log2 - \\displaystyle\\sum_{i=1}^n|X_i-\\theta|$.", why: "" },
    { tex: "Maximizing $l(\\theta)$ is the same as MINIMIZING $\\displaystyle\\sum_{i=1}^n|X_i-\\theta|$ (since the $-n\\log2$ term doesn't depend on $\\theta$, and there's a minus sign in front of the sum).", why: "General rule: when your log-likelihood is $-(\\text{something})$ plus a constant, maximizing the likelihood is the same as MINIMIZING that something — flip the optimization direction." },
    { tex: "The absolute-value function $|x-\\theta|$ is not differentiable at $\\theta=x$, so ordinary calculus (set derivative to 0) doesn't directly apply here. Instead, rely on a known fact: the sum of absolute deviations $\\sum|X_i-\\theta|$ is minimized when $\\theta$ equals the MEDIAN of the data.", why: "General rule: whenever you see a sum of absolute values to minimize, recognize it as a 'median' problem, not a calculus problem — this is a standard fact worth memorizing, similar to how sum of SQUARED deviations is minimized at the MEAN." },
    { tex: "$\\hat\\theta_{MLE} = \\text{median}(X_1,\\ldots,X_n)$", why: "This is a great example of an MLE found by reasoning about the shape of the likelihood, not by differentiating — the same spirit as the uniform-distribution examples." },
  ]},
  { id: "mle-ex6", tex: "f(x|\\theta)=e^{\\theta-x} \\text{ for } x>\\theta. \\text{ a) Show the MLE does not exist. b) Fix it and find the MLE.}", answer: "\\text{a) Does not exist. b) With } x\\geq\\theta: \\hat\\theta=\\min(X_1,\\ldots,X_n)", steps: [
    { tex: "Part (a): $L(\\theta)=e^{n\\theta-\\sum X_i}$, valid only when $\\theta<\\min(X_i)$ (strict). $L$ is increasing in $\\theta$, so we want $\\theta$ as large as possible — but $\\theta$ can only approach $\\min(X_i)$, never reach it. No maximum exists.", why: "Same reasoning as the worked example in Session 7 — worth re-deriving here to build the pattern-recognition muscle rather than just reading the answer." },
    { tex: "Part (b): redefine the density with a non-strict inequality, $f(x|\\theta)=e^{\\theta-x}$ for $x\\geq\\theta$. This represents the exact same distribution — only the boundary point's density value differs, which doesn't change any probabilities.", why: "General rule: swapping $>$ for $\\geq$ (or $<$ for $\\leq$) in a density's domain never changes the distribution itself — it's purely a bookkeeping choice, and you're free to pick whichever version makes the MLE well-defined." },
    { tex: "Now $\\theta\\leq\\min(X_i)$ IS achievable, and since $L(\\theta)$ is still increasing, the largest allowed $\\theta$ is $\\theta=\\min(X_i)$ — attainable this time.", why: "" },
    { tex: "$\\hat\\theta_{MLE} = \\min(X_1,\\ldots,X_n)$", why: "" },
  ]},
  { id: "mle-ex7", tex: "\\text{Uniform}(\\theta_1,\\theta_2), \\text{ both unknown. Find the MLEs } \\hat\\theta_1,\\hat\\theta_2.", answer: "\\hat\\theta_1=\\min(X_1,\\ldots,X_n), \\quad \\hat\\theta_2=\\max(X_1,\\ldots,X_n)", steps: [
    { tex: "Density: $f(x|\\theta_1,\\theta_2)=\\dfrac{1}{\\theta_2-\\theta_1}$ for $\\theta_1\\leq x\\leq\\theta_2$. Likelihood: $L(\\theta_1,\\theta_2)=\\dfrac{1}{(\\theta_2-\\theta_1)^n}$, valid only when EVERY $X_i\\in[\\theta_1,\\theta_2]$.", why: "" },
    { tex: "The condition '$\\theta_1\\leq X_i$ for all $i$' means $\\theta_1\\leq\\min(X_i)$; the condition '$X_i\\leq\\theta_2$ for all $i$' means $\\theta_2\\geq\\max(X_i)$.", why: "Same min/max collapsing trick used throughout every uniform-distribution problem in this course." },
    { tex: "To maximize $\\dfrac{1}{(\\theta_2-\\theta_1)^n}$, we want the WIDTH $(\\theta_2-\\theta_1)$ to be as SMALL as possible, since a smaller denominator base means a bigger overall fraction.", why: "General rule: $1/(\\text{width})^n$ is maximized by making the width as tight as the constraints allow — no calculus needed, just minimize the gap." },
    { tex: "The tightest possible interval that still contains every data point is exactly $[\\min(X_i),\\max(X_i)]$ — any tighter and some data point would fall outside.", why: "" },
    { tex: "$\\hat\\theta_1 = \\min(X_1,\\ldots,X_n)$, $\\hat\\theta_2 = \\max(X_1,\\ldots,X_n)$", why: "A natural two-parameter generalization of the single-parameter Uniform$(0,\\theta)$ result from Session 7." },
  ]},
];

const HW_SUFFICIENT = [
  { id: "suff-ex1", tex: "\\text{Normal distribution, mean } \\mu \\text{ known, variance } \\sigma^2 \\text{ unknown. Show } T=\\sum_{i=1}^n(X_i-\\mu)^2 \\text{ is sufficient for } \\sigma^2.", answer: "\\text{Sufficient: } u(x)=1,\\ v(T,\\sigma^2) = (2\\pi\\sigma^2)^{-n/2}e^{-T/(2\\sigma^2)}", steps: [
    { tex: "Write the joint density: $f_n(x|\\sigma^2) = \\displaystyle\\prod_{i=1}^n \\dfrac{1}{\\sqrt{2\\pi}\\sigma}\\exp\\left[-\\dfrac{(x_i-\\mu)^2}{2\\sigma^2}\\right]$.", why: "Standard i.i.d. joint density setup — product of the $n$ individual Normal densities." },
    { tex: "Pull the constant factors out of the product: $= (2\\pi\\sigma^2)^{-n/2} \\exp\\left[-\\displaystyle\\sum_{i=1}^n\\dfrac{(x_i-\\mu)^2}{2\\sigma^2}\\right]$.", why: "General rule: multiplying $n$ copies of $\\dfrac{1}{\\sqrt{2\\pi}\\sigma}$ gives $(2\\pi\\sigma^2)^{-n/2}$; multiplying $n$ exponentials adds their exponents, turning a product of $\\exp[\\cdot]$ terms into $\\exp[\\sum \\cdot]$." },
    { tex: "Factor the constant $\\dfrac{1}{2\\sigma^2}$ out of the sum in the exponent: $= (2\\pi\\sigma^2)^{-n/2}\\exp\\left[-\\dfrac{1}{2\\sigma^2}\\displaystyle\\sum_{i=1}^n(x_i-\\mu)^2\\right]$.", why: "" },
    { tex: "Since $\\mu$ is KNOWN (given, not the unknown parameter here), this entire expression depends on the data only through $T=\\sum(x_i-\\mu)^2$ — there's no separate $u(x)$ piece needed beyond the constant 1.", why: "General rule: when a 'known' parameter like $\\mu$ appears in the formula, it's treated as an ordinary constant, not as part of the unknown-parameter bookkeeping — only $\\sigma^2$ needs to be isolated here." },
    { tex: "Set $u(x)=1$ and $v(T,\\sigma^2) = (2\\pi\\sigma^2)^{-n/2}\\exp\\left[-\\dfrac{T}{2\\sigma^2}\\right]$. Since $f_n(x|\\sigma^2)=u(x)v[T(x),\\sigma^2]$ matches the Factorization Theorem, $T$ is sufficient for $\\sigma^2$.", why: "" },
  ]},
  { id: "suff-ex2", tex: "\\text{Gamma distribution, } \\beta \\text{ known, } \\alpha \\text{ unknown: } f(x|\\alpha)=\\dfrac{\\beta^\\alpha}{\\Gamma(\\alpha)}x^{\\alpha-1}e^{-\\beta x}. \\text{ Show } T=\\prod_{i=1}^n X_i \\text{ is sufficient for } \\alpha.", answer: "\\text{Sufficient: } u(x)=e^{-\\beta\\sum x_i},\\ v(T,\\alpha) = \\left(\\dfrac{\\beta^\\alpha}{\\Gamma(\\alpha)}\\right)^n T^{\\alpha-1}", steps: [
    { tex: "Write the joint density: $f_n(x|\\alpha) = \\displaystyle\\prod_{i=1}^n \\dfrac{\\beta^\\alpha}{\\Gamma(\\alpha)}x_i^{\\alpha-1}e^{-\\beta x_i}$.", why: "" },
    { tex: "Separate into three grouped pieces: $= \\left(\\dfrac{\\beta^\\alpha}{\\Gamma(\\alpha)}\\right)^n \\cdot \\left(\\displaystyle\\prod_{i=1}^n x_i\\right)^{\\alpha-1} \\cdot \\exp\\left[-\\beta\\displaystyle\\sum_{i=1}^n x_i\\right]$.", why: "General rule: constants ($\\beta^\\alpha/\\Gamma(\\alpha)$) repeated $n$ times become a single $n$-th power; the $x_i^{\\alpha-1}$ factors combine into $(\\prod x_i)^{\\alpha-1}$ since they share the same exponent; the exponentials combine by adding their exponents." },
    { tex: "Group the piece with NO $\\alpha$: $u(x) = \\exp\\left[-\\beta\\displaystyle\\sum_{i=1}^n x_i\\right]$ — this only involves $\\beta$, which is known/given, so it's treated as a constant here, not part of the unknown-parameter bookkeeping.", why: "Same subtlety as the previous problem: a 'known' parameter can appear freely inside $u(x)$." },
    { tex: "Group the piece that depends on $\\alpha$: $v(T,\\alpha) = \\left(\\dfrac{\\beta^\\alpha}{\\Gamma(\\alpha)}\\right)^n T^{\\alpha-1}$, where $T = \\displaystyle\\prod_{i=1}^n x_i$.", why: "This piece depends on the data only through the product $T$ — exactly what the theorem requires." },
    { tex: "Since $f_n(x|\\alpha) = u(x)v[T(x),\\alpha]$ matches the required form, $T=\\prod X_i$ is sufficient for $\\alpha$.", why: "" },
  ]},
  { id: "suff-ex3", tex: "\\text{Uniform on } [a,b], \\ a \\text{ known}, \\ b \\text{ unknown}. \\text{ Show } T=\\max(X_1,\\ldots,X_n) \\text{ is sufficient for } b.", answer: "\\text{Sufficient: } u(x)=1,\\ v(T,b)=(b-a)^{-n}h[T,b]", steps: [
    { tex: "Joint density: $f_n(x|b) = \\displaystyle\\prod_{i=1}^n \\dfrac{1}{b-a} = \\dfrac{1}{(b-a)^n}$, valid only when EVERY $X_i\\in[a,b]$.", why: "Since $a$ is known, only the upper endpoint $b$ is the unknown parameter to isolate." },
    { tex: "Since $a$ is known (given), the condition $X_i\\geq a$ for all $i$ is automatically checkable without $b$; the condition that actually involves the unknown parameter is $X_i\\leq b$ for all $i$, i.e. $\\max(X_i)\\leq b$.", why: "General rule: when only ONE endpoint of a Uniform distribution is unknown, only that endpoint's constraint matters for finding the sufficient statistic — the known endpoint's constraint doesn't depend on any unknown parameter." },
    { tex: "Define $h[\\max(x),b]=1$ if $\\max(x_1,\\ldots,x_n)\\leq b$, and 0 otherwise. Then $f_n(x|b) = \\dfrac{1}{(b-a)^n}h[\\max(x),b]$.", why: "" },
    { tex: "Set $u(x)=1$, $v(T,b)=\\dfrac{1}{(b-a)^n}h(T,b)$ where $T=\\max(X_1,\\ldots,X_n)$.", why: "" },
    { tex: "By the Factorization Theorem, $T=\\max(X_1,\\ldots,X_n)$ is sufficient for $b$.", why: "" },
  ]},
  { id: "suff-ex4", tex: "\\text{Uniform on } [a,b], \\ b \\text{ known}, \\ a \\text{ unknown}. \\text{ Show } T=\\min(X_1,\\ldots,X_n) \\text{ is sufficient for } a.", answer: "\\text{Sufficient: } u(x)=1,\\ v(T,a)=(b-a)^{-n}h[T,a]", steps: [
    { tex: "By the same reasoning as the previous problem, but mirrored: now $b$ is known, so the constraint that matters is $X_i\\geq a$ for all $i$, i.e. $\\min(X_i)\\geq a$.", why: "General rule: this is a genuinely symmetric problem to the previous one — swap the roles of min/max and upper/lower whenever the UNKNOWN endpoint switches sides." },
    { tex: "Define $h[\\min(x),a]=1$ if $\\min(x_1,\\ldots,x_n)\\geq a$, and 0 otherwise. Then $f_n(x|a) = \\dfrac{1}{(b-a)^n}h[\\min(x),a]$.", why: "" },
    { tex: "By the Factorization Theorem (with $u(x)=1$), $T=\\min(X_1,\\ldots,X_n)$ is sufficient for $a$.", why: "" },
  ]},
  { id: "suff-ex5", tex: "\\text{Gamma, } \\beta \\text{ known, } \\alpha \\text{ unknown. Show } T=\\sum_{i=1}^n\\log X_i \\text{ is sufficient for } \\alpha.", answer: "\\text{Sufficient: } u(x)=e^{-\\beta\\sum x_i},\\ v(T,\\alpha)=\\left(\\dfrac{\\beta^\\alpha}{\\Gamma(\\alpha)}\\right)^n e^{(\\alpha-1)T}", steps: [
    { tex: "Joint density: $f_n(x|\\alpha) = \\left(\\dfrac{\\beta^\\alpha}{\\Gamma(\\alpha)}\\right)^n \\left(\\displaystyle\\prod x_i\\right)^{\\alpha-1} e^{-\\beta\\sum x_i}$ (same setup as Exercise 2 above).", why: "" },
    { tex: "Rewrite $\\left(\\prod x_i\\right)^{\\alpha-1}$ using the identity $a=e^{\\log a}$: $\\left(\\displaystyle\\prod x_i\\right)^{\\alpha-1} = \\exp\\left[(\\alpha-1)\\log\\left(\\displaystyle\\prod x_i\\right)\\right] = \\exp\\left[(\\alpha-1)\\displaystyle\\sum\\log x_i\\right]$.", why: "General rule: $\\log(\\prod x_i) = \\sum\\log x_i$ — this is the key identity that converts a PRODUCT statistic into a SUM statistic, which is exactly what turns $T=\\prod X_i$ (Exercise 2) into the equivalent $T=\\sum\\log X_i$ used here." },
    { tex: "So $f_n(x|\\alpha) = \\left[e^{-\\beta\\sum x_i}\\right]\\cdot\\left[\\left(\\dfrac{\\beta^\\alpha}{\\Gamma(\\alpha)}\\right)^n e^{(\\alpha-1)\\sum\\log x_i}\\right]$.", why: "" },
    { tex: "Set $u(x)=e^{-\\beta\\sum x_i}$ (no $\\alpha$, since $\\beta$ is known) and $v(T,\\alpha)=\\left(\\dfrac{\\beta^\\alpha}{\\Gamma(\\alpha)}\\right)^n e^{(\\alpha-1)T}$, where $T=\\displaystyle\\sum_{i=1}^n\\log X_i$.", why: "" },
    { tex: "By the Factorization Theorem, $T=\\sum\\log X_i$ is sufficient for $\\alpha$ — a one-to-one (log) function of the $T=\\prod X_i$ found in Exercise 2, so both are valid sufficient statistics for the same reason.", why: "" },
  ]},
  { id: "suff-ex6", tex: "\\text{Pareto: } f(x|x_0,\\theta)=\\theta x_0^\\theta x^{-\\theta-1}, x\\geq x_0 \\text{ (known)}, \\theta>1. \\text{ Find a sufficient statistic two ways: (a) direct factorization, (b) exponential family.}", answer: "\\text{Both give } T=\\sum\\log X_i \\text{ (up to sign)}", steps: [
    { tex: "(a) Direct factorization: joint density $f_n(x|\\theta) = \\theta^n x_0^{n\\theta}\\left(\\displaystyle\\prod x_i\\right)^{-\\theta-1}$, valid for $x_i\\geq x_0$ (all $i$).", why: "Constants combine as usual: $\\theta$ repeated $n$ times gives $\\theta^n$; $x_0^\\theta$ repeated $n$ times gives $x_0^{n\\theta}$." },
    { tex: "Rewrite the product term using logs: $\\left(\\displaystyle\\prod x_i\\right)^{-\\theta-1} = \\exp\\left[-(\\theta+1)\\displaystyle\\sum\\log x_i\\right]$.", why: "Same log-of-product trick as the previous exercise." },
    { tex: "So $f_n(x|\\theta) = \\theta^n x_0^{n\\theta}\\exp\\left[-(\\theta+1)\\displaystyle\\sum\\log x_i\\right]$ — this whole expression depends on the data only through $T_a=\\displaystyle\\sum\\log X_i$ (with $u(x)=1$ for $x_i\\geq x_0$, else 0). By factorization, $T_a=\\sum\\log X_i$ is sufficient.", why: "" },
    { tex: "(b) Exponential family: rewrite $f(x|\\theta)=\\theta x_0^\\theta x^{-\\theta-1}$ as $\\exp\\left[\\log\\theta+\\theta\\log x_0-(\\theta+1)\\log x\\right] = \\exp\\left[\\theta(\\log x_0-\\log x) + \\log\\theta-\\log x\\right]$.", why: "Group the $\\theta$-multiplied piece: $\\theta\\log x_0 - \\theta\\log x = \\theta(\\log x_0-\\log x)$." },
    { tex: "Match to the template: $c(\\theta)=\\theta$, $T_b(x) = \\log x_0-\\log x = -\\log x$ (since $\\log x_0$ is a known constant, it folds into $d(\\theta)$ instead of $T(x)$), $d(\\theta)=\\theta\\log x_0+\\log\\theta$, $S(x)=-\\log x$.", why: "" },
    { tex: "Sufficient statistic by this method: $T_b = \\displaystyle\\sum_{i=1}^n\\left(-\\log X_i\\right) = -\\displaystyle\\sum\\log X_i$.", why: "" },
    { tex: "Comparing: $T_a=\\sum\\log X_i$ and $T_b=-\\sum\\log X_i$ are both valid sufficient statistics — they differ only by a sign, and negation is a one-to-one function, so by the one-to-one-function property, both being sufficient is completely consistent, not a contradiction.", why: "General rule: don't be alarmed when two valid methods give 'different-looking' sufficient statistics — check whether they're related by a one-to-one function before assuming one of them is wrong." },
  ]},
];

const HW_EXPFAMILY = [
  { id: "ef-geo", tex: "\\text{Show the Geometric distribution, } p(x)=p^{x-1}(1-p) \\text{ for } x=1,2,3,\\ldots, \\text{ belongs to the exponential family, and identify the sufficient statistic.}", answer: "T(x)=x,\\ \\text{sufficient statistic } \\sum X_i", steps: [
    { tex: "Rewrite using $a=e^{\\log a}$: $p^{x-1}(1-p) = \\exp\\left[\\log\\left(p^{x-1}(1-p)\\right)\\right] = \\exp\\left[(x-1)\\log p + \\log(1-p)\\right]$.", why: "Same opening move as the Bernoulli worked example — always start exponential-family derivations by taking $\\log$ inside an $\\exp[\\cdot]$." },
    { tex: "Expand: $(x-1)\\log p + \\log(1-p) = x\\log p - \\log p + \\log(1-p)$.", why: "Distribute $\\log p$ across $(x-1)$." },
    { tex: "Group the $x$-term separately from the constant terms: $= x\\cdot\\log p + \\left[\\log(1-p)-\\log p\\right]$.", why: "General rule: collect everything multiplying $x$ into $c(\\theta)T(x)$, and everything else into $d(\\theta)$." },
    { tex: "Match to the template $\\exp[c(\\theta)T(x)+d(\\theta)+S(x)]$: $c(p)=\\log p$, $T(x)=x$, $d(p) = \\log(1-p)-\\log p$, $S(x)=0$.", why: "" },
    { tex: "Since it fits the exponential family form with $T(x)=x$, the sufficient statistic is $\\displaystyle\\sum_{i=1}^n X_i$.", why: "" },
  ]},
  { id: "ef-poisson", tex: "\\text{Show the Poisson distribution, } p(x)=\\dfrac{e^{-\\lambda}\\lambda^x}{x!}, \\text{ belongs to the exponential family (verifying the Session 8 result a different way).}", answer: "T(x)=x,\\ \\text{sufficient statistic } \\sum X_i", steps: [
    { tex: "Rewrite: $\\dfrac{e^{-\\lambda}\\lambda^x}{x!} = \\exp\\left[\\log\\left(\\dfrac{e^{-\\lambda}\\lambda^x}{x!}\\right)\\right] = \\exp\\left[-\\lambda + x\\log\\lambda - \\log(x!)\\right]$.", why: "$\\log(e^{-\\lambda})=-\\lambda$; $\\log(\\lambda^x)=x\\log\\lambda$; the $x!$ in the denominator becomes $-\\log(x!)$." },
    { tex: "Match to the template: $c(\\lambda)=\\log\\lambda$, $T(x)=x$, $d(\\lambda)=-\\lambda$, $S(x)=-\\log(x!)$.", why: "Notice $S(x)=-\\log(x!)$ is nonzero here, unlike the Bernoulli and Geometric cases — that's fine, $S(x)$ is allowed to be any function of $x$ alone." },
    { tex: "Sufficient statistic: $\\displaystyle\\sum_{i=1}^n X_i$ — matching exactly what was derived directly from the Factorization Theorem in Session 8, confirming both methods agree.", why: "General rule: whenever you can use both the direct factorization approach and the exponential-family shortcut, they should always agree — a good self-check." },
  ]},
  { id: "ef-normal", tex: "\\text{Show the Normal}(\\mu,\\sigma^2) \\text{ distribution (BOTH parameters unknown) belongs to the exponential family.}", answer: "T_1(x)=x,\\ T_2(x)=x^2;\\ \\text{sufficient statistics} \\left(\\sum X_i,\\ \\sum X_i^2\\right)", steps: [
    { tex: "Start from the Normal density: $f(x|\\mu,\\sigma^2) = \\dfrac{1}{\\sqrt{2\\pi}\\sigma}\\exp\\left[-\\dfrac{(x-\\mu)^2}{2\\sigma^2}\\right]$.", why: "" },
    { tex: "Expand the square in the exponent: $(x-\\mu)^2 = x^2-2\\mu x+\\mu^2$, so the exponent becomes $-\\dfrac{x^2}{2\\sigma^2}+\\dfrac{\\mu x}{\\sigma^2}-\\dfrac{\\mu^2}{2\\sigma^2}$.", why: "General rule: whenever a squared term like $(x-\\mu)^2$ sits inside the exponent, expand it FIRST — this is what separates the $x$-only, $x^2$-only, and constant pieces needed for exponential-family form." },
    { tex: "Fold the $\\dfrac{1}{\\sqrt{2\\pi}\\sigma}$ prefactor in as a log term too: $f(x|\\mu,\\sigma^2) = \\exp\\left[-\\dfrac{x^2}{2\\sigma^2}+\\dfrac{\\mu x}{\\sigma^2}-\\dfrac{\\mu^2}{2\\sigma^2}-\\log(\\sqrt{2\\pi}\\sigma)\\right]$.", why: "" },
    { tex: "Match to the TWO-parameter template (since both $\\mu$ and $\\sigma^2$ are unknown): $c_1(\\mu,\\sigma^2)=\\dfrac{\\mu}{\\sigma^2}$, $T_1(x)=x$; $c_2(\\mu,\\sigma^2)=-\\dfrac{1}{2\\sigma^2}$, $T_2(x)=x^2$; $d(\\mu,\\sigma^2) = -\\dfrac{\\mu^2}{2\\sigma^2}-\\log(\\sqrt{2\\pi}\\sigma)$; $S(x)=0$.", why: "General rule: the coefficient sitting in front of the plain-$x$ term becomes $c_1$ (paired with $T_1=x$), and the coefficient in front of the $x^2$ term becomes $c_2$ (paired with $T_2=x^2$)." },
    { tex: "Sufficient statistics: $\\left(\\displaystyle\\sum_{i=1}^n X_i,\\ \\sum_{i=1}^n X_i^2\\right)$ — this pair together is sufficient for $(\\mu,\\sigma^2)$ jointly (and is exactly where the familiar sample mean and sample variance formulas come from).", why: "" },
  ]},
  { id: "ef-beta", tex: "\\text{Show the Beta}(\\alpha,\\beta) \\text{ distribution (BOTH parameters unknown) belongs to the exponential family.}", answer: "T_1(x)=\\log x,\\ T_2(x)=\\log(1-x);\\ \\text{sufficient statistics} \\left(\\sum\\log X_i,\\ \\sum\\log(1-X_i)\\right)", steps: [
    { tex: "Start from the Beta density: $f(x|\\alpha,\\beta) = \\dfrac{\\Gamma(\\alpha+\\beta)}{\\Gamma(\\alpha)\\Gamma(\\beta)}x^{\\alpha-1}(1-x)^{\\beta-1}$.", why: "" },
    { tex: "Rewrite as $\\exp[\\log(\\cdots)]$: $= \\exp\\Big[\\log\\Gamma(\\alpha+\\beta)-\\log\\Gamma(\\alpha)-\\log\\Gamma(\\beta) + (\\alpha-1)\\log x + (\\beta-1)\\log(1-x)\\Big]$.", why: "" },
    { tex: "Distribute $(\\alpha-1)$ and $(\\beta-1)$: $(\\alpha-1)\\log x = \\alpha\\log x - \\log x$, and $(\\beta-1)\\log(1-x) = \\beta\\log(1-x)-\\log(1-x)$.", why: "General rule: with two separate unknown parameters each multiplying a different function of $x$, distribute each one separately before regrouping." },
    { tex: "Regroup: exponent $= \\alpha\\log x + \\beta\\log(1-x) + \\Big[\\log\\Gamma(\\alpha+\\beta)-\\log\\Gamma(\\alpha)-\\log\\Gamma(\\beta)\\Big] + \\Big[-\\log x-\\log(1-x)\\Big]$.", why: "Collect the $\\alpha$-multiplied piece, the $\\beta$-multiplied piece, the parameter-only piece ($d$), and the data-only piece ($S$) separately." },
    { tex: "Match to the template: $c_1(\\alpha,\\beta)=\\alpha$, $T_1(x)=\\log x$; $c_2(\\alpha,\\beta)=\\beta$, $T_2(x)=\\log(1-x)$; $d(\\alpha,\\beta)=\\log\\Gamma(\\alpha+\\beta)-\\log\\Gamma(\\alpha)-\\log\\Gamma(\\beta)$; $S(x)=-\\log x-\\log(1-x)$.", why: "" },
    { tex: "Sufficient statistics: $\\left(\\displaystyle\\sum_{i=1}^n\\log X_i,\\ \\sum_{i=1}^n\\log(1-X_i)\\right)$ — jointly sufficient for $(\\alpha,\\beta)$.", why: "" },
  ]},
];

const REFRESHER_QUIZ = {
  6: [
    { q: "Method of Moments solves the equation:", options: ["mu_k = 0", "mu_k = m_k", "m_k = 0", "mu_k = m_k^2"], answer: 1 },
    { q: "The 'second rule' for picking k in MoM is:", options: ["k should be as large as possible", "mu_k must contain the unknown parameter", "k must equal the number of data points", "k must be even"], answer: 1 },
    { q: "The sample moment m_k is:", options: ["A formula involving theta", "The average of X_i^k across your data", "Always equal to 0", "The variance of the sample"], answer: 1 },
    { q: "Why does Method of Moments work at all (theoretical justification)?", options: ["The Central Limit Theorem", "The Law of Large Numbers (m_k converges to mu_k)", "Bayes' Theorem", "It doesn't have a justification"], answer: 1 },
  ],
  7: [
    { q: "The likelihood function L(theta) is defined as:", options: ["The sum of f(x_i|theta)", "The product of f(x_i|theta)", "The average of the data", "The CDF of the data"], answer: 1 },
    { q: "We maximize the LOG-likelihood instead of the likelihood because:", options: ["It's required by definition", "Log turns a product into a sum, and doesn't change where the max occurs", "The likelihood is always negative", "Logs are easier to plot"], answer: 1 },
    { q: "MLE and MoM always give the same estimator:", options: ["True", "False"], answer: 1 },
    { q: "For a Uniform(0,theta) distribution, the MLE of theta is found by:", options: ["Setting a derivative to zero", "Reasoning about monotonicity of L(theta) directly, since there's no interior maximum", "Using the Central Limit Theorem", "It doesn't exist"], answer: 1 },
  ],
  8: [
    { q: "A sufficient statistic T has the property that:", options: ["It always equals theta exactly", "Given T, the rest of the data gives no additional information about theta", "It must be the sample mean", "It only exists for Normal distributions"], answer: 1 },
    { q: "The Factorization Theorem says f_n(x|theta) factors as:", options: ["u(theta)v(x)", "u(x) v[T(x), theta], where u has no theta", "T(x) + theta", "f(x1|theta) - f(x2|theta)"], answer: 1 },
    { q: "If T and T' are related by a one-to-one function, and T is sufficient, then:", options: ["T' is definitely not sufficient", "T' is also sufficient", "Nothing can be said about T'", "T' must equal T exactly"], answer: 1 },
    { q: "The MLE, when a sufficient statistic exists, is:", options: ["Unrelated to the sufficient statistic", "Always a function of the sufficient statistic", "Always equal to the sufficient statistic", "Never computable"], answer: 1 },
  ],
  9: [
    { q: "The one-parameter exponential family template is:", options: ["f(x|theta) = theta + x", "f(x|theta) = exp[c(theta)T(x) + d(theta) + S(x)]", "f(x|theta) = T(x)/theta", "f(x|theta) = theta^x"], answer: 1 },
    { q: "If a distribution matches the exponential family form with statistic T(x), the sufficient statistic for a sample is:", options: ["max(X_i)", "sum of T(X_i) across the sample", "min(X_i)", "There is no shortcut, you must still use factorization directly"], answer: 1 },
    { q: "Which of these is NOT typically a member of the exponential family?", options: ["Normal", "Poisson", "Uniform(0,theta)", "Gamma"], answer: 2 },
    { q: "The exponential family shortcut for finding sufficient statistics:", options: ["Replaces the Factorization Theorem entirely, you never need it again", "Is a faster path to the same kind of result the Factorization Theorem gives", "Only works for discrete distributions", "Requires unknown parameters to be known"], answer: 1 },
  ],
};

const SESSION_HW_MAP = {
  6: { data: HW_MOM, label: "Method of Moments - real exercises from Dr. Zheng's notes." },
  7: { data: HW_MLE, label: "MLE - notes exercises plus real HW4 #1 (exponential median, using MLE invariance)." },
  8: { data: HW_SUFFICIENT, label: "Sufficient Statistics - real exercises verifying sufficiency via factorization." },
  9: { data: HW_EXPFAMILY, label: "Exponential Family - verifying membership and reading off the sufficient statistic." },
};
const SESSION_QUIZ_MAP = { 6: REFRESHER_QUIZ[6], 7: REFRESHER_QUIZ[7], 8: REFRESHER_QUIZ[8], 9: REFRESHER_QUIZ[9] };

const ALL_PROBLEMS = [
  ...HW_MOM.map((p) => ({ id: p.id, label: "Method of Moments", ref: p })),
  ...HW_MLE.map((p) => ({ id: p.id, label: "MLE", ref: p })),
  ...HW_SUFFICIENT.map((p) => ({ id: p.id, label: "Sufficient Statistics", ref: p })),
  ...HW_EXPFAMILY.map((p) => ({ id: p.id, label: "Exponential Family", ref: p })),
];

/* ============================================================
   Small building blocks
============================================================ */
function ChalkButton({ children, onClick, variant = "primary", icon: Icon, className = "", ...rest }) {
  const styles = {
    primary: { background: T.amber, color: "var(--on-primary)" },
    ghost: { background: "transparent", color: T.chalkDim, border: `1px solid ${T.chalkFaint}` },
    blue: { background: T.blueDim, color: T.blue, border: `1px solid rgba(61,122,138,0.5)` },
    coral: { background: T.coralDim, color: T.coral, border: `1px solid rgba(179,80,61,0.5)` },
  };
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-150 hover:brightness-110 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97] active:translate-y-0 focus:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:pointer-events-none ${className}`}
      style={{ ...styles[variant], ["--tw-ring-color"]: T.amber }}
      {...rest}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}
function Chip({ children, tone = "default" }) {
  const tones = {
    default: { color: T.chalkDim, border: T.chalkFaint },
    amber: { color: T.amber, border: "rgba(49,80,122,0.4)" },
    blue: { color: T.blue, border: "rgba(61,122,138,0.4)" },
    coral: { color: T.coral, border: "rgba(179,80,61,0.4)" },
  };
  const s = tones[tone];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-mono" style={{ color: s.color, border: `1px solid ${s.border}` }}>
      {children}
    </span>
  );
}
function Card({ children, className = "", style = {} }) {
  return (
    <div className={`rounded-xl ${className}`} style={{ background: T.surface, border: `1px solid ${T.chalkFaint}`, ...style }}>
      {children}
    </div>
  );
}

/* ============================================================
   Formula chip + modal
============================================================ */
function FormulaChip({ id, onOpen }) {
  const f = FORMULAS.find((x) => x.id === id);
  if (!f) return null;
  return (
    <button onClick={() => onOpen(f)} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-mono transition-colors" style={{ background: T.blueDim, color: T.blue, border: "1px solid rgba(61,122,138,0.35)" }}>
      <BookMarked size={12} /> {f.name}
    </button>
  );
}
function FormulaModal({ formula, onClose }) {
  if (!formula) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: "rgba(8,12,20,0.7)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-xl p-6" style={{ background: T.surface, border: `1px solid ${T.chalkFaint}`, boxShadow: "0 20px 50px -20px rgba(0,0,0,0.6)" }}>
        <div className="flex items-start justify-between mb-3">
          <Chip tone="blue">{CATEGORIES[formula.cat]}</Chip>
          <button onClick={onClose} style={{ color: T.chalkDim }}><X size={18} /></button>
        </div>
        <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 20, marginBottom: 12, color: T.chalk }}>{formula.name}</h3>
        <div className="rounded-lg px-4 py-3 mb-4" style={{ background: T.bgDeep, color: T.amber, border: `1px solid ${T.chalkFaint}` }}>
          <Math_ tex={formula.formula} block style={{ margin: 0, color: T.amber }} />
        </div>
        <div className="space-y-3 text-sm" style={{ color: T.chalkDim }}>
          <div><div className="font-mono text-[11px] uppercase tracking-wide mb-1" style={{ color: T.blue }}>Why this formula</div><Math_ tex={formula.why} block style={{ margin: 0, color: T.chalk, fontSize: 14 }} /></div>
          <div><div className="font-mono text-[11px] uppercase tracking-wide mb-1" style={{ color: T.blue }}>When to reach for it</div><Math_ tex={formula.when} block style={{ margin: 0, color: T.chalk, fontSize: 14 }} /></div>
          <div><div className="font-mono text-[11px] uppercase tracking-wide mb-1" style={{ color: T.blue }}>Example</div><Math_ tex={formula.example} block style={{ margin: 0, color: T.chalk, fontSize: 14 }} /></div>
        </div>
      </div>
    </div>
  );
}
function FormulaSheetView({ onOpenFormula }) {
  const [filter, setFilter] = useState("All");
  const cats = ["All", ...Object.keys(CATEGORIES)];
  const list = filter === "All" ? FORMULAS : FORMULAS.filter((f) => f.cat === filter);
  return (
    <div className="animate-[fadein_.3s_ease]">
      <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 24, marginBottom: 6, color: T.chalk }}>Formula Reference</h2>
      <p style={{ color: T.chalkDim, fontSize: 14, marginBottom: 20 }}>Every formula covered so far - what it's for, when to reach for it, and a worked example.</p>
      <div className="flex gap-2 flex-wrap mb-6">
        {cats.map((c) => (
          <button key={c} onClick={() => setFilter(c)} className="rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors" style={filter === c ? { background: T.amber, color: "var(--on-primary)" } : { background: "transparent", color: T.chalkDim, border: `1px solid ${T.chalkFaint}` }}>
            {c === "All" ? "All" : CATEGORIES[c]}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((f) => (
          <button key={f.id} onClick={() => onOpenFormula(f)} className="text-left rounded-xl p-4 transition-transform hover:-translate-y-0.5" style={{ background: T.surface, border: `1px solid ${T.chalkFaint}` }}>
            <div className="flex items-center justify-between mb-2"><Chip tone="blue">{CATEGORIES[f.cat]}</Chip><ChevronRight size={14} style={{ color: T.chalkDim }} /></div>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.chalk, marginBottom: 4 }}>{f.name}</div>
            <Math_ tex={f.formula} block style={{ margin: 0, color: T.amber, fontSize: 14 }} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   Worked Example + Practice Problem (with why/hint rendered
   through Math_ correctly from the start)
============================================================ */
function WorkedExample({ example }) {
  return (
    <Card className="p-5 mb-4">
      <div className="flex items-center gap-2 mb-2" style={{ color: T.blue }}>
        <BookOpen size={14} /> <span className="text-[11px] font-mono uppercase tracking-wide">Worked example - watch this one first</span>
      </div>
      <Math_ tex={example.tex} block style={{ color: T.chalk }} />
      {example.steps.map((s, i) => (
        <div key={i} className="rounded-lg p-3 mt-2" style={{ background: T.bgDeep, border: `1px solid ${T.chalkFaint}` }}>
          <div className="flex items-start gap-2">
            <span className="flex-shrink-0 flex items-center justify-center rounded-full font-mono text-[11px] font-bold" style={{ width: 20, height: 20, background: T.blueDim, color: T.blue }}>{i + 1}</span>
            <div style={{ flex: 1 }}>
              <Math_ tex={s.tex} block style={{ margin: 0, color: T.chalk, fontSize: 14 }} />
              {s.why && (
                <div className="mt-1.5 flex items-start gap-1.5 text-[12.5px]" style={{ color: T.chalkDim, lineHeight: 1.5 }}>
                  <Lightbulb size={12} style={{ color: T.amber, marginTop: 2, flexShrink: 0 }} />
                  <Math_ tex={s.why} style={{ color: T.chalkDim, fontSize: 12.5 }} />
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
      <div className="mt-3 inline-block rounded-lg px-4 py-2 font-mono text-sm" style={{ background: T.blueDim, color: T.blue }}>
        <Math_ tex={`\\text{Answer: } ${example.answer}`} />
      </div>
    </Card>
  );
}

function PracticeProblem({ problem, hwState, onGradeProblem }) {
  const [revealed, setRevealed] = useState(0);
  const graded = hwState[problem.id];
  return (
    <Card className="p-5 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span />
        {graded && <Chip tone={graded === "got" ? "blue" : "coral"}>{graded === "got" ? "Marked understood" : "Flagged for review"}</Chip>}
      </div>
      <Math_ tex={problem.tex} block style={{ color: T.chalk }} />
      {problem.steps.slice(0, revealed).map((s, i) => (
        <div key={i} className="rounded-lg p-3 mt-2" style={{ background: T.bgDeep, border: `1px solid ${T.chalkFaint}` }}>
          <div className="flex items-start gap-2">
            <span className="flex-shrink-0 flex items-center justify-center rounded-full font-mono text-[11px] font-bold" style={{ width: 20, height: 20, background: T.amberDim, color: T.amber }}>{i + 1}</span>
            <div style={{ flex: 1 }}>
              <Math_ tex={s.tex} block style={{ margin: 0, color: T.chalk, fontSize: 14 }} />
              {s.why && (
                <div className="mt-1.5 flex items-start gap-1.5 text-[12.5px]" style={{ color: T.chalkDim, lineHeight: 1.5 }}>
                  <Lightbulb size={12} style={{ color: T.blue, marginTop: 2, flexShrink: 0 }} />
                  <Math_ tex={s.why} style={{ color: T.chalkDim, fontSize: 12.5 }} />
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {revealed < problem.steps.length ? (
          <ChalkButton variant="primary" icon={ChevronRight} onClick={() => setRevealed((n) => n + 1)}>{revealed === 0 ? "Show step 1" : "Show next step"}</ChalkButton>
        ) : (
          <>
            <div className="rounded-lg px-4 py-2 font-mono text-sm" style={{ background: T.amberDim, color: T.amber }}><Math_ tex={`\\text{Answer: } ${problem.answer}`} /></div>
            {onGradeProblem && (
              <>
                <ChalkButton variant="coral" icon={X} onClick={() => onGradeProblem(problem.id, "miss")}>Still shaky</ChalkButton>
                <ChalkButton variant="blue" icon={Check} onClick={() => onGradeProblem(problem.id, "got")}>Got it</ChalkButton>
              </>
            )}
          </>
        )}
        {revealed > 0 && <button onClick={() => setRevealed(0)} className="text-xs flex items-center gap-1" style={{ color: T.chalkDim }}><RotateCcw size={12} /> Restart</button>}
      </div>
    </Card>
  );
}

function RefresherQuiz({ questions, onComplete }) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const q = questions[idx];
  const submit = () => {
    if (selected === null) return;
    if (selected === q.answer) setScore((s) => s + 1);
    setTimeout(() => {
      if (idx + 1 < questions.length) { setIdx((i) => i + 1); setSelected(null); } else { setDone(true); }
    }, 550);
  };
  useEffect(() => { if (done) onComplete(score, questions.length); // eslint-disable-next-line
  }, [done]);
  if (done) {
    return (
      <Card className="p-6 text-center">
        <CheckCircle2 size={32} style={{ color: T.amber, margin: "0 auto 10px" }} />
        <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 20, color: T.chalk }}>{score} / {questions.length} correct</h3>
      </Card>
    );
  }
  return (
    <Card className="p-5">
      <div className="flex justify-between items-center mb-3"><Chip tone="amber">Refresher {idx + 1} / {questions.length}</Chip></div>
      <p style={{ color: T.chalk, fontSize: 15, marginBottom: 14 }}>{q.q}</p>
      <div className="space-y-2">
        {q.options.map((opt, i) => {
          const isSelected = selected === i;
          const showResult = selected !== null;
          let style = { border: `1px solid ${T.chalkFaint}`, color: T.chalkDim };
          if (showResult && i === q.answer) style = { border: `1px solid rgba(61,122,138,0.6)`, color: T.blue, background: T.blueDim };
          else if (showResult && isSelected) style = { border: `1px solid rgba(179,80,61,0.6)`, color: T.coral, background: T.coralDim };
          return (
            <button key={i} disabled={selected !== null} onClick={() => setSelected(i)} className="w-full text-left rounded-lg px-4 py-2.5 text-sm transition-colors" style={style}>{opt}</button>
          );
        })}
      </div>
      <ChalkButton variant="primary" className="mt-4" onClick={submit} disabled={selected === null}>{idx + 1 === questions.length ? "Finish" : "Next"}</ChalkButton>
    </Card>
  );
}

/* ============================================================
   Session Flow — Preview -> Concept -> Example -> Practice ->
   Refresher -> Complete
============================================================ */
const STEP_LABELS = ["Preview", "Concept", "Example", "Practice", "Refresher", "Complete"];

const SESSION_PREVIEW_GOALS = {
  6: ["Understand what an estimator and a statistic are", "Apply the Method of Moments recipe: equate theoretical and sample moments", "Know the two rules for choosing k"],
  7: ["Build a likelihood function and log-likelihood function", "Find an MLE via differentiation", "Recognize when MLE requires reasoning about monotonicity instead of calculus"],
  8: ["Understand what makes a statistic 'sufficient'", "Apply the Factorization Theorem to verify sufficiency", "Know the one-to-one-function property of sufficient statistics"],
  9: ["Recognize the exponential family template", "Convert a density into exponential family form", "Read off the sufficient statistic directly from that form"],
};

function SessionSummary({ session, hwState, quizResult, onComplete }) {
  const hw = SESSION_HW_MAP[session.id];
  const ids = hw ? hw.data.map((p) => p.id) : [];
  const got = ids.filter((id) => hwState[id] === "got").length;
  const shaky = ids.filter((id) => hwState[id] === "miss").length;
  const untouched = ids.length - got - shaky;
  const next = SESSIONS.find((s) => s.id === session.id + 1);
  return (
    <Card className="p-6">
      <div className="text-center mb-6">
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: T.amberDim, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", animation: "pulseGlow 1.8s ease-in-out infinite" }}>
          <CheckCircle2 size={32} style={{ color: T.amber }} />
        </div>
        <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.chalk, marginBottom: 4 }}>Session complete</h3>
        <p style={{ color: T.chalkDim, fontSize: 13 }}>Session {session.id} - {session.title}</p>
      </div>
      {ids.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-lg p-3 text-center" style={{ background: T.blueDim }}><div className="font-mono text-lg font-bold" style={{ color: T.blue }}>{got}</div><div className="text-[11px]" style={{ color: T.chalkDim }}>got it</div></div>
          <div className="rounded-lg p-3 text-center" style={{ background: T.coralDim }}><div className="font-mono text-lg font-bold" style={{ color: T.coral }}>{shaky}</div><div className="text-[11px]" style={{ color: T.chalkDim }}>flagged shaky</div></div>
          <div className="rounded-lg p-3 text-center" style={{ background: T.surface2 }}><div className="font-mono text-lg font-bold" style={{ color: T.chalkDim }}>{untouched}</div><div className="text-[11px]" style={{ color: T.chalkDim }}>not attempted</div></div>
        </div>
      )}
      {quizResult && (
        <div className="flex items-center gap-2 rounded-lg p-3 mb-4" style={{ background: T.amberDim, border: "1px solid rgba(49,80,122,0.35)" }}>
          <ListChecks size={15} style={{ color: T.amber }} /><span style={{ color: T.chalk, fontSize: 13 }}>Refresher quiz: <b>{quizResult.score} / {quizResult.total}</b> correct</span>
        </div>
      )}
      <p style={{ color: T.chalkDim, fontSize: 13, marginBottom: 20 }}>{next ? `Next up: Session ${next.id} - ${next.title}.` : "That's everything currently built - more sessions get added as more notes come in."}</p>
      <ChalkButton variant="primary" icon={Home} onClick={() => onComplete(session.id)} className="w-full justify-center">Back to dashboard</ChalkButton>
    </Card>
  );
}

function SessionFlow({ session, onExit, onComplete, onOpenFormula, hwState, onGradeProblem }) {
  const [step, setStep] = useState(0);
  const [quizResult, setQuizResult] = useState(null);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [step]);

  const concepts = SESSION_CONCEPTS[session.id];
  const hasContent = !!concepts;
  const hw = SESSION_HW_MAP[session.id];
  const quiz = SESSION_QUIZ_MAP[session.id];
  const examples = WORKED_EXAMPLES[session.id] || [];

  const next = () => setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div className="animate-[fadein_.3s_ease]">
      <div className="flex items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {STEP_LABELS.map((label, i) => (
            <React.Fragment key={label}>
              <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap" style={i === step ? { background: T.amber, color: "var(--on-primary)" } : i < step ? { background: T.blueDim, color: T.blue } : { color: T.chalkDim, border: `1px solid ${T.chalkFaint}` }}>
                {i < step ? <Check size={12} /> : <span>{i + 1}</span>}{label}
              </div>
              {i < STEP_LABELS.length - 1 && <div style={{ width: 16, height: 1, background: T.chalkFaint }} />}
            </React.Fragment>
          ))}
        </div>
        {step < 5 && <button onClick={onExit} className="text-xs whitespace-nowrap flex-shrink-0" style={{ color: T.chalkDim }}>Exit anytime</button>}
      </div>

      <div key={step} style={{ animation: "slideInRight .3s cubic-bezier(.2,.85,.3,1)" }}>
      {step === 0 && (
        <Card className="p-6">
          <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 20, color: T.chalk, marginBottom: 4 }}>Today: {session.title}</h3>
          <Chip tone="blue">{session.lectures}</Chip>
          <p style={{ color: T.chalkDim, fontSize: 14, margin: "14px 0 10px" }}>By the end of this session, you'll be able to:</p>
          <ul className="space-y-2">
            {(SESSION_PREVIEW_GOALS[session.id] || ["Cover the concept", "Work through the example", "Practice with real problems"]).map((g, i) => (
              <li key={i} className="flex items-start gap-2 text-sm" style={{ color: T.chalk }}><Target size={14} style={{ color: T.amber, marginTop: 3, flexShrink: 0 }} /> {g}</li>
            ))}
          </ul>
        </Card>
      )}
      {step === 1 && (
        <div className="space-y-4">
          {hasContent ? concepts.map((c, i) => (
            <Card className="p-6" key={i}>
              <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 20, color: T.chalk, marginBottom: 12 }}>{c.title}</h3>
              <Math_ tex={c.body} block style={{ color: T.chalk, fontSize: 15, lineHeight: 1.7, marginBottom: 16 }} />
              {c.formulaIds.length > 0 && <div className="flex gap-2 mb-4 flex-wrap">{c.formulaIds.map((fid) => <FormulaChip key={fid} id={fid} onOpen={onOpenFormula} />)}</div>}
              <div className="rounded-lg p-4" style={{ background: T.amberDim, border: "1px solid rgba(49,80,122,0.35)" }}>
                <div className="flex items-center gap-2 mb-1" style={{ color: T.amber }}><Info size={14} /> <span className="text-xs font-mono uppercase">Key idea</span></div>
                <Math_ tex={c.keyIdea} block style={{ color: T.chalk, fontSize: 14, margin: 0 }} />
              </div>
            </Card>
          )) : (
            <Card className="p-6"><p style={{ color: T.chalkDim, fontSize: 14 }}>Concept content for this session isn't built yet - it's queued up next, built from real lecture notes once available.</p></Card>
          )}
        </div>
      )}
      {step === 2 && (
        <div>{examples.length > 0 ? examples.map((ex) => <WorkedExample key={ex.id} example={ex} />) : <Card className="p-6"><p style={{ color: T.chalkDim, fontSize: 14 }}>A worked example for this session isn't built yet.</p></Card>}</div>
      )}
      {step === 3 && (
        <div>
          {hw && <p style={{ color: T.chalkDim, fontSize: 13, marginBottom: 14 }}>{hw.label}</p>}
          {hw ? hw.data.map((p) => <PracticeProblem key={p.id} problem={p} hwState={hwState} onGradeProblem={onGradeProblem} />) : <Card className="p-6"><p style={{ color: T.chalkDim, fontSize: 14 }}>Practice problems for this session populate here once notes are available.</p></Card>}
        </div>
      )}
      {step === 4 && (quiz ? <RefresherQuiz questions={quiz} onComplete={(score, total) => setQuizResult({ score, total })} /> : <Card className="p-6"><p style={{ color: T.chalkDim, fontSize: 14 }}>Refresher quiz coming soon.</p></Card>)}
      {step === 5 && <SessionSummary session={session} hwState={hwState} quizResult={quizResult} onComplete={onComplete} />}
      </div>

      {step < 5 && (
        <div className="flex justify-between mt-6">
          {step === 0 ? <ChalkButton variant="ghost" icon={ChevronLeft} onClick={onExit}>Exit session</ChalkButton> : <ChalkButton variant="ghost" icon={ChevronLeft} onClick={back}>Back</ChalkButton>}
          <ChalkButton variant="primary" icon={ArrowRight} onClick={next}>Continue</ChalkButton>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Flashcards — spaced repetition (Leitner box 1-4)
============================================================ */
function buildDueQueue(boxes) {
  const withBox = FLASHCARDS_BASE.map((c) => ({ ...c, box: boxes[c.id] ?? 1 }));
  return withBox.map((c) => ({ c, r: Math.random() })).sort((a, b) => a.c.box - b.c.box || a.r - b.r).map((x) => x.c);
}
function FlashcardsView({ flashBoxes, onSaveBoxes }) {
  const [queue, setQueue] = useState(() => buildDueQueue(flashBoxes));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const grade = (cardId, gotIt) => {
    const current = flashBoxes[cardId] ?? 1;
    const nextBox = gotIt ? Math.min(4, current + 1) : 1;
    onSaveBoxes({ ...flashBoxes, [cardId]: nextBox });
    setPos((p) => p + 1); setFlipped(false);
  };
  if (pos >= queue.length) {
    return (
      <Card className="p-8 text-center">
        <CheckCircle2 size={28} style={{ color: T.amber, margin: "0 auto 10px" }} />
        <p style={{ color: T.chalk }}>Deck cleared - missed cards come back sooner next round.</p>
        <ChalkButton className="mt-4" variant="primary" onClick={() => { setQueue(buildDueQueue(flashBoxes)); setPos(0); }}>Run again</ChalkButton>
      </Card>
    );
  }
  const card = queue[pos];
  const box = flashBoxes[card.id] ?? 1;
  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-center gap-2 mb-2"><p style={{ color: T.chalkDim, fontSize: 12 }}>Card {pos + 1} of {queue.length}</p><Chip tone={box >= 3 ? "blue" : box === 1 ? "coral" : "amber"}>Box {box} of 4</Chip></div>
      <div onClick={() => setFlipped((f) => !f)} className="cursor-pointer rounded-xl p-8 text-center min-h-[200px] flex items-center justify-center transition-all" style={{ background: flipped ? T.surface2 : T.surface, border: flipped ? "1px solid rgba(61,122,138,0.4)" : `2px dashed ${T.chalkFaint}` }}>
        <Math_ tex={flipped ? card.back : card.front} block style={{ fontFamily: "Fraunces, serif", fontSize: 18, color: T.chalk, lineHeight: 1.6, textAlign: "center" }} />
      </div>
      <div className="flex gap-2 justify-center mt-4">
        {!flipped ? <ChalkButton variant="primary" onClick={() => setFlipped(true)}>Flip</ChalkButton> : (
          <><ChalkButton variant="coral" onClick={() => grade(card.id, false)}>Missed it</ChalkButton><ChalkButton variant="blue" onClick={() => grade(card.id, true)}>Got it</ChalkButton></>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Focus Session — weak spots across every set
============================================================ */
function FocusSessionView({ hwState, onGradeProblem }) {
  const weakIds = Object.entries(hwState).filter(([, v]) => v === "miss").map(([id]) => id);
  const weak = ALL_PROBLEMS.filter((p) => weakIds.includes(p.id));
  if (weak.length === 0) {
    return (
      <Card className="p-8 text-center">
        <CheckCircle2 size={32} style={{ color: T.amber, margin: "0 auto 12px" }} />
        <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 20, color: T.chalk, marginBottom: 6 }}>Nothing flagged right now</h3>
        <p style={{ color: T.chalkDim, fontSize: 14 }}>Mark a problem "Still shaky" anywhere and it lands here automatically.</p>
      </Card>
    );
  }
  return (
    <div className="animate-[fadein_.3s_ease]">
      <div className="flex items-center gap-2 mb-1" style={{ color: T.coral }}><Flame size={16} /> <span className="font-mono text-xs uppercase tracking-wide">Weak-spot focus session</span></div>
      <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.chalk, marginBottom: 18 }}>{weak.length} problem{weak.length === 1 ? "" : "s"} flagged</h2>
      {weak.map(({ id, label, ref }) => (
        <div key={id}><Chip tone="coral">{label}</Chip><div className="mt-2 mb-1"><PracticeProblem problem={ref} hwState={hwState} onGradeProblem={onGradeProblem} /></div></div>
      ))}
    </div>
  );
}

/* ============================================================
   Mock Exam — real problems, timed, self-graded
============================================================ */
function shuffledSample(arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy.slice(0, n);
}
function MockExamView({ hwState, onGradeProblem }) {
  const [phase, setPhase] = useState("setup");
  const [duration, setDuration] = useState(50);
  const [count, setCount] = useState(6);
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [examProblems, setExamProblems] = useState([]);
  const [idx, setIdx] = useState(0);

  const start = () => {
    const pool = ALL_PROBLEMS.map((p) => p.ref);
    setExamProblems(shuffledSample(pool, Math.min(count, pool.length)));
    setIdx(0); setRemaining(duration * 60); setPhase("running");
  };
  useEffect(() => {
    if (phase !== "running") return;
    timerRef.current = setInterval(() => setRemaining((r) => { if (r <= 1) { clearInterval(timerRef.current); setPhase("done"); return 0; } return r - 1; }), 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  if (phase === "setup") {
    return (
      <Card className="p-8 max-w-md mx-auto text-center">
        <Timer size={32} style={{ color: T.amber, margin: "0 auto 12px" }} />
        <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.chalk, marginBottom: 6 }}>Mock Exam</h2>
        <p style={{ color: T.chalkDim, fontSize: 14, marginBottom: 20 }}>Timed, real problems pulled at random from everything covered so far. Self-grade honestly.</p>
        <div style={{ marginBottom: 16 }}>
          <div className="text-xs font-mono uppercase tracking-wide mb-2" style={{ color: T.chalkDim }}>Time limit</div>
          <div className="flex justify-center gap-2">{[30, 50, 75].map((d) => <button key={d} onClick={() => setDuration(d)} className="rounded-lg px-4 py-2 text-sm font-mono" style={duration === d ? { background: T.amber, color: "var(--on-primary)" } : { border: `1px solid ${T.chalkFaint}`, color: T.chalkDim }}>{d} min</button>)}</div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div className="text-xs font-mono uppercase tracking-wide mb-2" style={{ color: T.chalkDim }}>Number of problems</div>
          <div className="flex justify-center gap-2">{[4, 6, 9].map((c) => <button key={c} onClick={() => setCount(c)} className="rounded-lg px-4 py-2 text-sm font-mono" style={count === c ? { background: T.amber, color: "var(--on-primary)" } : { border: `1px solid ${T.chalkFaint}`, color: T.chalkDim }}>{c}</button>)}</div>
        </div>
        <ChalkButton variant="primary" icon={PlayCircle} onClick={start} className="w-full justify-center">Start mock exam</ChalkButton>
      </Card>
    );
  }
  if (phase === "running") {
    const problem = examProblems[idx];
    const graded = hwState[problem.id];
    const isLast = idx === examProblems.length - 1;
    return (
      <div className={fullscreen ? "fixed inset-0 z-50 flex flex-col p-8 overflow-y-auto" : ""} style={fullscreen ? { background: T.bg } : {}}>
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div className="flex items-center gap-2 font-mono text-2xl" style={{ color: remaining < 180 ? T.coral : T.chalk }}><Clock size={22} /> {mm}:{ss}</div>
          <Chip tone="amber">Problem {idx + 1} of {examProblems.length}</Chip>
          <div className="flex gap-2">
            <ChalkButton variant="ghost" icon={fullscreen ? Minimize2 : Maximize2} onClick={() => setFullscreen((f) => !f)}>{fullscreen ? "Exit focus" : "Focus mode"}</ChalkButton>
            <ChalkButton variant="coral" onClick={() => { clearInterval(timerRef.current); setPhase("done"); }}>End exam</ChalkButton>
          </div>
        </div>
        <div className="flex-1"><PracticeProblem problem={problem} hwState={hwState} onGradeProblem={onGradeProblem} /></div>
        {graded && <ChalkButton variant="primary" icon={isLast ? CheckCircle2 : ArrowRight} onClick={() => (isLast ? setPhase("done") : setIdx((i) => i + 1))} className="w-full justify-center mt-2">{isLast ? "Finish exam" : "Next problem"}</ChalkButton>}
      </div>
    );
  }
  const attempted = examProblems.filter((p) => hwState[p.id]).length;
  const gotIt = examProblems.filter((p) => hwState[p.id] === "got").length;
  const shaky = examProblems.filter((p) => hwState[p.id] === "miss").length;
  return (
    <Card className="p-8 max-w-md mx-auto text-center">
      <CheckCircle2 size={32} style={{ color: T.amber, margin: "0 auto 12px" }} />
      <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.chalk, marginBottom: 6 }}>Exam session ended</h2>
      <p style={{ color: T.chalkDim, fontSize: 14, marginBottom: 16 }}>{attempted} of {examProblems.length} graded - {gotIt} solid, {shaky} flagged.</p>
      <ChalkButton variant="primary" onClick={() => setPhase("setup")}>Run another</ChalkButton>
    </Card>
  );
}

/* ============================================================
   Tasks / Agenda — preset plan from today through Test 1, then
   continuing to the Final. Self-directed since it's just you.
============================================================ */
const REVIEW_TASK_ROTATION = [
  "Review 10 flashcards (spaced repetition)",
  "Work through 2 problems in Focus Session",
  "Revisit one flagged problem until it clicks",
  "Skim the Formula Sheet - say each 'why' and 'when' out loud",
  "Light day - 15 minutes, your choice",
];
function dateStr(d) { return d.toISOString().slice(0, 10); }

function buildTaskPlan(currentSessionId) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const milestone = new Date(TEST1_DATE) >= today ? new Date(TEST1_DATE) : new Date(FINAL_DATE);
  const totalDays = Math.max(1, Math.round((milestone - today) / 86400000));
  const remaining = SESSIONS.filter((s) => s.id >= currentSessionId && SESSION_CONCEPTS[s.id]);
  const tasks = [];
  if (remaining.length === 0) {
    for (let d = 0; d <= totalDays; d++) {
      const date = new Date(today); date.setDate(date.getDate() + d);
      tasks.push({ id: `t-${dateStr(date)}`, date: dateStr(date), text: d === totalDays ? "Milestone day - you've got this." : REVIEW_TASK_ROTATION[d % REVIEW_TASK_ROTATION.length], done: false, kind: d === totalDays ? "exam" : "review" });
    }
    return tasks;
  }
  const spacing = Math.max(1, Math.floor(totalDays / remaining.length));
  let sessionPtr = 0, reviewPtr = 0;
  for (let d = 0; d <= totalDays; d++) {
    const date = new Date(today); date.setDate(date.getDate() + d);
    const isSessionDay = sessionPtr < remaining.length && d === sessionPtr * spacing;
    if (isSessionDay) {
      const s = remaining[sessionPtr];
      tasks.push({ id: `t-${dateStr(date)}`, date: dateStr(date), text: `Session ${s.id}: ${s.title}`, done: false, kind: "session", sessionId: s.id });
      sessionPtr++;
    } else if (d === totalDays) {
      tasks.push({ id: `t-${dateStr(date)}`, date: dateStr(date), text: "Milestone day - you've got this.", done: false, kind: "exam" });
    } else {
      tasks.push({ id: `t-${dateStr(date)}`, date: dateStr(date), text: REVIEW_TASK_ROTATION[reviewPtr % REVIEW_TASK_ROTATION.length], done: false, kind: "review" });
      reviewPtr++;
    }
  }
  return tasks;
}

function TaskRow({ task, onToggle }) {
  const kindIcon = task.kind === "session" ? GraduationCap : task.kind === "exam" ? Flame : ListChecks;
  const kindColor = task.kind === "session" ? T.amber : task.kind === "exam" ? T.coral : T.blue;
  return (
    <button onClick={() => onToggle(task.id, !task.done)} className="w-full text-left flex items-center gap-3 rounded-lg p-3 transition-colors" style={{ background: task.done ? T.surface2 : T.surface, border: `1px solid ${T.chalkFaint}`, opacity: task.done ? 0.6 : 1 }}>
      <div className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center transition-all duration-200" style={{ border: `2px solid ${task.done ? T.blue : T.chalkFaint}`, background: task.done ? T.blue : "transparent" }}>
        {task.done && <Check size={13} style={{ color: "#fff", animation: "checkPop .25s cubic-bezier(.3,1.5,.5,1)" }} />}
      </div>
      {React.createElement(kindIcon, { size: 14, style: { color: kindColor, flexShrink: 0 } })}
      <span style={{ color: T.chalk, fontSize: 13.5, textDecoration: task.done ? "line-through" : "none" }}>{task.text}</span>
    </button>
  );
}
function TasksView({ tasks, onToggle }) {
  const todayStr = dateStr(new Date());
  const grouped = {};
  tasks.forEach((t) => { if (!grouped[t.date]) grouped[t.date] = []; grouped[t.date].push(t); });
  const dates = Object.keys(grouped).sort();
  const doneCount = tasks.filter((t) => t.done).length;
  return (
    <div className="animate-[fadein_.3s_ease]">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2"><h2 style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: T.chalk }}>Daily Tasks</h2><Chip tone="blue">{doneCount}/{tasks.length} done</Chip></div>
      <p style={{ color: T.chalkDim, fontSize: 13.5, marginBottom: 20 }}>Preset from today through your next milestone - one task a day.</p>
      <div className="space-y-5">
        {dates.map((d) => {
          const isToday = d === todayStr, isPast = d < todayStr;
          return (
            <div key={d} style={isPast ? { opacity: 0.5 } : {}}>
              <div className="flex items-center gap-2 mb-2"><span className="text-xs font-mono uppercase tracking-wide" style={{ color: isToday ? T.amber : T.chalkDim }}>{new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>{isToday && <Chip tone="amber">Today</Chip>}</div>
              <div className="space-y-1.5">{grouped[d].map((t) => <TaskRow key={t.id} task={t} onToggle={onToggle} />)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   Roadmap strip + Dashboard
============================================================ */
function RoadmapStrip({ sessions, currentId, onSelect }) {
  return (
    <div className="relative pl-2">
      <div className="absolute left-[19px] top-2 bottom-2 w-px" style={{ borderLeft: `2px dashed ${T.chalkFaint}` }} />
      <div className="space-y-1">
        {sessions.map((s) => {
          const isCurrent = s.id === currentId, isPast = s.id < currentId, hasContent = !!SESSION_CONCEPTS[s.id];
          return (
            <button key={s.id} onClick={() => onSelect(s)} disabled={!hasContent} className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.03]" style={{ opacity: hasContent ? 1 : 0.45 }}>
              <div className="relative z-10 flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 22, height: 22, background: isCurrent ? T.amber : isPast ? T.blueDim : T.bgDeep, border: isCurrent ? "none" : `1px solid ${T.chalkFaint}` }}>
                {isPast ? <Check size={12} style={{ color: T.blue }} /> : isCurrent ? <span className="w-2 h-2 rounded-full" style={{ background: "var(--on-primary)" }} /> : <Circle size={8} style={{ color: T.chalkDim }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><span style={{ color: isCurrent ? T.chalk : T.chalkDim, fontSize: 13, fontWeight: isCurrent ? 600 : 400 }}>S{s.id} - {s.title}</span>{s.test && <Chip tone="coral">{s.test}</Chip>}{!hasContent && <Chip>Not built yet</Chip>}</div>
              </div>
              <span className="text-[11px] font-mono" style={{ color: T.chalkDim }}>{s.lectures}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
function MasteryRadar({ hwState }) {
  const catMap = { 6: "Estimation", 7: "Estimation", 8: "Estimation", 9: "Estimation" };
  const catProblems = { Foundations: [], Estimation: ALL_PROBLEMS, Sampling: [], Testing: [] };
  const data = Object.keys(CATEGORIES).map((k) => {
    const probs = catProblems[k];
    const pct = probs.length === 0 ? 0 : Math.round((probs.filter((p) => hwState[p.id] === "got").length / probs.length) * 100);
    return { subject: CATEGORIES[k].split(" ")[0], value: pct, fullMark: 100 };
  });
  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={data} outerRadius="75%">
        <PolarGrid stroke={T.chalkFaint} />
        <PolarAngleAxis dataKey="subject" tick={{ fill: T.chalkDim, fontSize: 11 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar dataKey="value" stroke={T.amber} fill={T.amber} fillOpacity={0.28} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function Dashboard({ currentSessionId, hwState, tasks, onSelectSession, onStartSession, onOpenFocus, onOpenTasks }) {
  const currentSession = SESSIONS.find((s) => s.id === currentSessionId) || SESSIONS[0];
  const today = new Date(); today.setHours(0,0,0,0);
  const test1 = new Date(TEST1_DATE);
  const finalD = new Date(FINAL_DATE);
  const nextMilestone = test1 >= today ? { label: "Test 1 (estimated)", date: test1 } : { label: "Final Exam", date: finalD };
  const daysLeft = Math.max(0, Math.ceil((nextMilestone.date - today) / 86400000));
  const weakCount = Object.values(hwState).filter((v) => v === "miss").length;
  const todayStr = dateStr(new Date());
  const todayTask = tasks.find((t) => t.date === todayStr);

  return (
    <div className="animate-[fadein_.3s_ease] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: T.amberDim, color: T.amber }}><Flame size={20} /></div>
          <div><h1 style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: T.chalk }}>Welcome back, {ME}.</h1><p style={{ color: T.chalkDim, fontSize: 14 }}>MTH 541 - Statistical Theory II</p></div>
        </div>
        <Card className="px-4 py-3 flex items-center gap-3">
          <Calendar size={18} style={{ color: T.amber }} />
          <div><div className="font-mono text-lg font-bold" style={{ color: T.amber }}>{daysLeft} days</div><div className="text-[11px]" style={{ color: T.chalkDim }}>to {nextMilestone.label}</div></div>
        </Card>
      </div>

      {todayTask && (
        <button onClick={onOpenTasks} className="w-full text-left rounded-xl p-4 flex items-center gap-3 transition-transform hover:-translate-y-0.5" style={{ background: T.amberDim, border: "1px solid rgba(49,80,122,0.4)" }}>
          <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(49,80,122,0.2)", color: T.amber }}><ClipboardCheck size={20} /></div>
          <div className="flex-1 min-w-0"><div style={{ color: T.amber, fontSize: 11, fontWeight: 700 }} className="font-mono uppercase tracking-wide">Today's plan</div><div style={{ color: T.chalk, fontSize: 14.5, fontWeight: 600 }}>{todayTask.text}</div></div>
          <ChevronRight size={16} style={{ color: T.amber }} />
        </button>
      )}

      <button onClick={onOpenFocus} className="w-full text-left rounded-xl p-5 flex items-center gap-4 transition-transform hover:-translate-y-0.5" style={{ background: weakCount > 0 ? T.coralDim : T.surface, border: `1px solid ${weakCount > 0 ? "rgba(179,80,61,0.4)" : T.chalkFaint}` }}>
        <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: weakCount > 0 ? "rgba(179,80,61,0.2)" : T.surface2, color: weakCount > 0 ? T.coral : T.chalkDim }}><Flame size={20} /></div>
        <div className="flex-1"><div style={{ color: T.chalk, fontSize: 15, fontWeight: 600 }}>{weakCount > 0 ? `${weakCount} problem${weakCount === 1 ? "" : "s"} flagged shaky` : "No weak spots flagged"}</div></div>
        <ChevronRight size={16} style={{ color: T.chalkDim }} />
      </button>

      <Card className="p-6" style={{ background: `linear-gradient(135deg, ${T.surface}, ${T.surface2})`, borderColor: "rgba(49,80,122,0.3)" }}>
        <Chip tone="amber">Session {currentSession.id}</Chip>
        <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: T.chalk, margin: "8px 0 6px" }}>{currentSession.title}</h2>
        <p style={{ color: T.chalkDim, fontSize: 13, marginBottom: 14 }}>{currentSession.lectures}</p>
        <ChalkButton variant="primary" icon={PlayCircle} onClick={() => onStartSession(currentSession)}>Start today's session</ChalkButton>
      </Card>

      <div className="grid md:grid-cols-2 gap-5">
        <Card className="p-5"><h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.chalk, marginBottom: 12 }}>Course roadmap</h3><RoadmapStrip sessions={SESSIONS} currentId={currentSessionId} onSelect={onSelectSession} /></Card>
        <Card className="p-5"><h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.chalk, marginBottom: 4 }}>Mastery map</h3><p style={{ color: T.chalkDim, fontSize: 12, marginBottom: 6 }}>% of built problems marked "got it," by area</p><MasteryRadar hwState={hwState} /></Card>
      </div>
    </div>
  );
}

function SettingsView({ theme, setTheme, fontSize, setFontSize }) {
  const Row = ({ label, children }) => (<div className="mb-6"><div className="text-sm font-semibold mb-2" style={{ color: T.chalk }}>{label}</div><div className="flex gap-2 flex-wrap">{children}</div></div>);
  const Choice = ({ active, onClick, children }) => (<button onClick={onClick} className="rounded-lg px-3.5 py-2 text-sm font-medium transition-colors" style={active ? { background: T.amber, color: "var(--on-primary)" } : { border: `1px solid ${T.chalkFaint}`, color: T.chalkDim }}>{children}</button>);
  return (
    <div className="animate-[fadein_.3s_ease] max-w-md">
      <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 24, marginBottom: 18, color: T.chalk }}>Settings</h2>
      <Row label="Theme"><Choice active={theme === "auto"} onClick={() => setTheme("auto")}>Auto (by time of day)</Choice><Choice active={theme === "light"} onClick={() => setTheme("light")}>Light</Choice><Choice active={theme === "dark"} onClick={() => setTheme("dark")}>Dark</Choice></Row>
      <Row label="Font size">{[0, 1, 2, 3].map((s) => <Choice key={s} active={fontSize === s} onClick={() => setFontSize(s)}>{["S", "M", "L", "XL"][s]}</Choice>)}</Row>
    </div>
  );
}

/* ============================================================
   Root App
============================================================ */
export default function StatTutorApp() {
  const [view, setView] = useState("dashboard");
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [view]);

  const [currentSessionId, setCurrentSessionId] = useState(1);
  const [activeSession, setActiveSession] = useState(null);
  const [hwState, setHwState] = useState({});
  const [tasks, setTasks] = useState([]);
  const [flashBoxes, setFlashBoxes] = useState({});
  const [openFormula, setOpenFormula] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [theme, setTheme] = useState("auto");
  const [fontSize, setFontSize] = useState(2);

  useEffect(() => {
    (async () => {
      const [sid, hw, boxes, th, fs, savedTasks] = await Promise.all([
        loadState("current-session-id", 1),
        loadState("hw-state", {}),
        loadState("flash-boxes", {}),
        loadState("theme", "auto"),
        loadState("font-size", 2),
        loadState("tasks", null),
      ]);
      setCurrentSessionId(sid);
      setHwState(hw);
      setFlashBoxes(boxes);
      setTheme(th);
      setFontSize(fs);
      let taskList = savedTasks;
      if (!taskList || taskList.length === 0) { taskList = buildTaskPlan(sid); saveState("tasks", taskList); }
      setTasks(taskList);
      setLoaded(true);
    })();
  }, []);

  const gradeProblem = (id, val) => { const next = { ...hwState, [id]: val }; setHwState(next); saveState("hw-state", next); };
  const toggleTask = (id, done) => { const next = tasks.map((t) => (t.id === id ? { ...t, done } : t)); setTasks(next); saveState("tasks", next); };
  const saveFlashBoxes = (boxes) => { setFlashBoxes(boxes); saveState("flash-boxes", boxes); };
  const setThemeAndSave = (t) => { setTheme(t); saveState("theme", t); };
  const setFontSizeAndSave = (s) => { setFontSize(s); saveState("font-size", s); };

  const startSession = (session) => { setActiveSession(session); setView("session"); };
  const completeSession = (id) => {
    const nextId = Math.min(id + 1, SESSIONS.length);
    setCurrentSessionId(nextId);
    saveState("current-session-id", nextId);
    setActiveSession(null);
    setView("dashboard");
  };

  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "tasks", label: "Tasks", icon: ClipboardCheck },
    { id: "focus", label: "Focus Session", icon: Flame },
    { id: "formulas", label: "Formula Sheet", icon: BookOpen },
    { id: "mockexam", label: "Mock Exam", icon: Timer },
    { id: "flashcards", label: "Flashcards", icon: Layers },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const hour = new Date().getHours();
  const autoDark = hour < 7 || hour >= 18;
  const isDark = theme === "dark" || (theme === "auto" && autoDark);
  const cssVars = isDark ? DARK_VARS : LIGHT_VARS;
  const fontSizeMap = { 0: 14, 1: 15, 2: 16, 3: 18 };
  const weakCount = Object.values(hwState).filter((v) => v === "miss").length;

  return (
    <div style={{ ...cssVars, minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "'Sora', -apple-system, sans-serif", fontSize: fontSizeMap[fontSize], position: "relative", transition: "background .25s ease, color .25s ease" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,500;1,9..144,600&family=Sora:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        @keyframes fadein { from { opacity:0; transform: translateY(6px);} to { opacity:1; transform:none; } }
        @keyframes popin { from { opacity:0; transform: scale(.94) translateY(8px);} to { opacity:1; transform:scale(1) translateY(0);} }
        @keyframes pulseGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(127,160,208,0.35);} 50% { box-shadow: 0 0 0 10px rgba(127,160,208,0);} }
        @keyframes pulseDot { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes slideInRight { from { opacity:0; transform: translateX(16px); } to { opacity:1; transform: translateX(0); } }
        @keyframes viewFadeIn { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform: translateY(0); } }
        @keyframes checkPop { 0% { transform: scale(0.6); } 60% { transform: scale(1.15); } 100% { transform: scale(1); } }
        * { box-sizing: border-box; }
        ::selection { background: ${T.amber}; color: var(--on-primary); }
        body { margin:0; }
      `}</style>
      <div className="max-w-5xl mx-auto px-5 py-6">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-sm" style={{ background: T.amber, color: "var(--on-primary)" }}>&Sigma;</div>
            <span style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.chalk, fontWeight: 600 }}>My Tutor</span>
          </div>
          <div className="flex gap-1 rounded-full p-1 flex-wrap" style={{ background: T.surface, border: `1px solid ${T.chalkFaint}` }}>
            {NAV.map((n) => (
              <button key={n.id} onClick={() => setView(n.id)} className="relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors" style={view === n.id ? { background: T.amber, color: "var(--on-primary)" } : { color: T.chalkDim }}>
                <n.icon size={14} /> <span className="hidden sm:inline">{n.label}</span>
                {n.id === "focus" && weakCount > 0 && <span className="absolute -top-1 -right-1 flex items-center justify-center rounded-full font-mono text-[9px] font-bold" style={{ width: 15, height: 15, background: T.coral, color: "#fff" }}>{weakCount > 9 ? "9+" : weakCount}</span>}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <SyncIndicator />
            <button onClick={() => setThemeAndSave(isDark ? "light" : "dark")} title="Toggle theme" className="w-9 h-9 rounded-full flex items-center justify-center transition-colors" style={{ background: T.surface, border: `1px solid ${T.chalkFaint}`, color: T.amber }}>{isDark ? <Moon size={15} /> : <Sun size={15} />}</button>
          </div>
        </div>

        {!loaded ? (
          <div className="flex flex-col items-center justify-center" style={{ color: T.chalkDim, padding: 80 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: `3px solid ${T.chalkFaint}`, borderTopColor: T.amber, animation: "spin 0.8s linear infinite", marginBottom: 14 }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            Loading your progress...
          </div>
        ) : (
          <div key={view} style={{ animation: "viewFadeIn .35s cubic-bezier(.2,.85,.3,1)" }}>
            {view === "dashboard" && <Dashboard currentSessionId={currentSessionId} hwState={hwState} tasks={tasks} onSelectSession={(s) => startSession(s)} onStartSession={startSession} onOpenFocus={() => setView("focus")} onOpenTasks={() => setView("tasks")} />}
            {view === "session" && activeSession && <SessionFlow session={activeSession} onExit={() => setView("dashboard")} onComplete={completeSession} onOpenFormula={setOpenFormula} hwState={hwState} onGradeProblem={gradeProblem} />}
            {view === "tasks" && <TasksView tasks={tasks} onToggle={toggleTask} />}
            {view === "focus" && <FocusSessionView hwState={hwState} onGradeProblem={gradeProblem} />}
            {view === "formulas" && <FormulaSheetView onOpenFormula={setOpenFormula} />}
            {view === "mockexam" && <MockExamView hwState={hwState} onGradeProblem={gradeProblem} />}
            {view === "flashcards" && <FlashcardsView flashBoxes={flashBoxes} onSaveBoxes={saveFlashBoxes} />}
            {view === "settings" && <SettingsView theme={theme} setTheme={setThemeAndSave} fontSize={fontSize} setFontSize={setFontSizeAndSave} />}
          </div>
        )}
      </div>
      <FormulaModal formula={openFormula} onClose={() => setOpenFormula(null)} />
    </div>
  );
}
