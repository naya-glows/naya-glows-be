import type { NextFunction, Request, RequestHandler, Response } from "express";

// Express 4 doesn't forward rejected promises from async handlers to error
// middleware on its own — an unhandled rejection there crashes the process.
// Wrap every async route handler with this so DB/network failures become a
// normal 500 response instead of taking the whole server down.
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
