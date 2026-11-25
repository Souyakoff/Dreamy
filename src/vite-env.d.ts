/// <reference types="vite/client" />
declare module 'mammoth/mammoth.browser' {
  const mammoth: {
    convertToHtml(input: { arrayBuffer: ArrayBuffer }, options?: { styleMap?: string[]; includeDefaultStyleMap?: boolean }): Promise<{ value: string; messages: unknown[] }>;
  };
  export default mammoth;
}
declare module 'page-flip' {
  export class PageFlip {
    constructor(el: HTMLElement, settings: Record<string, unknown>);
    loadFromHTML(items: NodeListOf<Element> | HTMLElement[]): void;
    on(event: 'flip' | 'changeState' | 'changeOrientation' | 'init' | 'update', cb: (e: { data: unknown }) => void): this;
    flip(page: number, corner?: 'top' | 'bottom'): void;
    flipNext(corner?: 'top' | 'bottom'): void;
    flipPrev(corner?: 'top' | 'bottom'): void;
    turnToPage(page: number): void;
    getCurrentPageIndex(): number;
    getOrientation(): 'portrait' | 'landscape';
    destroy(): void;
  }
}
