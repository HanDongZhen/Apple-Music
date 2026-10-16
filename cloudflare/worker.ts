import { createRemoteJWKSet, jwtVerify } from 'jose';
import { parseRange } from './range';
import type { R2Bucket } from '@cloudflare/workers-types';

export interface Env {
  MUSIC: R2Bucket;
  APP_ORIGIN: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
}
const verifiers = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
async function authorized(request: Request, env: Env) {
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/i.test(env.ACCESS_TEAM_DOMAIN || '') || !env.ACCESS_AUD)
    return false;
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return false;
  const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
  let verifier = verifiers.get(issuer);
  if (!verifier) {
    verifier = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    verifiers.set(issuer, verifier);
  }
  try {
    await jwtVerify(token, verifier, { issuer, audience: env.ACCESS_AUD, algorithms: ['RS256'] });
    return true;
  } catch {
    return false;
  }
}
function mediaType(key: string) {
  const ext = key.split('.').pop()?.toLowerCase() || '';
  return (
    (
      {
        flac: 'audio/flac',
        wav: 'audio/wav',
        mp3: 'audio/mpeg',
        m4a: 'audio/mp4',
        aac: 'audio/aac',
        ogg: 'audio/ogg',
        opus: 'audio/ogg',
        aiff: 'audio/aiff',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        svg: 'image/svg+xml',
        lrc: 'text/plain; charset=utf-8',
        json: 'application/json',
      } as Record<string, string>
    )[ext] || 'application/octet-stream'
  );
}
export async function serveMedia(request: Request, env: Env): Promise<Response> {
  const headers = new Headers({
    'Access-Control-Allow-Origin': env.APP_ORIGIN,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Expose-Headers':
      'Accept-Ranges, Content-Range, Content-Length, Content-Type, ETag',
    Vary: 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  });
  const error = (message: string, status: number) => new Response(message, { status, headers });
  const origin = request.headers.get('Origin');
  if (!env.APP_ORIGIN || (origin && origin !== env.APP_ORIGIN))
    return error('Origin not allowed', 403);
  if (request.method === 'OPTIONS') {
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set(
      'Access-Control-Allow-Headers',
      'Range, If-Range, If-None-Match, If-Modified-Since',
    );
    headers.set('Access-Control-Max-Age', '86400');
    return new Response(null, { status: 204, headers });
  }
  if (!['GET', 'HEAD'].includes(request.method)) {
    headers.set('Allow', 'GET, HEAD, OPTIONS');
    return error('Method not allowed', 405);
  }
  let key: string;
  try {
    const path = new URL(request.url).pathname;
    if (!path.startsWith('/media/')) return error('Not found', 404);
    key = decodeURIComponent(path.slice(7));
  } catch {
    return error('Invalid path', 400);
  }
  if (
    !key ||
    /[\\\0]/.test(key) ||
    key.split('/').some((part) => part === '..' || part === '.' || !part) ||
    !/^(music\/|artwork\/|lyrics\/|library\.json$)/.test(key)
  )
    return error('Not found', 404);
  const metadata = await env.MUSIC.head(key);
  if (!metadata) return error('Media not found', 404);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('ETag', metadata.httpEtag);
  headers.set('Last-Modified', metadata.uploaded.toUTCString());
  headers.set('Content-Type', mediaType(key));
  if (
    request.headers
      .get('If-None-Match')
      ?.split(',')
      .map((value) => value.trim())
      .some((value) => value === metadata.httpEtag || value === '*')
  )
    return new Response(null, { status: 304, headers });
  let rangeHeader = request.headers.get('Range');
  const ifRange = request.headers.get('If-Range');
  if (
    ifRange &&
    ifRange !== metadata.httpEtag &&
    Date.parse(ifRange) < Math.floor(metadata.uploaded.getTime() / 1000) * 1000
  )
    rangeHeader = null;
  if (ifRange && ifRange !== metadata.httpEtag && Number.isNaN(Date.parse(ifRange)))
    rangeHeader = null;
  const range = rangeHeader ? parseRange(rangeHeader, metadata.size) : undefined;
  if (range === null) {
    headers.set('Content-Range', `bytes */${metadata.size}`);
    return error('Range not satisfiable', 416);
  }
  const length = range ? range.length : metadata.size;
  headers.set('Content-Length', String(length));
  if (range)
    headers.set(
      'Content-Range',
      `bytes ${range.offset}-${range.offset + range.length - 1}/${metadata.size}`,
    );
  const status = range ? 206 : 200;
  if (request.method === 'HEAD') return new Response(null, { status, headers });
  const object = await env.MUSIC.get(key, {
    range: range || undefined,
    onlyIf: { etagMatches: metadata.etag },
  });
  if (!object) {
    headers.delete('Content-Length');
    return error('Media not found', 404);
  }
  if (!('body' in object)) {
    headers.delete('Content-Length');
    return error('Media changed during request. Retry.', 412);
  }
  // Stream directly from R2. Never buffer a large WAV in Worker memory.
  // R2 and browser test environments implement the same byte-stream protocol;
  // their declaration packages differ on the optional final reader value.
  return new Response(object.body as unknown as ReadableStream<Uint8Array>, { status, headers });
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.APP_ORIGIN)
      return new Response('Private media service is not configured', {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      });
    if (request.method !== 'OPTIONS' && !(await authorized(request, env)))
      return new Response('Access denied', {
        status: 403,
        headers: { 'Cache-Control': 'no-store' },
      });
    try {
      return await serveMedia(request, env);
    } catch {
      return new Response('Media temporarily unavailable. Please retry.', {
        status: 503,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': '5' },
      });
    }
  },
};
