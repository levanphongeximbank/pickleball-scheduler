/**
 * CM-06 channel descriptor registry (audit-minimal).
 *
 * Each channel declares: identity, audienceClassification, requiredProfileId,
 * outputReferenceType, and the CM-01 visibilities it accepts. This is the
 * single source of truth for channel/visibility compatibility rules.
 */

import { COMPETITION_VISIBILITY } from "../../competition-definition/index.js";
import {
  COMPETITION_PUBLICATION_CHANNEL,
  COMPETITION_PUBLICATION_AUDIENCE_CLASSIFICATION,
  COMPETITION_PUBLICATION_OUTPUT_REFERENCE_TYPE,
  isCompetitionPublicationChannel,
} from "../constants/channels.js";
import { COMPETITION_PUBLICATION_PROFILE_ID } from "../constants/profiles.js";
import { deepFreeze } from "../contracts/shared.js";

/**
 * @typedef {Object} CompetitionPublicationChannelDescriptor
 * @property {string} identity
 * @property {string} audienceClassification
 * @property {string} requiredProfileId
 * @property {string} outputReferenceType
 * @property {readonly string[]} allowedVisibilities
 */

const CHANNEL_DESCRIPTORS = deepFreeze({
  [COMPETITION_PUBLICATION_CHANNEL.PUBLIC_PORTAL]: {
    identity: COMPETITION_PUBLICATION_CHANNEL.PUBLIC_PORTAL,
    audienceClassification: COMPETITION_PUBLICATION_AUDIENCE_CLASSIFICATION.PUBLIC,
    requiredProfileId: COMPETITION_PUBLICATION_PROFILE_ID.CM06_STANDARD_V1,
    outputReferenceType: COMPETITION_PUBLICATION_OUTPUT_REFERENCE_TYPE.PORTAL_ROUTE_REFERENCE,
    allowedVisibilities: Object.freeze([COMPETITION_VISIBILITY.PUBLIC]),
  },
  [COMPETITION_PUBLICATION_CHANNEL.SHAREABLE_LINK]: {
    identity: COMPETITION_PUBLICATION_CHANNEL.SHAREABLE_LINK,
    audienceClassification: COMPETITION_PUBLICATION_AUDIENCE_CLASSIFICATION.RESTRICTED,
    requiredProfileId: COMPETITION_PUBLICATION_PROFILE_ID.CM06_STANDARD_V1,
    outputReferenceType: COMPETITION_PUBLICATION_OUTPUT_REFERENCE_TYPE.SHAREABLE_LINK_REFERENCE,
    allowedVisibilities: Object.freeze([
      COMPETITION_VISIBILITY.CLUB,
      COMPETITION_VISIBILITY.TENANT,
      COMPETITION_VISIBILITY.PUBLIC,
    ]),
  },
});

/**
 * @param {unknown} channel
 * @returns {Readonly<CompetitionPublicationChannelDescriptor> | null}
 */
export function getCompetitionPublicationChannelDescriptor(channel) {
  if (!isCompetitionPublicationChannel(channel)) return null;
  return CHANNEL_DESCRIPTORS[/** @type {string} */ (channel)] ?? null;
}

/**
 * @param {unknown} channel
 * @param {unknown} visibility
 * @returns {boolean}
 */
export function isVisibilityAllowedForChannel(channel, visibility) {
  const descriptor = getCompetitionPublicationChannelDescriptor(channel);
  if (!descriptor) return false;
  return descriptor.allowedVisibilities.includes(/** @type {string} */ (visibility));
}

/**
 * @returns {ReadonlyArray<Readonly<CompetitionPublicationChannelDescriptor>>}
 */
export function listCompetitionPublicationChannelDescriptors() {
  return deepFreeze(Object.values(CHANNEL_DESCRIPTORS));
}
