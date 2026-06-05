import { listRecordings } from "lib/recordings";
import { convertRecordings } from "lib/recordings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const recordings = await listRecordings();
    return Response.json({ recordings });
  } catch (error) {
    return Response.json(
      { error: "Failed to list recordings.", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await convertRecordings({
      streamKey: body?.streamKey || ""
    });
    const recordings = await listRecordings();
    return Response.json({ ...result, recordings });
  } catch (error) {
    return Response.json(
      { error: "Failed to convert recordings.", details: error.message },
      { status: 500 }
    );
  }
}
