import path from 'path';
import { describe, expect, it } from 'vitest';

import { resolveAppProtocolRequestPath } from './app-protocol-path';

const OUT_DIRECTORY_PATH = path.resolve('/tmp/council', 'out');

describe('app_protocol_path_resolution_spec', () => {
  it('resolves_app_protocol_index_file_to_out_directory', () => {
    const resolvedPath = resolveAppProtocolRequestPath('app://index.html', OUT_DIRECTORY_PATH);

    expect(resolvedPath).toBe(path.resolve(OUT_DIRECTORY_PATH, 'index.html'));
  });

  it('resolves_empty_app_protocol_path_to_index_file', () => {
    const resolvedPath = resolveAppProtocolRequestPath('app://', OUT_DIRECTORY_PATH);

    expect(resolvedPath).toBe(path.resolve(OUT_DIRECTORY_PATH, 'index.html'));
  });

  it('rejects_plain_traversal_payloads', () => {
    const resolvedPath = resolveAppProtocolRequestPath('app://../../etc/passwd', OUT_DIRECTORY_PATH);

    expect(resolvedPath).toBeNull();
  });

  it('rejects_percent_encoded_traversal_payloads', () => {
    const resolvedPath = resolveAppProtocolRequestPath(
      'app://..%2f..%2fetc/passwd',
      OUT_DIRECTORY_PATH
    );

    expect(resolvedPath).toBeNull();
  });

  it('rejects_segments_with_encoded_separator_characters', () => {
    const resolvedPath = resolveAppProtocolRequestPath('app://assets%2fsecret.js', OUT_DIRECTORY_PATH);

    expect(resolvedPath).toBeNull();
  });

  it('rejects_non_app_protocol_requests', () => {
    const resolvedPath = resolveAppProtocolRequestPath('https://example.com/index.html', OUT_DIRECTORY_PATH);

    expect(resolvedPath).toBeNull();
  });
});
