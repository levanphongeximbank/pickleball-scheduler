import { useContext } from "react";
import { CommunicationRuntimeContext } from "./communicationRuntimeContext.js";

/**
 * @returns {object}
 */
export function useCommunicationRuntime() {
  const ctx = useContext(CommunicationRuntimeContext);
  if (!ctx) {
    throw new Error(
      "useCommunicationRuntime must be used within CommunicationRuntimeProvider"
    );
  }
  return ctx;
}

/**
 * Optional hook — returns null outside provider (page-level fallback).
 * @returns {object|null}
 */
export function useCommunicationRuntimeOptional() {
  return useContext(CommunicationRuntimeContext);
}
