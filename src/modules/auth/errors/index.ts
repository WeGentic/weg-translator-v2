/**
 * Authentication error classes for the Tr-entic Desktop registration flow.
 *
 * This module exports custom error classes used throughout the authentication
 * and registration flows to provide type-safe error handling with rich context.
 *
 * @module auth/errors
 */

export { OrphanedUserError } from './OrphanedUserError';
export { OrphanDetectionError, type OrphanDetectionMetrics } from './OrphanDetectionError';
