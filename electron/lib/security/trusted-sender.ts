import path from 'path';
import { fileURLToPath } from 'url';

type SenderFrameLike = {
  readonly url: string;
  readonly top: unknown;
};

type SenderEventLike = {
  readonly senderFrame?: SenderFrameLike | null;
};

const DEV_SERVER_ORIGIN = 'http://localhost:5173';
const TRUSTED_APP_ENTRYPOINT = 'index.html';

let trustedRendererFileEntrypoints = new Set<string>();

const tryParseUrl = (candidateUrl: string): URL | null => {
  try {
    return new URL(candidateUrl);
  } catch {
    return null;
  }
};

const getAppEntrypoint = (rendererUrl: URL): string | null => {
  const hostSegment = rendererUrl.hostname.length > 0 ? [rendererUrl.hostname] : [];
  const pathSegments = rendererUrl.pathname.split('/').filter((segment) => segment.length > 0);
  const segments = [...hostSegment, ...pathSegments];

  if (segments.length === 0) {
    return TRUSTED_APP_ENTRYPOINT;
  }

  if (segments.length !== 1) {
    return null;
  }

  const [entrypoint] = segments;
  return entrypoint.length > 0 ? entrypoint : null;
};

const toCanonicalFilePath = (rendererUrl: URL): string | null => {
  try {
    return path.resolve(fileURLToPath(rendererUrl));
  } catch {
    return null;
  }
};

const isTrustedPackagedFileEntrypoint = (rendererUrl: URL): boolean => {
  if (rendererUrl.protocol !== 'file:') {
    return false;
  }

  const canonicalFilePath = toCanonicalFilePath(rendererUrl);
  if (canonicalFilePath === null) {
    return false;
  }

  return trustedRendererFileEntrypoints.has(canonicalFilePath);
};

export const configureTrustedRendererFileEntrypoints = (
  entrypointPaths: readonly string[]
): void => {
  trustedRendererFileEntrypoints = new Set(
    entrypointPaths.map((entrypointPath) => path.resolve(entrypointPath))
  );
};

export const clearTrustedRendererFileEntrypoints = (): void => {
  trustedRendererFileEntrypoints.clear();
};

const isMainFrame = (
  senderFrame: SenderFrameLike | null | undefined
): senderFrame is SenderFrameLike => {
  if (senderFrame === null || senderFrame === undefined) {
    return false;
  }

  return senderFrame.top === senderFrame;
};

export const isTrustedRendererUrl = (
  rendererUrl: string,
  isDevelopment: boolean
): boolean => {
  const parsedUrl = tryParseUrl(rendererUrl);
  if (parsedUrl === null) {
    return false;
  }

  if (parsedUrl.protocol === 'app:') {
    return getAppEntrypoint(parsedUrl) === TRUSTED_APP_ENTRYPOINT;
  }

  if (isTrustedPackagedFileEntrypoint(parsedUrl)) {
    return true;
  }

  if (!isDevelopment) {
    return false;
  }

  return parsedUrl.origin === DEV_SERVER_ORIGIN;
};

export const isTrustedSenderFrame = (
  senderFrame: SenderFrameLike | null | undefined,
  isDevelopment: boolean
): boolean => {
  if (!isMainFrame(senderFrame)) {
    return false;
  }

  const mainFrame = senderFrame;
  return isTrustedRendererUrl(mainFrame.url, isDevelopment);
};

export const isTrustedNavigationTarget = (
  targetUrl: string,
  isDevelopment: boolean
): boolean => isTrustedRendererUrl(targetUrl, isDevelopment);

export const assertTrustedSender = (
  event: SenderEventLike,
  isDevelopment: boolean = process.env.NODE_ENV === 'development'
): void => {
  if (isTrustedSenderFrame(event.senderFrame, isDevelopment)) {
    return;
  }

  throw new Error('UNAUTHORIZED_IPC_SENDER');
};
