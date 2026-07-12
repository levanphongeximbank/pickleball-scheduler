/**
 * Draw strategy domain typedefs — CC-04C foundation.
 *
 * @typedef {Object} DrawStrategyDefinition
 * @property {string} id
 * @property {string} name
 * @property {string} distributionType
 * @property {boolean} requiresSeed
 * @property {boolean} supportsConstraints
 * @property {boolean} supportsBalance
 * @property {boolean} supportsRandomization
 * @property {boolean} supportsManualPlacement
 * @property {boolean} supportsGroups
 * @property {boolean} supportsByes
 * @property {boolean} supportsTeams
 * @property {string} [legacyKey]
 * @property {Record<string, unknown>} [metadata]
 *
 * @typedef {Object} DrawConfiguration
 * @property {string|null} drawMode
 * @property {number|null} groupCount
 * @property {number|null} courtCount
 * @property {unknown} randomSeed
 * @property {string|null} ruleSetVersion
 * @property {Record<string, unknown>} [options]
 *
 * @typedef {Object} StrategySelection
 * @property {string} strategyId
 * @property {string} distributionType
 * @property {string|null} reason
 * @property {DrawStrategyDefinition|null} strategy
 *
 * @typedef {Object} DistributionPolicy
 * @property {string} type
 * @property {boolean} deterministic
 * @property {number|null} maxRetries
 * @property {Record<string, unknown>} [params]
 *
 * @typedef {Object} ConstraintPolicy
 * @property {boolean} enabled
 * @property {string[]} categories
 * @property {boolean} repairAllowed
 * @property {Record<string, unknown>} [params]
 *
 * @typedef {Object} BalancePolicy
 * @property {boolean} enabled
 * @property {string|null} metric
 * @property {number|null} targetSpread
 * @property {Record<string, unknown>} [params]
 *
 * @typedef {Object} SeedPolicy
 * @property {boolean} required
 * @property {string|null} sourcePreference
 * @property {boolean} allowManualOverride
 * @property {Record<string, unknown>} [params]
 *
 * @typedef {Object} DrawPlacement
 * @property {string|null} entryId
 * @property {string|null} teamId
 * @property {string|null} groupId
 * @property {number|null} groupIndex
 * @property {number|null} seedNumber
 * @property {number|null} slotIndex
 * @property {Record<string, unknown>} [metadata]
 *
 * @typedef {Object} DistributionStep
 * @property {number} order
 * @property {string} action
 * @property {string|null} entryId
 * @property {string|null} groupId
 * @property {string|null} reason
 * @property {Record<string, unknown>} [details]
 *
 * @typedef {Object} StrategyDrawAudit
 * @property {DrawStrategyDefinition|null} strategy
 * @property {string} distributionType
 * @property {boolean} seedUsed
 * @property {Record<string, unknown>} constraintSummary
 * @property {Record<string, unknown>} balanceSummary
 * @property {unknown} randomSeed
 * @property {string} engineVersion
 * @property {string|null} recordedAt
 *
 * @typedef {Object} StrategyDrawRequest
 * @property {string|null} tournamentId
 * @property {string|null} eventId
 * @property {string|null} clubId
 * @property {DrawConfiguration} configuration
 * @property {StrategySelection} [selection]
 * @property {DistributionPolicy} [distributionPolicy]
 * @property {ConstraintPolicy} [constraintPolicy]
 * @property {BalancePolicy} [balancePolicy]
 * @property {SeedPolicy} [seedPolicy]
 * @property {Array<Record<string, unknown>>} [entries]
 * @property {Array<Record<string, unknown>>} [seeds]
 * @property {Record<string, unknown>} [options]
 *
 * @typedef {Object} StrategyDrawResult
 * @property {boolean} ok
 * @property {import('../drawTypes.js').DrawGroup[]} groups
 * @property {DrawPlacement[]} placements
 * @property {DistributionStep[]} distributionSteps
 * @property {string[]} warnings
 * @property {import('../drawTypes.js').DrawExplanation[]} explanations
 * @property {StrategyDrawAudit} [audit]
 * @property {Record<string, unknown>} [metadata]
 */

export {};
