/** Also resets a session when the sidebar reselects its existing route. */
export const NOTE_NAVIGATION_EVENT = "spy:note-navigation";

export function notifyNoteNavigation(): void {
  window.dispatchEvent(new Event(NOTE_NAVIGATION_EVENT));
}
