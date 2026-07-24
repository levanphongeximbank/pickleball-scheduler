import { useContext } from "react";
import { MessagingExperienceContext } from "../messagingExperienceContext.js";

export function useMessagingExperience() {
  const ctx = useContext(MessagingExperienceContext);
  if (!ctx) {
    throw new Error(
      "useMessagingExperience must be used within MessagingExperienceProvider"
    );
  }
  return ctx;
}
