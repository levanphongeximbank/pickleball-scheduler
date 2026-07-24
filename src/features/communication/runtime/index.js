/**
 * Communication runtime surface (COMMS-07).
 * Prefer `publicApi.js` from Node tests; import JSX from this barrel only in React bundles.
 */

export * from "./publicApi.js";

export { CommunicationRuntimeProvider } from "./CommunicationRuntimeProvider.jsx";
export { CommunicationRuntimeContext } from "./communicationRuntimeContext.js";
export {
  useCommunicationRuntime,
  useCommunicationRuntimeOptional,
} from "./useCommunicationRuntime.js";
