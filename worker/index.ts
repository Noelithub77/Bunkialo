import { handleRequest } from "./app";
import type { WorkerBindings } from "./bindings";

export { DesktopDirectory } from "./desktop/desktop-directory";
export { UserSession } from "./session-object";

export default {
  fetch: handleRequest,
} satisfies ExportedHandler<WorkerBindings>;
