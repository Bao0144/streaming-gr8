import fs from "fs/promises";
import path from "path";

const XSLT_PATH = path.join(process.cwd(), "src", "nginx-rtmp-module", "stat.xsl");

function readTagValue(block, tagName) {
  const match = block.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`));
  return match ? match[1].trim() : "";
}

function readBlocks(source, tagName) {
  return Array.from(source.matchAll(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "g"))).map(
    (match) => match[1]
  );
}

export async function getStatsXmlPath() {
  await fs.access(XSLT_PATH);
  return "/stat";
}

export function parseRtmpStatXml(xml) {
  const applications = readBlocks(xml, "application").map((applicationBlock) => {
    const name = readTagValue(applicationBlock, "name");
    const liveBlocks = readBlocks(applicationBlock, "live");

    const live = liveBlocks.flatMap((liveBlock) =>
      readBlocks(liveBlock, "stream").map((streamBlock) => {
        const streamName = readTagValue(streamBlock, "name");
        const bandwidthIn = readTagValue(streamBlock, "bw_in");
        const bandwidthOut = readTagValue(streamBlock, "bw_out");
        const bytesIn = readTagValue(streamBlock, "bytes_in");
        const bytesOut = readTagValue(streamBlock, "bytes_out");
        const nclients = readTagValue(streamBlock, "nclients");
        const publishing = streamBlock.includes("<publishing/>");
        const active = streamBlock.includes("<active/>");

        const clientBlocks = readBlocks(streamBlock, "client");
        const clients = clientBlocks.map((clientBlock) => ({
          id: readTagValue(clientBlock, "id"),
          address: readTagValue(clientBlock, "address"),
          flashver: readTagValue(clientBlock, "flashver"),
          dropped: readTagValue(clientBlock, "dropped"),
          avsync: readTagValue(clientBlock, "avsync"),
          timestamp: readTagValue(clientBlock, "timestamp"),
          active: clientBlock.includes("<active/>"),
          publishing: clientBlock.includes("<publishing/>")
        }));

        return {
          name: streamName,
          bandwidthIn,
          bandwidthOut,
          bytesIn,
          bytesOut,
          nclients,
          publishing,
          active,
          clients
        };
      })
    );

    return {
      name,
      live
    };
  });

  return { applications };
}

export function summarizeStats(applications = []) {
  const summary = {
    applications: applications.length,
    liveStreams: 0,
    viewers: 0,
    inboundBandwidth: 0,
    outboundBandwidth: 0,
    bytesIn: 0,
    bytesOut: 0
  };

  for (const application of applications) {
    for (const stream of application.live || []) {
      summary.liveStreams += 1;
      summary.viewers += Number(stream.nclients || 0);
      summary.inboundBandwidth += Number(stream.bandwidthIn || 0);
      summary.outboundBandwidth += Number(stream.bandwidthOut || 0);
      summary.bytesIn += Number(stream.bytesIn || 0);
      summary.bytesOut += Number(stream.bytesOut || 0);
    }
  }

  return summary;
}

export async function fetchActiveLiveStreamKeys() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch("http://127.0.0.1:8080/stat", {
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      return new Set();
    }

    const xml = await response.text();
    const stats = parseRtmpStatXml(xml);
    const liveKeys = new Set();

    for (const application of stats.applications || []) {
      for (const stream of application.live || []) {
        if (stream.name) {
          liveKeys.add(stream.name);
        }
      }
    }

    return liveKeys;
  } catch {
    return new Set();
  } finally {
    clearTimeout(timeoutId);
  }
}
