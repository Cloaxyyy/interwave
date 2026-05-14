import { create } from 'zustand';
import type { SearchResult } from '../lib/tauri';

export type SearchStatus = 'idle' | 'loading' | 'done' | 'error';

interface SearchStore {
  query: string;
  results: SearchResult[];
  status: SearchStatus;
  error: string | null;
  recentSearches: string[];

  setQuery: (q: string) => void;
  setResults: (results: SearchResult[]) => void;
  setStatus: (s: SearchStatus) => void;
  setError: (e: string | null) => void;
  setRecentSearches: (r: string[]) => void;
}

export const useSearchStore = create<SearchStore>((set) => ({
  query: '',
  results: [],
  status: 'idle',
  error: null,
  recentSearches: [],

  setQuery: (query) => set({ query }),
  setResults: (results) => set({ results }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setRecentSearches: (recentSearches) => set({ recentSearches }),
}));
