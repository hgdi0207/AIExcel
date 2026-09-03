export {};

declare global {
  namespace Express {
    interface Request {
      user?: unknown;
      cookies?: Record<string, string>;
    }
  }
}
