// =============================================================================
// HttpError
// A normal JavaScript Error that also carries an HTTP status code.
//
// Why? Deep inside the service layer we discover problems like "booking not
// found" (404) or "booking is already cancelled" (409). Instead of passing
// `res` all the way down, we just `throw new HttpError(404, '...')`.
// The controller's try/catch sends it to next(error), and the existing
// errorHandler middleware turns `error.status` + `error.message` into JSON.
// =============================================================================

export class HttpError extends Error {
  /**
   * @param {number} status   HTTP status code (400, 403, 404, 409, ...)
   * @param {string} message  Message that is safe to show to the app user
   * @param {object} [extra]  Optional extra fields, e.g. { code, errors }
   */
  constructor(status, message, extra = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;

    // `code` is a short machine-readable string (e.g. 'INVALID_TRANSITION').
    // The mobile app can switch on it instead of comparing message text.
    this.code = extra.code;

    // `errors` is used for validation problems: [{ field, message }]
    this.errors = extra.errors;
  }
}
