/**
 * P1.5A Showcase — projector-friendly presentation tokens (PICK_VN sports event).
 */

export const showcaseShellSx = {
  position: "fixed",
  inset: 0,
  zIndex: 1400,
  bgcolor: "#07111f",
  color: "#f4f7fb",
  overflow: "auto",
  fontFamily: '"Plus Jakarta Sans", "DM Sans", system-ui, sans-serif',
  backgroundImage:
    "radial-gradient(ellipse at top, rgba(46, 204, 113, 0.12), transparent 55%), linear-gradient(180deg, #0a1628 0%, #07111f 45%, #050b14 100%)",
};

export const showcaseInnerSx = {
  maxWidth: 1200,
  mx: "auto",
  px: { xs: 2, md: 4 },
  py: { xs: 3, md: 5 },
  minHeight: "100%",
  display: "flex",
  flexDirection: "column",
  gap: 3,
};

export const showcaseTitleSx = {
  fontSize: { xs: "2rem", md: "3.25rem" },
  fontWeight: 800,
  letterSpacing: "-0.03em",
  lineHeight: 1.1,
  textAlign: "center",
  m: 0,
};

export const showcaseSubtitleSx = {
  fontSize: { xs: "1.05rem", md: "1.35rem" },
  color: "rgba(244,247,251,0.78)",
  textAlign: "center",
  m: 0,
};

export const showcaseCountdownSx = {
  fontSize: { xs: "6rem", md: "9rem" },
  fontWeight: 800,
  lineHeight: 1,
  textAlign: "center",
  color: "#7CFFB2",
  textShadow: "0 0 40px rgba(124,255,178,0.35)",
};

export const showcaseCardSx = {
  bgcolor: "rgba(12, 24, 42, 0.92)",
  border: "1px solid rgba(124,255,178,0.22)",
  borderRadius: 2,
  p: { xs: 2, md: 3 },
  boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
};

export const showcaseTeamCardSx = {
  ...showcaseCardSx,
  borderColor: "rgba(91, 192, 255, 0.35)",
  transition: "opacity 280ms ease, transform 280ms ease",
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
  },
};

export const showcaseActionsSx = {
  display: "flex",
  flexWrap: "wrap",
  gap: 1.5,
  justifyContent: "center",
  pt: 1,
};

export const showcaseBadgeSx = {
  display: "inline-flex",
  alignItems: "center",
  gap: 0.75,
  px: 1.5,
  py: 0.5,
  borderRadius: 1,
  bgcolor: "rgba(124,255,178,0.12)",
  border: "1px solid rgba(124,255,178,0.35)",
  color: "#7CFFB2",
  fontWeight: 700,
  fontSize: "0.85rem",
};

export const showcaseMutedSx = {
  color: "rgba(244,247,251,0.65)",
  fontSize: "0.95rem",
};

/** Outlined actions on dark shell — stay readable when disabled. */
export const showcaseOutlinedButtonSx = {
  color: "rgba(244,247,251,0.92)",
  borderColor: "rgba(244,247,251,0.45)",
  textTransform: "none",
  fontWeight: 700,
  "&:hover": {
    borderColor: "rgba(124,255,178,0.75)",
    bgcolor: "rgba(124,255,178,0.08)",
    color: "#f4f7fb",
  },
  "&.Mui-disabled": {
    opacity: 1,
    color: "rgba(244,247,251,0.55)",
    borderColor: "rgba(244,247,251,0.28)",
  },
};

/** Primary / contained accent on dark shell. */
export const showcasePrimaryButtonSx = {
  bgcolor: "#7CFFB2",
  color: "#061018",
  textTransform: "none",
  fontWeight: 800,
  "&:hover": {
    bgcolor: "#9affc6",
  },
  "&.Mui-disabled": {
    opacity: 1,
    bgcolor: "rgba(124,255,178,0.28)",
    color: "rgba(6,16,24,0.55)",
  },
};

/** Text / select fields on dark cards. */
export const showcaseFieldSx = {
  "& .MuiInputLabel-root": {
    color: "rgba(244,247,251,0.72)",
  },
  "& .MuiInputLabel-root.Mui-focused": {
    color: "#7CFFB2",
  },
  "& .MuiInputLabel-root.Mui-disabled": {
    color: "rgba(244,247,251,0.5)",
  },
  "& .MuiOutlinedInput-root": {
    color: "#f4f7fb",
    bgcolor: "rgba(7, 17, 31, 0.55)",
    "& fieldset": {
      borderColor: "rgba(244,247,251,0.28)",
    },
    "&:hover fieldset": {
      borderColor: "rgba(124,255,178,0.45)",
    },
    "&.Mui-focused fieldset": {
      borderColor: "rgba(124,255,178,0.75)",
    },
    "&.Mui-disabled": {
      color: "rgba(244,247,251,0.55)",
      "& fieldset": {
        borderColor: "rgba(244,247,251,0.2)",
      },
    },
  },
  "& .MuiSelect-icon": {
    color: "rgba(244,247,251,0.7)",
  },
};

export const showcaseRadioSx = {
  color: "rgba(244,247,251,0.55)",
  "&.Mui-checked": {
    color: "#7CFFB2",
  },
  "&.Mui-disabled": {
    color: "rgba(244,247,251,0.35)",
  },
};

/** Optional simple UI tone (no copyrighted music). */
export function playShowcaseTone(enabled) {
  if (!enabled || typeof window === "undefined") return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 660;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.stop(ctx.currentTime + 0.2);
    osc.onended = () => ctx.close().catch(() => {});
  } catch {
    // Audio may be blocked; showcase must work without sound.
  }
}

export function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
