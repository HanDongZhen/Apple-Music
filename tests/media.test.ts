import { describe, expect, it, vi } from 'vitest';
import { parseRange } from '../cloudflare/range';
import worker, { serveMedia, type Env } from '../cloudflare/worker';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

describe('HTTP Range parser', () => {
  it.each([
    ['bytes=0-0', 10, { offset: 0, length: 1 }],
    ['bytes=2-', 10, { offset: 2, length: 8 }],
    ['bytes=-3', 10, { offset: 7, length: 3 }],
    ['bytes=5-100', 10, { offset: 5, length: 5 }],
    ['bytes=-100', 10, { offset: 0, length: 10 }],
  ])('%s', (header, size, expected) => {
    expect(parseRange(header, size)).toEqual(expected);
  });
  it.each([
    'bytes=10-',
    'bytes=6-5',
    'bytes=-0',
    'bytes=-',
    'bytes=0-1,3-4',
    'bytes=9007199254740993-',
    'items=0-2',
    'bytes=1.5-2',
  ])('rejects %s', (value) => {
    expect(parseRange(value, 10)).toBeNull();
  });
  it('rejects ranges on empty objects', () => {
    expect(parseRange('bytes=0-', 0)).toBeNull();
  });
});
const metadata = {
  size: 10,
  etag: 'abc',
  httpEtag: '"abc"',
  uploaded: new Date('2025-01-01T00:00:00Z'),
};
function environment() {
  const head = vi.fn().mockResolvedValue(metadata);
  const get = vi.fn().mockImplementation((_key, options) => {
    const data = new TextEncoder().encode('0123456789');
    const range = options.range;
    return {
      ...metadata,
      body: new Blob([
        range ? data.slice(range.offset, range.offset + range.length) : data,
      ]).stream(),
    };
  });
  return {
    env: {
      MUSIC: { head, get },
      APP_ORIGIN: 'https://music.example.com',
      ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com',
      ACCESS_AUD: 'private',
    } as unknown as Env,
    head,
    get,
  };
}
describe('private media service', () => {
  it('streams 206 with exact bytes and headers', async () => {
    const { env, get } = environment();
    const response = await serveMedia(
      new Request('https://music.example.com/media/music/a.wav', {
        headers: { Range: 'bytes=2-5' },
      }),
      env,
    );
    expect(response.status).toBe(206);
    expect(response.headers.get('Content-Range')).toBe('bytes 2-5/10');
    expect(response.headers.get('Content-Length')).toBe('4');
    expect(response.headers.get('Content-Type')).toBe('audio/wav');
    expect(await response.text()).toBe('2345');
    expect(get.mock.calls[0][1].range).toEqual({ offset: 2, length: 4 });
  });
  it('handles HEAD without fetching the body', async () => {
    const { env, get } = environment();
    const response = await serveMedia(
      new Request('https://music.example.com/media/music/a.wav', { method: 'HEAD' }),
      env,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Length')).toBe('10');
    expect(get).not.toHaveBeenCalled();
  });
  it('returns 416 with the complete object size', async () => {
    const { env, get } = environment();
    const response = await serveMedia(
      new Request('https://music.example.com/media/music/a.wav', {
        headers: { Range: 'bytes=20-' },
      }),
      env,
    );
    expect(response.status).toBe(416);
    expect(response.headers.get('Content-Range')).toBe('bytes */10');
    expect(get).not.toHaveBeenCalled();
  });
  it('ignores stale If-Range, supports conditional requests', async () => {
    const { env } = environment();
    expect(
      (
        await serveMedia(
          new Request('https://music.example.com/media/music/a.wav', {
            headers: { Range: 'bytes=2-3', 'If-Range': '"old"' },
          }),
          env,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await serveMedia(
          new Request('https://music.example.com/media/music/a.wav', {
            headers: { 'If-None-Match': '"abc"' },
          }),
          env,
        )
      ).status,
    ).toBe(304);
  });
  it('rejects unapproved origins, methods, paths and missing objects', async () => {
    const { env, head } = environment();
    expect(
      (
        await serveMedia(
          new Request('https://music.example.com/media/music/a.wav', {
            headers: { Origin: 'https://evil.example' },
          }),
          env,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await serveMedia(
          new Request('https://music.example.com/media/music/a.wav', { method: 'POST' }),
          env,
        )
      ).status,
    ).toBe(405);
    expect(
      (await serveMedia(new Request('https://music.example.com/media/secrets/key'), env)).status,
    ).toBe(404);
    head.mockResolvedValue(null);
    expect(
      (await serveMedia(new Request('https://music.example.com/media/music/missing.wav'), env))
        .status,
    ).toBe(404);
  });
  it('fails closed without Access config or valid JWT', async () => {
    const { env, head } = environment();
    expect(
      (
        await worker.fetch(new Request('https://music.example.com/media/music/a.wav'), {
          ...env,
          ACCESS_AUD: '',
        })
      ).status,
    ).toBe(503);
    expect(
      (await worker.fetch(new Request('https://music.example.com/media/music/a.wav'), env)).status,
    ).toBe(403);
    expect(
      (
        await worker.fetch(
          new Request('https://music.example.com/media/music/a.wav', {
            headers: { 'Cf-Access-Jwt-Assertion': 'forged.jwt.here' },
          }),
          env,
        )
      ).status,
    ).toBe(403);
    expect(head).not.toHaveBeenCalled();
  });
  it('cryptographically verifies issuer, audience and expiry before allowing R2 access', async () => {
    const { env, head } = environment();
    env.ACCESS_TEAM_DOMAIN = 'verified-team.cloudflareaccess.com';
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const key = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ keys: [key] })));
    try {
      const token = await new SignJWT({ email: 'owner@example.test' })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer('https://verified-team.cloudflareaccess.com')
        .setAudience('private')
        .setExpirationTime('5m')
        .sign(privateKey);
      const response = await worker.fetch(
        new Request('https://music.example.com/media/music/a.wav', {
          headers: { 'Cf-Access-Jwt-Assertion': token },
        }),
        env,
      );
      expect(response.status).toBe(200);
      expect(head).toHaveBeenCalledOnce();
      const wrongAudience = await new SignJWT({})
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer('https://verified-team.cloudflareaccess.com')
        .setAudience('another-app')
        .setExpirationTime('5m')
        .sign(privateKey);
      expect(
        (
          await worker.fetch(
            new Request('https://music.example.com/media/music/a.wav', {
              headers: { 'Cf-Access-Jwt-Assertion': wrongAudience },
            }),
            env,
          )
        ).status,
      ).toBe(403);
      const expired = await new SignJWT({})
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer('https://verified-team.cloudflareaccess.com')
        .setAudience('private')
        .setExpirationTime(1)
        .sign(privateKey);
      expect(
        (
          await worker.fetch(
            new Request('https://music.example.com/media/music/a.wav', {
              headers: { 'Cf-Access-Jwt-Assertion': expired },
            }),
            env,
          )
        ).status,
      ).toBe(403);
      expect(head).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
