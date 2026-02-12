type SenderFrameLike = {
  readonly url: string;
  readonly top: unknown;
};

type SenderEventLike = {
  readonly senderFrame?: SenderFrameLike | null;
};

const DEV_SERVER_ORIGIN = 'http://localhost:5173';
const TRUSTED_PROTOCOLS = new Set(['app:', 'file:']);

const tryParseUrl = (candidateUrl: string): URL | null => {
  try {
    return new URL(candidateUrl);
  } catch {
    return null;
  }
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

  if (TRUSTED_PROTOCOLS.has(parsedUrl.protocol)) {
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
