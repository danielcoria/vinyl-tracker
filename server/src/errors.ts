// ============================================================================
// errors.ts: OUR OWN ERROR TYPES
//
// Code anywhere in the server can "throw" one of these, e.g.
//   throw new NotFoundError("Record 5 not found")
// and the error handler (middleware/error-handler.ts) turns it into the
// right response for the website (here: status 404 with that message).
// ============================================================================

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
  }
}
