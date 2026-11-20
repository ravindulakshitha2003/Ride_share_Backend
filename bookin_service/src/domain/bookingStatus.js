// =============================================================================
// BOOKING STATUS RULES  (the "state machine")
//
// This file is the single source of truth for:
//   - which statuses exist
//   - which actions exist (accept, reject, cancel, complete)
//   - WHO may perform each action
//   - FROM which status each action is allowed
//
// Keeping all rules here (instead of scattering `if (status === ...)` checks
// across controllers) means:
//   1. you can explain the whole lifecycle in your report from one file
//   2. changing a rule = changing one line
//   3. it is pure JavaScript (no DB, no Express) so it is easy to unit-test
//
//                 driver ACCEPT              driver COMPLETE
//   ┌─────────┐ ───────────────► ┌───────────┐ ───────────────► ┌───────────┐
//   │ PENDING │                  │ CONFIRMED │                  │ COMPLETED │
//   └─────────┘                  └───────────┘                  └───────────┘
//     │     │                          │
//     │     │ passenger CANCEL         │ passenger or driver CANCEL
//     │     ▼                          ▼
//     │   ┌───────────┐ ◄──────────────┘
//     │   │ CANCELLED │
//     │   └───────────┘
//     │ driver REJECT
//     ▼
//   ┌──────────┐
//   │ REJECTED │      REJECTED, CANCELLED, COMPLETED are FINAL (no way out).
//   └──────────┘
// =============================================================================

import { HttpError } from '../utils/httpError.js';

// Object.freeze stops anyone from accidentally changing these at runtime.
export const BookingStatus = Object.freeze({
  PENDING: 'PENDING', //     passenger sent request, waiting for driver
  CONFIRMED: 'CONFIRMED', // driver accepted, seat is reserved
  REJECTED: 'REJECTED', //   driver said no                 (final)
  CANCELLED: 'CANCELLED', // passenger/driver called it off  (final)
  COMPLETED: 'COMPLETED', // trip finished                   (final)
});

export const BookingAction = Object.freeze({
  ACCEPT: 'ACCEPT',
  REJECT: 'REJECT',
  CANCEL: 'CANCEL',
  COMPLETE: 'COMPLETE',
});

export const ActorRole = Object.freeze({
  PASSENGER: 'PASSENGER',
  DRIVER: 'DRIVER',
});

const { PENDING, CONFIRMED, REJECTED, CANCELLED, COMPLETED } = BookingStatus;
const { PASSENGER, DRIVER } = ActorRole;

// -----------------------------------------------------------------------------
// The transition table.
//   to          -> the status the booking moves into
//   allowedFrom -> for each role, the statuses it may perform this action from
//                  (a role that is missing is not allowed at all)
// -----------------------------------------------------------------------------
const TRANSITIONS = Object.freeze({
  [BookingAction.ACCEPT]: {
    to: CONFIRMED,
    allowedFrom: { [DRIVER]: [PENDING] },
  },

  [BookingAction.REJECT]: {
    to: REJECTED,
    allowedFrom: { [DRIVER]: [PENDING] },
  },

  [BookingAction.CANCEL]: {
    to: CANCELLED,
    allowedFrom: {
      // A passenger can withdraw a request, or cancel after it was confirmed.
      [PASSENGER]: [PENDING, CONFIRMED],
      // A driver can only cancel a CONFIRMED booking. For a PENDING request
      // the driver should REJECT instead (clearer meaning for the passenger).
      [DRIVER]: [CONFIRMED],
    },
  },

  [BookingAction.COMPLETE]: {
    to: COMPLETED,
    allowedFrom: { [DRIVER]: [CONFIRMED] },
  },
});

export const FINAL_STATUSES = Object.freeze([REJECTED, CANCELLED, COMPLETED]);

/**
 * Decide the next status, or throw if the action is not allowed.
 *
 * @param {string} action        one of BookingAction
 * @param {string} role          one of ActorRole
 * @param {string} currentStatus the booking's status RIGHT NOW (read from DB)
 * @returns {string}             the new status
 * @throws  {HttpError}          403 if this role can never do this action,
 *                               409 if the booking is in the wrong status
 */
export function resolveTransition(action, role, currentStatus) {
  const rule = TRANSITIONS[action];

  if (!rule) {
    // Programming mistake (typo in action name) -> 500 is correct here.
    throw new Error(`Unknown booking action: ${action}`);
  }

  const allowedStatuses = rule.allowedFrom[role];

  if (!allowedStatuses) {
    // e.g. a passenger trying to ACCEPT
    throw new HttpError(403, `A ${role.toLowerCase()} cannot ${action.toLowerCase()} a booking`, {
      code: 'ACTION_NOT_ALLOWED_FOR_ROLE',
    });
  }

  if (!allowedStatuses.includes(currentStatus)) {
    // e.g. driver taps ACCEPT but passenger already cancelled -> 409 Conflict.
    // The app should show the message and refresh the screen.
    throw new HttpError(
      409,
      `Cannot ${action.toLowerCase()} a booking that is ${currentStatus}`,
      { code: 'INVALID_STATUS_TRANSITION' },
    );
  }

  return rule.to;
}

/**
 * Which actions can this role do on a booking in this status?
 * Sent to the app in the details response so the screen knows which buttons
 * to show (e.g. ['ACCEPT', 'REJECT'] for a pending request).
 * The backend still re-checks on every request - never trust the app alone.
 */
export function getAllowedActions(role, currentStatus) {
  return Object.entries(TRANSITIONS)
    .filter(([, rule]) => (rule.allowedFrom[role] ?? []).includes(currentStatus))
    .map(([action]) => action);
}
