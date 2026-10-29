const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);
const VIDEO_EXTENSIONS = new Set(['avi', 'm4v', 'mkv', 'mov', 'mp4', 'ogg', 'ogv', 'webm']);

export function validateMediaUpload(file, maxVideoBytes = 50 * 1024 * 1024) {
  const extension = file.name?.split('.').pop()?.toLowerCase() ?? '';
  const isImage = IMAGE_EXTENSIONS.has(extension);
  const isVideo = VIDEO_EXTENSIONS.has(extension);

  if (isImage) {
    if (file.size > 5 * 1024 * 1024) return { kind: null, error: 'Images must be 5 MB or smaller.' };
    return { kind: 'image', error: null };
  }
  if (isVideo) {
    if (file.size > maxVideoBytes) {
      const limitMb = Math.max(1, Math.floor(maxVideoBytes / (1024 * 1024)));
      return { kind: null, error: `Videos must be ${limitMb} MB or smaller.` };
    }
    return { kind: 'video', error: null };
  }
  return { kind: null, error: 'Choose a JPG, PNG, GIF, WebP image or a supported video file.' };
}

export function validateImageUpload(file) {
  const extension = file.name?.split('.').pop()?.toLowerCase() ?? '';
  if (!IMAGE_EXTENSIONS.has(extension)) {
    return 'Choose a JPG, PNG, GIF or WebP image.';
  }
  if (file.size > 5 * 1024 * 1024) return 'Images must be 5 MB or smaller.';
  return null;
}
