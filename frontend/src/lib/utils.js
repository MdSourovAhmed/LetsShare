import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

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