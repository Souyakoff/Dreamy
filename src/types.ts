export type BlockType = 'p' | 'h' | 'sep' | 'quote' | 'img' | 'list';
export interface Block { t: BlockType; html: string }
export interface Chapter { title: string; blocks: Block[] }
export interface VolumeContent { front: Block[]; chapters: Chapter[] }

export interface VolumeMeta {
  id: string; workId: string; number: number;
  title: string; subtitle: string; summary: string; version: string;
  cover: string | null; words: number; chapterCount: number;
  createdAt: string; updatedAt: string;
}
export interface Work {
  id: string; title: string; author: string; fandom: string; summary: string;
  subtitle?: string; theme?: string; tags: string[]; status: string; cover: string | null;
  createdAt: string; updatedAt: string; volumes: VolumeMeta[];
}
export interface Volume extends VolumeMeta { content: VolumeContent; work: Omit<Work, 'volumes'> }
