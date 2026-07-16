import { useEffect, useReducer, useRef } from "react";
import { Box, Button, Chip, IconButton, Stack } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";

import { TEAM_GROUP_SEEDING } from "../constants.js";
import { DEFAULT_ENGINE_VERSION } from "../canonical/teamTournamentMutationEnvelope.js";
import {
  SHOWCASE_COPY,
  SHOWCASE_COUNTDOWN_SECONDS,
  SHOWCASE_DEFAULT_TEAM_COUNT,
  SHOWCASE_MODE,
  SHOWCASE_STAGE,
  PROCESSING_STAGES,
} from "./showcaseConstants.js";
import {
  createInitialShowcaseState,
  createShowcaseIdempotencyKey,
  reduceShowcaseState,
  showcaseAllowsCancel,
} from "./showcaseMachine.js";
import {
  generateShowcaseGroupDraw,
  generateShowcaseTeamDraw,
  buildReplayShowcaseSession,
} from "./showcaseDrawSession.js";
import { confirmShowcasePersistence } from "./showcasePersistenceAdapter.js";
import {
  playShowcaseTone,
  prefersReducedMotion,
  showcaseInnerSx,
  showcaseShellSx,
} from "./showcaseStyles.js";
import ShowcasePreflight from "./ShowcasePreflight.jsx";
import ShowcaseCountdown from "./ShowcaseCountdown.jsx";
import ShowcaseProcessing from "./ShowcaseProcessing.jsx";
import ShowcaseTeamReveal from "./ShowcaseTeamReveal.jsx";
import ShowcaseCaptainReveal from "./ShowcaseCaptainReveal.jsx";
import ShowcaseGroupReveal, {
  ShowcaseGroupFormatSelect,
} from "./ShowcaseGroupReveal.jsx";
import ShowcaseFinalReview from "./ShowcaseFinalReview.jsx";
import ShowcaseResults from "./ShowcaseResults.jsx";

/**
 * Isolated presentation shell for P1.5A showcase.
 */
export default function TeamTournamentShowcase({
  open,
  mode = SHOWCASE_MODE.LIVE,
  onClose,
  preflight,
  players = [],
  teamNamePrefix = "Đội",
  requestedTeamCount = SHOWCASE_DEFAULT_TEAM_COUNT,
  baseTeamData = null,
  persistedTeamData = null,
  rulesVersion = "",
  engineVersion = DEFAULT_ENGINE_VERSION,
  tournamentName = "",
  clubId,
  tournamentId,
  persistSetupTeamData,
  reload,
  expectedTournamentVersion,
  previousTeamData,
  teamsAlreadyPersisted = false,
  canSkipCountdown = true,
  onContinueSetup,
  onBackTournament,
  draftStatus = "đã lưu",
}) {
  const shellRef = useRef(null);
  const fixedSessionRef = useRef(null);
  const membershipRef = useRef(null);
  const groupFingerprintRef = useRef(null);
  const showAllTeamsRef = useRef(false);
  const showAllGroupsRef = useRef(false);
  const idempotencyRef = useRef(null);
  const beginProcessingRef = useRef(null);

  const [state, dispatch] = useReducer(
    reduceShowcaseState,
    null,
    () => createInitialShowcaseState()
  );

  // Open / sync from parent
  useEffect(() => {
    if (!open) {
      dispatch({ type: "CLOSE" });
      fixedSessionRef.current = null;
      return;
    }
    const reduced = prefersReducedMotion();
    if (mode === SHOWCASE_MODE.REPLAY && persistedTeamData) {
      const session = buildReplayShowcaseSession({
        teamData: persistedTeamData,
        players,
        engineVersion,
        rulesVersion,
      });
      fixedSessionRef.current = session;
      membershipRef.current = session.membershipFingerprint;
      groupFingerprintRef.current = session.groupSession?.groupFingerprint || null;
      dispatch({
        type: "OPEN_REPLAY",
        payload: {
          session,
          preflight,
          reducedMotion: reduced,
          savedAt: persistedTeamData?.updatedAt || null,
          stage: SHOWCASE_STAGE.TEAM_REVEAL,
        },
      });
      return;
    }
    dispatch({
      type: "OPEN_LIVE",
      payload: { preflight, reducedMotion: reduced },
    });
  }, [open, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown ticker
  useEffect(() => {
    if (!state.open || state.stage !== SHOWCASE_STAGE.COUNTDOWN || state.paused) {
      return undefined;
    }
    if (state.countdownValue <= 0) {
      beginProcessingRef.current?.();
      return undefined;
    }
    const ms = state.reducedMotion ? 120 : 1000;
    const timer = window.setTimeout(() => {
      playShowcaseTone(state.soundEnabled);
      dispatch({ type: "SET_COUNTDOWN", payload: state.countdownValue - 1 });
    }, ms);
    return () => window.clearTimeout(timer);
  }, [state.open, state.stage, state.countdownValue, state.paused, state.reducedMotion, state.soundEnabled]);

  // Processing ticker (reveal only — engine already fixed)
  useEffect(() => {
    if (!state.open || state.stage !== SHOWCASE_STAGE.PROCESSING || state.paused) {
      return undefined;
    }
    const last = PROCESSING_STAGES.length - 1;
    if (state.processingIndex >= last) {
      const timer = window.setTimeout(() => {
        dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.TEAM_REVEAL } });
      }, state.reducedMotion ? 80 : 600);
      return () => window.clearTimeout(timer);
    }
    const ms = state.reducedMotion ? 100 : 900;
    const timer = window.setTimeout(() => {
      playShowcaseTone(state.soundEnabled);
      dispatch({ type: "SET_PROCESSING_INDEX", payload: state.processingIndex + 1 });
    }, ms);
    return () => window.clearTimeout(timer);
  }, [state.open, state.stage, state.processingIndex, state.paused, state.reducedMotion, state.soundEnabled]);

  // Escape exits projector / closes safely
  useEffect(() => {
    if (!state.open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") {
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
          dispatch({ type: "SET_PROJECTOR", payload: false });
          return;
        }
        if (showcaseAllowsCancel(state) || state.mode === SHOWCASE_MODE.REPLAY) {
          onClose?.();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, onClose]);

  function beginProcessing() {
    // Run engine exactly once here (after countdown), freeze session.
    if (!fixedSessionRef.current) {
      const generated = generateShowcaseTeamDraw({
        players,
        teamCount: requestedTeamCount,
        teamNamePrefix,
        baseTeamData,
        engineVersion,
        rulesVersion: rulesVersion || preflight?.summary?.rulesVersion || "",
        randomFn: Math.random,
      });
      if (!generated.ok) {
        dispatch({
          type: "SET_PREFLIGHT",
          payload: {
            ...(preflight || {}),
            ok: false,
            blockers: [generated.error || "Không tạo được kết quả đội."],
          },
        });
        dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.PREFLIGHT } });
        return;
      }
      fixedSessionRef.current = generated.session;
      membershipRef.current = generated.session.membershipFingerprint;
      dispatch({ type: "SET_SESSION", payload: generated.session });
    }
    dispatch({
      type: "GO_STAGE",
      payload: { stage: SHOWCASE_STAGE.PROCESSING, clearError: true },
    });
  }
  beginProcessingRef.current = beginProcessing;

  function handleStartFromPreflight() {
    if (!preflight?.ok && !state.preflight?.ok) return;
    dispatch({
      type: "GO_STAGE",
      payload: {
        stage: SHOWCASE_STAGE.COUNTDOWN,
        countdownValue: SHOWCASE_COUNTDOWN_SECONDS,
      },
    });
  }

  function handleSelectGroupFormat(option) {
    const base = fixedSessionRef.current || state.session;
    if (!base) return;
    const generated = generateShowcaseGroupDraw(base, {
      groupCount: option.groupCount,
      seedingMode: TEAM_GROUP_SEEDING.AVG_LEVEL,
      rulesVersion: rulesVersion || base.rulesVersion || "",
      randomFn: Math.random,
    });
    if (!generated.ok) {
      dispatch({
        type: "SAVE_FAILED",
        payload: { error: generated.error || "Không chia được bảng." },
      });
      return;
    }
    // Team membership must remain identical
    if (
      membershipRef.current &&
      generated.session.membershipFingerprint !== membershipRef.current
    ) {
      dispatch({
        type: "SAVE_FAILED",
        payload: { error: "Kết quả đội bị thay đổi — đã hủy chia bảng." },
      });
      return;
    }
    fixedSessionRef.current = generated.session;
    groupFingerprintRef.current = generated.session.groupSession?.groupFingerprint;
    showAllGroupsRef.current = false;
    dispatch({ type: "SET_SESSION", payload: generated.session });
    dispatch({
      type: "GO_STAGE",
      payload: { stage: SHOWCASE_STAGE.GROUP_REVEAL, groupRevealIndex: 0 },
    });
  }

  async function handleConfirmSave() {
    if (state.mode === SHOWCASE_MODE.REPLAY) return;
    if (state.saving) return;
    const session = fixedSessionRef.current || state.session;
    if (!idempotencyRef.current) {
      idempotencyRef.current = createShowcaseIdempotencyKey(tournamentId);
    }
    dispatch({
      type: "BEGIN_SAVE",
      payload: { idempotencyKey: idempotencyRef.current },
    });
    const result = await confirmShowcasePersistence({
      session,
      clubId,
      tournamentId,
      persistSetupTeamData,
      reload,
      rulesVersion: rulesVersion || session?.rulesVersion || "",
      teamsAlreadyPersisted,
      previousTeamData,
      expectedTournamentVersion,
      idempotencyKey: idempotencyRef.current,
    });
    if (!result.ok) {
      dispatch({
        type: "SAVE_FAILED",
        payload: { error: result.error || "Lưu thất bại." },
      });
      return;
    }
    dispatch({
      type: "SAVE_SUCCEEDED",
      payload: {
        savedAt: result.savedAt,
        session,
      },
    });
  }

  async function toggleProjector() {
    const el = shellRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen?.();
        dispatch({ type: "SET_PROJECTOR", payload: true });
      } else {
        await document.exitFullscreen?.();
        dispatch({ type: "SET_PROJECTOR", payload: false });
      }
    } catch {
      dispatch({ type: "SET_PROJECTOR", payload: !state.projector });
    }
  }

  if (!open && !state.open) {
    return null;
  }

  const session = state.session || fixedSessionRef.current;
  const activePreflight = state.preflight || preflight;
  const isReplay = state.mode === SHOWCASE_MODE.REPLAY;

  return (
    <Box
      ref={shellRef}
      sx={showcaseShellSx}
      role="dialog"
      aria-modal="true"
      aria-label="Lễ bốc thăm đội"
    >
      <Box sx={showcaseInnerSx}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            {isReplay ? (
              <Chip label={SHOWCASE_COPY.replayBadge} color="info" size="small" />
            ) : null}
            {state.projector ? (
              <Chip label="Trình chiếu" color="success" size="small" />
            ) : null}
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton
              color="inherit"
              aria-label={state.soundEnabled ? "Tắt âm thanh" : "Bật âm thanh"}
              onClick={() => dispatch({ type: "TOGGLE_SOUND" })}
            >
              {state.soundEnabled ? <VolumeUpIcon /> : <VolumeOffIcon />}
            </IconButton>
            <Button size="small" color="inherit" onClick={toggleProjector}>
              {state.projector ? SHOWCASE_COPY.projectorOff : SHOWCASE_COPY.projectorOn}
            </Button>
            {isReplay ? (
              <Stack direction="row" spacing={0.5}>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() =>
                    dispatch({
                      type: "GO_STAGE",
                      payload: { stage: SHOWCASE_STAGE.COUNTDOWN, countdownValue: 10 },
                    })
                  }
                >
                  Countdown
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() =>
                    dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.TEAM_REVEAL } })
                  }
                >
                  Đội
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() =>
                    dispatch({
                      type: "GO_STAGE",
                      payload: { stage: SHOWCASE_STAGE.CAPTAIN_REVEAL },
                    })
                  }
                >
                  Đội trưởng
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() =>
                    dispatch({
                      type: "GO_STAGE",
                      payload: { stage: SHOWCASE_STAGE.GROUP_REVEAL },
                    })
                  }
                >
                  Bảng
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() =>
                    dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.RESULTS } })
                  }
                >
                  Kết quả
                </Button>
              </Stack>
            ) : null}
            <IconButton color="inherit" aria-label="Đóng" onClick={() => onClose?.()}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </Stack>

        {state.stage === SHOWCASE_STAGE.PREFLIGHT ? (
          <ShowcasePreflight
            preflight={activePreflight}
            onBack={() => onClose?.()}
            onStart={handleStartFromPreflight}
          />
        ) : null}

        {state.stage === SHOWCASE_STAGE.COUNTDOWN ? (
          <ShowcaseCountdown
            value={state.countdownValue}
            paused={state.paused}
            onPause={() => dispatch({ type: "PAUSE" })}
            onResume={() => dispatch({ type: "RESUME" })}
            onSkip={() => beginProcessing()}
            canSkip={canSkipCountdown}
          />
        ) : null}

        {state.stage === SHOWCASE_STAGE.PROCESSING ? (
          <ShowcaseProcessing
            index={state.processingIndex}
            paused={state.paused}
            onPause={() => dispatch({ type: "PAUSE" })}
            onResume={() => dispatch({ type: "RESUME" })}
            onCancel={() => onClose?.()}
            canCancel={showcaseAllowsCancel(state)}
          />
        ) : null}

        {state.stage === SHOWCASE_STAGE.TEAM_REVEAL ? (
          <ShowcaseTeamReveal
            teamCards={session?.teamCards || []}
            teamIndex={state.teamRevealIndex}
            athleteIndex={state.athleteRevealIndex}
            showAll={showAllTeamsRef.current}
            paused={state.paused}
            onPause={() => dispatch({ type: "PAUSE" })}
            onResume={() => dispatch({ type: "RESUME" })}
            onPrev={() =>
              dispatch({
                type: "SET_TEAM_REVEAL",
                payload: {
                  teamRevealIndex: Math.max(0, state.teamRevealIndex - 1),
                  athleteRevealIndex: 4,
                },
              })
            }
            onNext={() => {
              if (state.athleteRevealIndex < 4) {
                dispatch({
                  type: "SET_TEAM_REVEAL",
                  payload: { athleteRevealIndex: state.athleteRevealIndex + 1 },
                });
                return;
              }
              dispatch({
                type: "SET_TEAM_REVEAL",
                payload: {
                  teamRevealIndex: Math.min(
                    (session?.teamCards?.length || 1) - 1,
                    state.teamRevealIndex + 1
                  ),
                  athleteRevealIndex: 0,
                },
              });
            }}
            onShowAll={() => {
              showAllTeamsRef.current = true;
              dispatch({
                type: "SET_TEAM_REVEAL",
                payload: {
                  teamRevealIndex: (session?.teamCards?.length || 1) - 1,
                  athleteRevealIndex: 4,
                },
              });
            }}
            onReplayTeam={() =>
              dispatch({
                type: "SET_TEAM_REVEAL",
                payload: { athleteRevealIndex: 0 },
              })
            }
            onContinue={() =>
              dispatch({
                type: "GO_STAGE",
                payload: { stage: SHOWCASE_STAGE.CAPTAIN_REVEAL },
              })
            }
          />
        ) : null}

        {state.stage === SHOWCASE_STAGE.CAPTAIN_REVEAL ? (
          <ShowcaseCaptainReveal
            teamCards={session?.teamCards || []}
            onBack={() =>
              dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.TEAM_REVEAL } })
            }
            onContinue={() =>
              dispatch({
                type: "GO_STAGE",
                payload: {
                  stage: isReplay ? SHOWCASE_STAGE.GROUP_REVEAL : SHOWCASE_STAGE.GROUP_FORMAT,
                },
              })
            }
          />
        ) : null}

        {state.stage === SHOWCASE_STAGE.GROUP_FORMAT ? (
          <ShowcaseGroupFormatSelect
            options={session?.groupOptions || []}
            engineVersion={session?.engineVersion || engineVersion}
            rulesVersion={session?.rulesVersion || rulesVersion}
            onSelect={handleSelectGroupFormat}
            onBack={() =>
              dispatch({
                type: "GO_STAGE",
                payload: { stage: SHOWCASE_STAGE.CAPTAIN_REVEAL },
              })
            }
          />
        ) : null}

        {state.stage === SHOWCASE_STAGE.GROUP_REVEAL ? (
          <ShowcaseGroupReveal
            groupCards={session?.groupSession?.groupCards || []}
            groupIndex={state.groupRevealIndex}
            showAll={showAllGroupsRef.current}
            diagnostics={session?.groupSession?.diagnostics}
            seedingMode={session?.groupSession?.seedingMode}
            engineVersion={session?.engineVersion || engineVersion}
            rulesVersion={session?.rulesVersion || rulesVersion}
            paused={state.paused}
            onPause={() => dispatch({ type: "PAUSE" })}
            onResume={() => dispatch({ type: "RESUME" })}
            onPrev={() =>
              dispatch({
                type: "SET_GROUP_REVEAL",
                payload: Math.max(0, state.groupRevealIndex - 1),
              })
            }
            onNext={() =>
              dispatch({
                type: "SET_GROUP_REVEAL",
                payload: Math.min(
                  (session?.groupSession?.groupCards?.length || 1) - 1,
                  state.groupRevealIndex + 1
                ),
              })
            }
            onShowAll={() => {
              showAllGroupsRef.current = true;
              dispatch({
                type: "SET_GROUP_REVEAL",
                payload: (session?.groupSession?.groupCards?.length || 1) - 1,
              });
            }}
            onReselectFormat={
              isReplay
                ? undefined
                : () =>
                    dispatch({
                      type: "GO_STAGE",
                      payload: { stage: SHOWCASE_STAGE.GROUP_FORMAT },
                    })
            }
            onContinue={() =>
              dispatch({
                type: "GO_STAGE",
                payload: {
                  stage: isReplay ? SHOWCASE_STAGE.RESULTS : SHOWCASE_STAGE.FINAL_REVIEW,
                },
              })
            }
          />
        ) : null}

        {state.stage === SHOWCASE_STAGE.FINAL_REVIEW ||
        state.stage === SHOWCASE_STAGE.SAVING ? (
          <ShowcaseFinalReview
            session={session}
            saving={state.saving}
            saveError={state.saveError}
            readOnly={isReplay}
            onConfirm={handleConfirmSave}
            onBackTeams={() =>
              dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.TEAM_REVEAL } })
            }
            onBackGroups={() =>
              dispatch({ type: "GO_STAGE", payload: { stage: SHOWCASE_STAGE.GROUP_REVEAL } })
            }
            onCancel={() => onClose?.()}
          />
        ) : null}

        {state.stage === SHOWCASE_STAGE.RESULTS ? (
          <ShowcaseResults
            tournamentName={tournamentName}
            session={session}
            savedAt={state.savedAt}
            draftStatus={draftStatus}
            onFullscreen={toggleProjector}
            onReplay={() =>
              dispatch({
                type: "GO_STAGE",
                payload: { stage: SHOWCASE_STAGE.TEAM_REVEAL, teamRevealIndex: 0 },
              })
            }
            onBackTournament={() => {
              onBackTournament?.();
              onClose?.();
            }}
            onContinueSetup={() => {
              onContinueSetup?.();
              onClose?.();
            }}
            canExport={false}
          />
        ) : null}
      </Box>
    </Box>
  );
}
