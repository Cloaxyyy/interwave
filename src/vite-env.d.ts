
/// <reference types="vite/client" />

import 'react';

declare module 'react' {
  interface HTMLAttributes<T> {
    'data-tauri-drag-region'?: boolean | string;
  }
}
