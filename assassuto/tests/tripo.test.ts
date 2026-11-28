import { describe, expect, it, vi } from 'vitest';
import { TripoClient, TripoError } from '../tools/tripo/client';
import { matchClips } from '../tools/tripo/clips';
import { chunk, loadManifest, validateManifest } from '../tools/tripo/manifest';

function fakeFetch(responses: { status?: number; body: unknown; headers?: Record<string, string> }[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const r = responses.shift()!;
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: r.headers });
  });
  return { f: f as unknown as typeof fetch, calls };
}

describe('TripoClient', () => {
  it('creates a text-to-model task with bearer auth on the v3 endpoint', async () => {
    const { f, calls } = fakeFetch([{ body: { code: 0, data: { task_id: 't1' } } }]);
    const c = new TripoClient({ apiKey: 'k', fetch: f });
    const id = await c.textToModel({ prompt: 'a fox', model: 'v3.1-20260211' });
    expect(id).toBe('t1');
    expect(calls[0].url).toBe('https://openapi.tripo3d.ai/v3/generation/text-to-model');
    expect((calls[0].init!.headers as Record<string, string>).Authorization).toBe('Bearer k');
    expect(JSON.parse(calls[0].init!.body as string)).toEqual({ prompt: 'a fox', model: 'v3.1-20260211' });
  });

  it('polls until success and returns the output', async () => {
    const { f } = fakeFetch([
      { body: { code: 0, data: { task_id: 't', type: 'animate_rig', status: 'queued' } } },
      { body: { code: 0, data: { task_id: 't', type: 'animate_rig', status: 'running', progress: 50 } } },
      { body: { code: 0, data: { task_id: 't', type: 'animate_rig', status: 'success', output: { model_url: 'https://x/m.glb' } } } },
    ]);
    const c = new TripoClient({ apiKey: 'k', fetch: f, sleep: async () => {} });
    const t = await c.wait('t');
    expect(t.output?.model_url).toBe('https://x/m.glb');
  });

  it('throws on failed tasks and API errors', async () => {
    const failed = fakeFetch([{ body: { code: 0, data: { task_id: 't', type: 'x', status: 'failed', error_message: 'bad' } } }]);
    await expect(new TripoClient({ apiKey: 'k', fetch: failed.f }).wait('t')).rejects.toThrow(/failed/);
    const err = fakeFetch([{ status: 401, body: { code: 1002, message: 'unauthorized' } }]);
    await expect(new TripoClient({ apiKey: 'k', fetch: err.f }).balance()).rejects.toBeInstanceOf(TripoError);
  });

  it('retries after 429 using Retry-After', async () => {
    const { f } = fakeFetch([
      { status: 429, body: { code: 2000, message: 'busy' }, headers: { 'Retry-After': '1' } },
      { body: { code: 0, data: { balance: 100, frozen: 0 } } },
    ]);
    const sleeps: number[] = [];
    const c = new TripoClient({ apiKey: 'k', fetch: f, sleep: async (ms) => void sleeps.push(ms) });
    expect((await c.balance()).balance).toBe(100);
    expect(sleeps).toEqual([1000]);
  });

  it('refuses more than five animations per retarget', () => {
    const c = new TripoClient({ apiKey: 'k', fetch: fakeFetch([]).f });
    expect(() => c.retarget({ input: 'r', animations: ['a', 'b', 'c', 'd', 'e', 'f'] })).toThrow();
  });
});

describe('manifest', () => {
  it('is valid', () => {
    expect(validateManifest(loadManifest())).toEqual([]);
  });

  it('batches animations in fives', () => {
    expect(chunk([1, 2, 3, 4, 5, 6, 7], 5)).toEqual([[1, 2, 3, 4, 5], [6, 7]]);
  });

  it('maps clips by preset name, preferring longer names, and falls back to request order', () => {
    const req: [string, string][] = [
      ['jump', 'preset:biped:jump'],
      ['jump_down', 'preset:biped:jump_down'],
    ];
    expect(matchClips(['Armature|jump_down', 'Armature|jump'], req)).toEqual(['jump_down', 'jump']);
    expect(matchClips(['Clip0', 'Clip1'], req)).toEqual(['jump', 'jump_down']);
  });
});

describe('hashSpec', () => {
  it('ignores fields that do not change the generated model (regression: yawOffset caused a paid regeneration)', async () => {
    const { hashSpec } = await import('../tools/tripo/manifest');
    const m = loadManifest();
    const a = m.assets[0];
    const h = hashSpec(m, a);
    expect(hashSpec({ ...m, defaults: { ...m.defaults, yawOffset: 1.23 } }, { ...a, targetHeight: 9, yawOffset: 3 })).toBe(h);
    expect(hashSpec(m, { ...a, prompt: a.prompt + ' with a hat' })).not.toBe(h);
  });
});
