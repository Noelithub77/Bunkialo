export type RefreshGestureDirection = "undecided" | "horizontal" | "pull" | "vertical";

/** Lock once there is a clear direction; diagonal movement stays undecided. */
export function getRefreshGestureDirection(dx: number, dy: number): RefreshGestureDirection {
  const x = Math.abs(dx);
  const y = Math.abs(dy);
  if (Math.max(x, y) < 8) return "undecided";
  if (x > y * 1.2) return "horizontal";
  if (y > x * 1.2) return dy > 0 ? "pull" : "vertical";
  return "undecided";
}
