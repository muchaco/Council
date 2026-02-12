import { describe, expect, it } from 'vitest';

import {
  assertTrustedSender,
  isTrustedNavigationTarget,
  isTrustedSenderFrame,
} from './trusted-sender';

type SenderFrameLike = {
  readonly url: string;
  readonly top: unknown;
};

const createMainFrame = (url: string): SenderFrameLike => {
  const mainFrame: { url: string; top: unknown } = {
    url,
    top: null,
  };

  mainFrame.top = mainFrame;
  return mainFrame;
};

const createSubframe = (url: string, topFrameUrl: string): SenderFrameLike => ({
  url,
  top: createMainFrame(topFrameUrl),
});

describe('trusted_sender_spec', () => {
  it('allows_main_frame_sender_for_localhost_in_development', () => {
    const trustedFrame = createMainFrame('http://localhost:5173/settings');

    expect(isTrustedSenderFrame(trustedFrame, true)).toBe(true);
  });

  it('denies_external_http_sender_even_in_development', () => {
    const untrustedFrame = createMainFrame('https://attacker.example/');

    expect(isTrustedSenderFrame(untrustedFrame, true)).toBe(false);
  });

  it('denies_subframe_sender_even_when_top_frame_is_trusted', () => {
    const subframe = createSubframe('http://localhost:5173/embedded', 'http://localhost:5173/');

    expect(isTrustedSenderFrame(subframe, true)).toBe(false);
  });

  it('throws_unauthorized_error_for_untrusted_sender_assertion', () => {
    const untrustedFrame = createMainFrame('https://attacker.example/');

    expect(() => assertTrustedSender({ senderFrame: untrustedFrame }, true)).toThrow(
      'UNAUTHORIZED_IPC_SENDER'
    );
  });

  it('denies_external_navigation_targets', () => {
    expect(isTrustedNavigationTarget('https://example.com', true)).toBe(false);
  });
});
