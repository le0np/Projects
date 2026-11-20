/**
 * Minimal Tripo REST API v3 client (https://developers.tripo3d.ai/en/docs).
 * One endpoint per operation; every task is polled through GET /tasks/{id}.
 */
export const TRIPO_BASE = 'https://openapi.tripo3d.ai/v3';

export type TaskStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled' | 'banned' | 'expired' | 'unknown';

export interface TaskInfo {
  task_id: string;
  type: string;
  status: TaskStatus;
  progress?: number;
  output?: { model_url?: string; rendered_image_url?: string; riggable?: boolean; rig_type?: string; [k: string]: unknown };
  error_code?: number;
  error_message?: string;
  credits_consumed?: number;
}

export class TripoError extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly status?: number,
  ) {
    super(message);
  }
}

type FetchLike = typeof fetch;

export interface ClientOptions {
  apiKey: string;
  fetch?: FetchLike;
  base?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  log?: (msg: string) => void;
}

const TERMINAL: TaskStatus[] = ['success', 'failed', 'cancelled', 'banned', 'expired'];

export class TripoClient {
  private f: FetchLike;
  private base: string;
  private sleep: (ms: number) => Promise<void>;
  private log: (msg: string) => void;

  constructor(private readonly opts: ClientOptions) {
    if (!opts.apiKey) throw new TripoError('Missing TRIPO_API_KEY');
    this.f = opts.fetch ?? fetch;
    this.base = opts.base ?? TRIPO_BASE;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.log = opts.log ?? (() => {});
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown, attempt = 0): Promise<T> {
    const res = await this.f(`${this.base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
    if (res.status === 429 && attempt < 6) {
      const retry = Number(res.headers.get('Retry-After')) || 2 ** attempt;
      this.log(`rate limited, retrying in ${retry}s`);
      await this.sleep(retry * 1000);
      return this.request<T>(method, path, body, attempt + 1);
    }
    let json: { code?: number; data?: T; message?: string; suggestion?: string };
    try {
      json = await res.json();
    } catch {
      throw new TripoError(`HTTP ${res.status} with non-JSON body on ${path}`, undefined, res.status);
    }
    if (!res.ok || json.code !== 0) {
      throw new TripoError(`${path}: ${json.message ?? 'error'}${json.suggestion ? ` (${json.suggestion})` : ''}`, json.code, res.status);
    }
    return json.data as T;
  }

  balance(): Promise<{ balance: number; frozen: number }> {
    return this.request('GET', '/account/balance');
  }

  async uploadImage(bytes: Uint8Array, filename: string, mime: string): Promise<string> {
    const form = new FormData();
    form.append('file', new Blob([bytes as BlobPart], { type: mime }), filename);
    const data = await this.request<{ file_token: string }>('POST', '/files', form);
    return data.file_token;
  }

  private async create(path: string, body: Record<string, unknown>): Promise<string> {
    const data = await this.request<{ task_id: string }>('POST', path, body);
    return data.task_id;
  }

  textToModel(body: { prompt: string; negative_prompt?: string; model: string; [k: string]: unknown }) {
    return this.create('/generation/text-to-model', body);
  }

  imageToModel(body: { input: string; model: string; [k: string]: unknown }) {
    return this.create('/generation/image-to-model', body);
  }

  rigCheck(input: string) {
    return this.create('/animations/rig-check', { input });
  }

  rig(body: { input: string; model?: string; rig_type?: string; spec?: string; out_format?: 'glb' | 'fbx' }) {
    return this.create('/animations/rig', body);
  }

  retarget(body: { input: string; animations: string[]; out_format?: 'glb' | 'fbx'; export_with_geometry?: boolean; animate_in_place?: boolean }) {
    if (body.animations.length === 0 || body.animations.length > 5) throw new TripoError('retarget takes 1..5 animations');
    return this.create('/animations/retarget', body);
  }

  getTask(id: string): Promise<TaskInfo> {
    return this.request('GET', `/tasks/${id}`);
  }

  /** Polls until the task reaches a terminal state. Throws unless it succeeded. */
  async wait(id: string, label = id): Promise<TaskInfo> {
    const interval = this.opts.pollIntervalMs ?? 2000;
    const deadline = Date.now() + (this.opts.timeoutMs ?? 20 * 60 * 1000);
    let lastProgress = -1;
    for (;;) {
      const t = await this.getTask(id);
      if (t.progress !== undefined && t.progress !== lastProgress) {
        lastProgress = t.progress;
        this.log(`${label}: ${t.status} ${t.progress}%`);
      }
      if (TERMINAL.includes(t.status)) {
        if (t.status !== 'success') throw new TripoError(`${label} ended as ${t.status}: ${t.error_message ?? ''}`, t.error_code);
        return t;
      }
      if (Date.now() > deadline) throw new TripoError(`${label} timed out (last status ${t.status})`);
      await this.sleep(interval);
    }
  }

  /** Output URLs expire within minutes, so download right after the task finishes. */
  async download(url: string): Promise<Uint8Array> {
    const res = await this.f(url);
    if (!res.ok) throw new TripoError(`download failed: HTTP ${res.status}`, undefined, res.status);
    return new Uint8Array(await res.arrayBuffer());
  }
}
