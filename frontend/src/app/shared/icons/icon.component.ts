import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

const PATHS: Record<string, string> = {
  link: 'M10 13a5 5 0 0 0 7 .2l3-3a5 5 0 0 0-7-7l-2 2 M14 11a5 5 0 0 0-7-.2l-3 3a5 5 0 0 0 7 7l2-2',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  chart: 'M4 4v16h17 M8 15l4-5 4 2 5-7',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  arrowUp: 'M7 17 17 7 M7 7h10v10',
  plus: 'M12 5v14 M5 12h14',
  chevron: 'm9 5 7 7-7 7',
  down: 'm6 9 6 6 6-6',
  copy: 'M9 9h11v12H9z M15 9V3H3v12h6',
  check: 'm5 12 4 4L19 6',
  search: 'M20 20l-5-5 M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14',
  globe: 'M21 12H3 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 3a18 18 0 0 0 0 18 18 18 0 0 0 0-18',
  clock: 'M12 7v5l3 2 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',
  cursor: 'm4 3 6 17 3-7 7-3z M13 13l6 6',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6z m-4 9 3 3 5-6',
  help: 'M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3 M12 17h.01 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',
  close: 'm6 6 12 12 M6 18 18 6',
  logout: 'M9 4H4v16h5 M10 12h11 m-4-4 4 4-4 4',
  refresh: 'M20 7a9 9 0 1 0 1 8 M20 3v5h-5',
  pause: 'M8 5v14 M16 5v14',
  play: 'm7 4 14 8-14 8z',
  spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  calendar: 'M5 5h14v16H5z M8 3v4 M16 3v4 M5 10h14',
  info: 'M12 11v6 M12 7h.01 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',
  folder: 'M3 6h7l2 3h9v11H3z',
  bolt: 'm13 2-9 12h7l-1 8 10-13h-7z'
};

@Component({
  selector: 'app-icon', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="path" /></svg>',
  styles: [':host { display:inline-flex; width:1.25rem; height:1.25rem; flex-shrink:0; } svg { width:100%; height:100%; }']
})
export class IconComponent {
  @Input() name = 'link';
  get path(): string { return PATHS[this.name] ?? PATHS['link']; }
}
