import ephemeralViewerUrl from '../stream-endpoint.js';

export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');

  const rawValue =
    process.env.PIXEL_STREAMING_VIEWER_URL ||
    process.env.NEXT_PUBLIC_PIXEL_STREAMING_VIEWER_URL ||
    process.env.NEXT_PUBLIC_PIXEL_STREAMING_URL ||
    ephemeralViewerUrl ||
    '';

  const value = rawValue.trim();
  let viewerUrl = '';
  let streamUrl = '';

  if (/^https?:\/\//i.test(value)) {
    viewerUrl = value;
  } else if (/^wss?:\/\//i.test(value)) {
    streamUrl = value;
    try {
      const parsed = new URL(value);
      parsed.protocol = parsed.protocol === 'wss:' ? 'https:' : 'http:';
      parsed.pathname = '/';
      parsed.search = '';
      parsed.hash = '';
      viewerUrl = parsed.toString();
    } catch {
      viewerUrl = '';
    }
  }

  response.status(200).json({
    configured: Boolean(viewerUrl),
    viewerUrl,
    streamUrl,
    source: process.env.PIXEL_STREAMING_VIEWER_URL ? 'environment' : ephemeralViewerUrl ? 'ephemeral-broadcast' : 'none',
    environment: process.env.VERCEL_ENV || 'unknown',
    commit: process.env.VERCEL_GIT_COMMIT_SHA || '',
  });
}
