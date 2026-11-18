// Each key is a "from" status.
// Its value is the list of statuses it may move TO (section 3.1).
const ALLOWED_TRANSITIONS = {
  PENDING: ['APPROVING', 'REJECTED', 'CANCELLED'],
  APPROVING: ['CONFIRMED', 'PENDING'], // back to PENDING if seats failed
  CONFIRMED: ['CANCELLING', 'COMPLETED'],
  CANCELLING: ['CANCELLED'],
  // REJECTED, CANCELLED, COMPLETED are final, so nothing is listed
};

// Throws an error if the status change is not allowed
export function assertTransition(from, to) {
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    const err = new Error(`Cannot change status from ${from} to ${to}`);
    err.status = 409; // HTTP code to send back
    err.code = 'INVALID_TRANSITION'; // shared error code (section 3.2)
    throw err;
  }
}