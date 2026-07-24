/**
 * Messaging Experience surface (COMMS-06).
 * Prefer `publicApi.js` from Node tests; import JSX from this barrel only in React bundles.
 */

export * from "./publicApi.js";

export { MessagingExperienceProvider } from "./MessagingExperienceProvider.jsx";
export { useMessagingExperience } from "./hooks/useMessagingExperience.js";

export { default as MessagingExperiencePage } from "./MessagingExperiencePage.jsx";
