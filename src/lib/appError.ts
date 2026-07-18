// Thrown deliberately by service code for expected, user-facing failures
// (e.g. "email already exists"). Anything else that escapes a route handler
// is treated as unexpected and never shown to the client verbatim.
export class AppError extends Error {}
