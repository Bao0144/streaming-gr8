import { parseRtmpStatXml, summarizeStats } from "lib/stats";
import { listStreams } from "lib/db";

export async function GET() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    const response = await fetch("http://127.0.0.1:8080/stat", {
      cache: "no-store",
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return Response.json(
        { error: "Failed to fetch Nginx stat endpoint." },
        { status: response.status }
      );
    }

    const xml = await response.text();
    const stats = parseRtmpStatXml(xml);
    const streams = await listStreams();
    const watchPathByKey = new Map(
      streams.map((stream) => [stream.streamKey, `/watch/${stream.watchSlug || stream.streamKey}`])
    );

    const applications = (stats.applications || []).map((application) => ({
      ...application,
      live: (application.live || []).map((stream) => ({
        ...stream,
        watchPath: watchPathByKey.get(stream.name) || `/watch/${stream.name}`
      }))
    }));
    const summary = summarizeStats(applications || []);

    return Response.json({
      ...stats,
      applications,
      summary,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    return Response.json(
      { error: "Failed to read streaming stats.", details: error.message, unavailable: true },
      { status: 503 }
    );
  }
}
