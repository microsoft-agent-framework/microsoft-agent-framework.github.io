/**
 * Client-side utility for tracking tutorial progress in localStorage.
 */

const STORAGE_KEY = 'agent-academy-progress';

export function getCompletedTutorials(): string[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
}

export function isCompleted(tutorialId: string): boolean {
  const completed = getCompletedTutorials();
  return completed.includes(tutorialId);
}

export function setCompleted(tutorialId: string, completed: boolean = true) {
  if (typeof window === 'undefined') return;
  
  let current = getCompletedTutorials();
  if (completed) {
    if (!current.includes(tutorialId)) {
      current.push(tutorialId);
    }
  } else {
    current = current.filter(id => id !== tutorialId);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  
  // Dispatch a custom event so other components can react
  window.dispatchEvent(new CustomEvent('progress-update', { 
    detail: { tutorialId, completed } 
  }));
}

export function toggleCompleted(tutorialId: string) {
  const currentStatus = isCompleted(tutorialId);
  setCompleted(tutorialId, !currentStatus);
}
