import StreamingWorkbench from "components/streaming-workbench";
import { getAuthenticatedUser } from "lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getAuthenticatedUser();

  return (
    <StreamingWorkbench
      currentUser={user ? { id: user.id, username: user.username } : null}
    />
  );
}
