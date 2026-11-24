import type http from 'node:http';

export function createPdplCheckServer(options: {
  dataDir: string;
  distDir?: string;
  appOrigin?: string;
  basePath?: string;
  maxMutationsPerMinute?: number;
}): {
  handler: http.RequestListener;
  close: () => void;
};
