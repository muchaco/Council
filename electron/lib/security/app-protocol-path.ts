import path from 'path';

const decodePathSegment = (rawSegment: string): string | null => {
  try {
    const decodedSegment = decodeURIComponent(rawSegment);
    if (
      decodedSegment.length === 0 ||
      decodedSegment === '.' ||
      decodedSegment === '..' ||
      decodedSegment.includes('/') ||
      decodedSegment.includes('\\') ||
      decodedSegment.includes('\u0000')
    ) {
      return null;
    }

    return decodedSegment;
  } catch {
    return null;
  }
};

const isContainedWithinRoot = (
  rootDirectoryPath: string,
  candidatePath: string
): boolean => {
  const relativePath = path.relative(rootDirectoryPath, candidatePath);
  return relativePath !== '..' && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath);
};

const toRequestPathSegments = (requestUrl: URL): string[] | null => {
  const hostSegment = requestUrl.hostname.length > 0 ? [requestUrl.hostname] : [];
  const pathnameSegments = requestUrl.pathname.split('/').filter((segment) => segment.length > 0);
  const rawPathSegments = [...hostSegment, ...pathnameSegments];

  if (rawPathSegments.length === 0) {
    return ['index.html'];
  }

  const decodedSegments: string[] = [];
  for (const rawPathSegment of rawPathSegments) {
    const decodedPathSegment = decodePathSegment(rawPathSegment);
    if (decodedPathSegment === null) {
      return null;
    }

    decodedSegments.push(decodedPathSegment);
  }

  return decodedSegments;
};

export const resolveAppProtocolRequestPath = (
  requestUrl: string,
  outDirectoryPath: string
): string | null => {
  let parsedRequestUrl: URL;

  try {
    parsedRequestUrl = new URL(requestUrl);
  } catch {
    return null;
  }

  if (parsedRequestUrl.protocol !== 'app:') {
    return null;
  }

  const requestPathSegments = toRequestPathSegments(parsedRequestUrl);
  if (requestPathSegments === null) {
    return null;
  }

  const canonicalOutDirectoryPath = path.resolve(outDirectoryPath);
  const resolvedRequestPath = path.resolve(canonicalOutDirectoryPath, ...requestPathSegments);

  if (!isContainedWithinRoot(canonicalOutDirectoryPath, resolvedRequestPath)) {
    return null;
  }

  return resolvedRequestPath;
};
