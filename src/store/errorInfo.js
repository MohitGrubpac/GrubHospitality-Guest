/** Serialisable error shape kept in state (callers still receive the real ApiError). */
export function toErrorInfo(error) {
  if (!error) return null;
  return {
    message: error.message || "Something went wrong.",
    status: typeof error.status === "number" ? error.status : 0,
    code: error.code || "UNKNOWN_ERROR",
  };
}
