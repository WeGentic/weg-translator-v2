/**
 * Authentication error classes for the Tr-entic Desktop registration and login flows.
 *
 * This module exports custom error classes used throughout the authentication,
 * registration, and login flows to provide type-safe error handling with rich context.
 *
 * @module auth/errors
 */

export { OrphanedUserError } from './OrphanedUserError';
export { OrphanDetectionError, type OrphanDetectionMetrics } from './OrphanDetectionError';
export { LoginError } from './LoginError';
