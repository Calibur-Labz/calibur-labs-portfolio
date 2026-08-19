/**
 * ORBI — public surface.
 *
 * Phase 1 is the visual companion; Phase 2 adds scroll awareness and
 * section-driven reactions. Still no AI, no network, no persistence — every
 * behaviour is deterministic and derived from page state.
 *
 * Import from here rather than reaching into internals.
 */
export { default as OrbiGuide } from './OrbiGuide'
export { default as OrbiRobot } from './OrbiRobot'
export { default as OrbiFace } from './OrbiFace'
export { default as OrbiSpeech } from './OrbiSpeech'
export { useOrbi } from './OrbiContext'
export { useOrbiSection } from './useOrbiSection'
export {
  useOrbiPlacement,
  useOrbiBreakpoint,
  useFinePointer,
  useReducedMotion,
} from './useOrbiMedia'
export {
  ORBI_SECTION_BEHAVIORS,
  resolveSectionAnimation,
} from './orbiSections'
export { useOrbiEnvironment } from './useOrbiEnvironment'
export type {
  OrbiEnvironmentApi,
  OrbiEnvironmentDecision,
} from './useOrbiEnvironment'
export type { OrbiDockScore, OrbiRegion } from './orbiDocks'
export type { OrbiGaze } from './OrbiFace'
export type { OrbiScrollDirection } from './useOrbiScroll'
export type {
  OrbiCtaSignal,
  OrbiDrowsiness,
  OrbiProximity,
} from './useOrbiInteraction'
export type {
  OrbiBubblePlacement,
  OrbiDock,
  OrbiGazeSource,
  OrbiRegionTheme,
} from './orbiConfig'
export type {
  OrbiAnimation,
  OrbiBreakpoint,
  OrbiController,
  OrbiExpression,
  OrbiPlacement,
  OrbiPriorityName,
  OrbiSayOptions,
  OrbiSectionBehavior,
  OrbiState,
  OrbiStatePatch,
} from './orbiConfig'
export {
  ORBI_CLICK_MESSAGES,
  ORBI_COOLDOWNS,
  ORBI_DOCKS,
  ORBI_ENVIRONMENT,
  ORBI_SELECTORS,
  ORBI_DEBUG,
  ORBI_INTERACTION,
  ORBI_MESSAGES,
  ORBI_PLACEMENT,
  ORBI_PRIORITY,
  ORBI_SCROLL,
  ORBI_TIMING,
  holdsEyes,
  isLookAnimation,
  isOneShotAnimation,
  isRestingAnimation,
} from './orbiConfig'
