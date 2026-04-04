export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatSpeed(bytesPerSec) {
  return formatBytes(bytesPerSec) + '/s';
}

export function generateId(length = 8) {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function getFileIcon(filename) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const map = {
    pdf: '📄', doc: '📝', docx: '📝', txt: '📃', md: '📃',
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️', svg: '🖼️',
    mp4: '🎬', mov: '🎬', avi: '🎬', mkv: '🎬', webm: '🎬',
    mp3: '🎵', wav: '🎵', flac: '🎵', aac: '🎵',
    zip: '🗜️', rar: '🗜️', tar: '🗜️', gz: '🗜️', '7z': '🗜️',
    js: '⚡', ts: '⚡', jsx: '⚡', tsx: '⚡', py: '🐍',
    html: '🌐', css: '🎨', json: '📋',
    xls: '📊', xlsx: '📊', csv: '📊',
    ppt: '📽️', pptx: '📽️',
    folder: '📁',
  };
  return map[ext] || '📄';
}

export function getFileType(filename) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const map = {
    pdf: 'PDF Document',
    doc: 'Word Document', docx: 'Word Document',
    txt: 'Text File', md: 'Markdown',
    jpg: 'JPEG Image', jpeg: 'JPEG Image', png: 'PNG Image',
    gif: 'GIF Image', webp: 'WebP Image', svg: 'SVG Image',
    mp4: 'MP4 Video', mov: 'QuickTime', avi: 'AVI Video',
    mp3: 'MP3 Audio', wav: 'WAV Audio',
    zip: 'ZIP Archive', rar: 'RAR Archive', tar: 'TAR Archive',
    js: 'JavaScript', ts: 'TypeScript', py: 'Python',
    html: 'HTML', css: 'CSS', json: 'JSON',
    xlsx: 'Excel', csv: 'CSV',
    pptx: 'PowerPoint',
  };
  return map[ext] || (ext ? ext.toUpperCase() + ' File' : 'Unknown');
}

export function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}
