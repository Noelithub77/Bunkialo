import type { DesktopDirectory } from "./desktop/desktop-directory";
import type { UserSession } from "./session-object";

export type WorkerBindings = Omit<Env, "USER_SESSION" | "DESKTOP_DIRECTORY"> & {
  USER_SESSION: DurableObjectNamespace<UserSession>;
  DESKTOP_DIRECTORY: DurableObjectNamespace<DesktopDirectory>;
};
