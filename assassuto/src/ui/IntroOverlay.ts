import { h } from './dom';

/** Letterboxed subtitles for the intro cinematic. Lines are plain text (may contain player-typed names). */
export class IntroOverlay {
  readonly root: HTMLElement;
  private line: HTMLElement;
  private speaker: HTMLElement;

  constructor(parent: HTMLElement, onSkip: () => void) {
    this.speaker = h('div', { class: 'intro-speaker' });
    this.line = h('div', { class: 'intro-line' });
    this.root = h(
      'div',
      { class: 'intro', attrs: { hidden: '' } },
      h('div', { class: 'bar top' }),
      h('div', { class: 'bar bottom' }, h('div', { class: 'intro-text' }, this.speaker, this.line)),
      h('button', { class: 'skip', text: 'Skip ›', on: { click: onSkip } }),
    );
    parent.append(this.root);
  }

  show(): void {
    this.root.hidden = false;
    requestAnimationFrame(() => this.root.classList.add('on'));
  }

  hide(): void {
    this.root.classList.remove('on');
    this.root.hidden = true;
  }

  say(speaker: string, text: string): void {
    this.speaker.textContent = speaker;
    this.line.textContent = text;
    this.line.classList.remove('fade');
    void this.line.offsetWidth;
    this.line.classList.add('fade');
  }
}
