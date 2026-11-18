// Sends a success response in the shared format (section 3.2)
export const ok = (res, status, message, data) =>
  res.status(status).json({ success: true, message, data });

// Sends an error response in the shared format (section 3.2)
export const fail = (res, status, code, message) =>
  res.status(status).json({ success: false, error: { code, message } });