export type MediaKind = 'image' | 'video';
export function validateMediaUpload(file: File, maxVideoBytes?: number): { kind: MediaKind | null; error: string | null };
export function validateImageUpload(file: File): string | null;
