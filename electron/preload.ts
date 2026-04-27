import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('hindsight', {
  version: '0.0.0',
});

declare global {
  interface Window {
    hindsight: {
      version: string;
    };
  }
}
