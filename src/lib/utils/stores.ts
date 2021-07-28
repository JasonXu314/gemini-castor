import { writable } from 'svelte/store';

// stores for deeply nested components to update with latest data
export const historyStore = writable<Sort[]>([]);
export const viewStore = writable<View[]>([]);
