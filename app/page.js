import OnePageDashboard from "components/one-page-dashboard";
import { getAuthenticatedUser } from "lib/auth";

async function getInitialStats() {
  const response = await fetch("http://127.0.0.1:3000/api/stats", {
    cache: "no-store"
  }).catch(() => null);

  if (!response || !response.ok) {
    return {
      applications: [],
      summary: {
        applications: 0,
        liveStreams: 0,
        viewers: 0,
        inboundBandwidth: 0,
        outboundBandwidth: 0,
        bytesIn: 0,
        bytesOut: 0
      },
      fetchedAt: ""
    };
  }

  return response.json();
}

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [user, stats] = await Promise.all([
    getAuthenticatedUser(),
    getInitialStats()
  ]);

  return (
    <OnePageDashboard
      currentUser={user ? { id: user.id, username: user.username } : null}
      initialStats={stats}
    />
  );
}
