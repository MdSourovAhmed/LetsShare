// /**
//  * Format raw bytes into a human-readable string.
//  * @param {number} bytes
//  * @returns {string}
//  */
// export function formatBytes(bytes) {
//   if (bytes === 0) return '0 Bytes'
//   const k = 1024
//   const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
//   const i = Math.floor(Math.log(bytes) / Math.log(k))
//   return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
// }

// /**
//  * Generate a short random alphanumeric ID.
//  * @returns {string}
//  */
// export function generateId() {
//   return Math.random().toString(36).substring(2, 15)
// }

// /**
//  * Escape HTML special characters to prevent XSS.
//  * @param {string} s
//  * @returns {string}
//  */
// export function escapeHtml(s) {
//   return (s || '').replace(
//     /[&<>"'`=/]/g,
//     (c) =>
//       ({
//         '&': '&amp;',
//         '<': '&lt;',
//         '>': '&gt;',
//         '"': '&quot;',
//         "'": '&#39;',
//         '/': '&#x2F;',
//         '`': '&#x60;',
//         '=': '&#x3D;',
//       })[c]
//   )
// }

// /**
//  * Clamp a number between min and max.
//  */
// export function clamp(value, min, max) {
//   return Math.min(Math.max(value, min), max)
// }



// No React import needed in a pure utility file
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function generateId() {
  return Math.random().toString(36).substring(2, 15)
}

/**
 * Derive a display path for a File.
 * webkitRelativePath is set when picked via the folder picker or drag-dropped as a directory.
 * Falls back to just the file name for individually picked files.
 */
export function getFilePath(file) {
  return file.webkitRelativePath || file.name
}

/**
 * Get the top-level folder name from a list of files picked via folder picker.
 * Returns null if files were picked individually (no webkitRelativePath).
 */
export function getRootFolderName(files) {
  if (!files.length) return null
  const first = files[0]?.webkitRelativePath
  if (!first) return null
  return first.split('/')[0]
}