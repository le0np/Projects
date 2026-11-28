/** Tiny DOM helpers. All user-provided text goes through textContent, never innerHTML. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { class?: string; text?: string; attrs?: Record<string, string>; on?: Partial<Record<keyof HTMLElementEventMap, (e: Event) => void>> } = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.text !== undefined) el.textContent = props.text;
  for (const [k, v] of Object.entries(props.attrs ?? {})) el.setAttribute(k, v);
  for (const [k, fn] of Object.entries(props.on ?? {})) el.addEventListener(k, fn as EventListener);
  for (const c of children) if (c) el.append(c);
  return el;
}

export const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export function toast(parent: HTMLElement, text: string, ms = 2200): void {
  const t = h('div', { class: 'toast', text });
  parent.append(t);
  requestAnimationFrame(() => t.classList.add('visible'));
  setTimeout(() => {
    t.classList.remove('visible');
    setTimeout(() => t.remove(), 400);
  }, ms);
}

export function formatPlayTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const hr = Math.floor(m / 60);
  return hr > 0 ? `${hr} h ${m % 60} min` : `${m} min`;
}
