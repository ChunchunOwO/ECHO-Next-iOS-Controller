import type {
  EchoLinkLibraryAlbumTracksResponse,
  EchoLinkLibraryAlbumsResponse,
  EchoLinkLibraryTracksResponse,
  EchoLinkPlaybackCommand,
  EchoLinkStatusResponse,
  EchoLinkStreamResponse,
} from './types';

export type EchoLinkConnection = {
  host: string;
  port: number;
  token: string;
  name: string;
  scheme: 'http' | 'https';
};

export class EchoLinkHttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export class EchoLinkNetworkError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

const linkVersion = '1';

const trimSlashes = (value: string): string => value.replace(/^\/+|\/+$/gu, '');

const defaultTimeoutMs = 8000;

export const normalizeEchoLinkHost = (host: string): string => {
  const trimmed = host.trim();
  if (!trimmed) {
    return '';
  }
  const withoutProtocol = trimmed.replace(/^https?:\/\//iu, '');
  return withoutProtocol.replace(/\/.*$/u, '');
};

const describeNetworkError = (error: unknown, url: string): EchoLinkNetworkError => {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const message = rawMessage.toLowerCase();
  if (error instanceof Error && error.name === 'AbortError') {
    return new EchoLinkNetworkError(
      `连接超时：${url}。请确认 iPhone 和电脑在同一 Wi-Fi，电脑端 ECHO Link 已开启，并允许 Windows 防火墙放行 ECHO NEXT。`,
      url,
      error,
    );
  }
  if (message.includes('timed out') || message.includes('timeout')) {
    return new EchoLinkNetworkError(
      `连接超时：${url}。通常是电脑 IP/端口不可达、Windows 防火墙拦截，或 iOS 未允许“本地网络”。`,
      url,
      error,
    );
  }
  if (message.includes('network request failed') || message.includes('fetch failed')) {
    return new EchoLinkNetworkError(
      `无法连接：${url}。请检查本地网络权限、电脑端服务是否开启，以及是否填入了电脑的局域网 IP。`,
      url,
      error,
    );
  }
  return new EchoLinkNetworkError(rawMessage, url, error);
};

export type EchoLinkClient = ReturnType<typeof createEchoLinkClient>;

export const createEchoLinkClient = (connection: EchoLinkConnection) => {
  const host = normalizeEchoLinkHost(connection.host);
  const baseUrl = `${connection.scheme}://${host}:${connection.port}`;

  const requestJson = async <T>(path: string, init: RequestInit = {}, timeoutMs = defaultTimeoutMs): Promise<T> => {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${connection.token}`);
    headers.set('x-echo-link-version', linkVersion);
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const url = `${baseUrl}/${trimSlashes(path)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers,
        signal: init.signal ?? controller.signal,
      });
    } catch (error) {
      throw describeNetworkError(error, url);
    } finally {
      clearTimeout(timeout);
    }

    const text = await response.text();
    const body = text ? JSON.parse(text) as unknown : null;
    if (!response.ok) {
      const message = typeof body === 'object' && body && 'message' in body
        ? String((body as { message: unknown }).message)
        : response.statusText;
      throw new EchoLinkHttpError(response.status, message);
    }
    return body as T;
  };

  return {
    connection,
    baseUrl,
    getStatus: () => requestJson<EchoLinkStatusResponse>('/echo-link/v1/status', {}, 6000),
    getLibraryTracks: ({ page = 1, pageSize = 40, query = '' }: { page?: number; pageSize?: number; query?: string } = {}) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (query.trim()) {
        params.set('q', query.trim());
      }
      return requestJson<EchoLinkLibraryTracksResponse>(`/echo-link/v1/library/tracks?${params.toString()}`, {}, 15000);
    },
    getLibraryAlbums: ({ page = 1, pageSize = 40, query = '' }: { page?: number; pageSize?: number; query?: string } = {}) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (query.trim()) {
        params.set('q', query.trim());
      }
      return requestJson<EchoLinkLibraryAlbumsResponse>(`/echo-link/v1/library/albums?${params.toString()}`, {}, 15000);
    },
    getLibraryAlbumTracks: (albumId: string, { page = 1, pageSize = 80 }: { page?: number; pageSize?: number } = {}) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      return requestJson<EchoLinkLibraryAlbumTracksResponse>(
        `/echo-link/v1/library/albums/${encodeURIComponent(albumId)}/tracks?${params.toString()}`,
        {},
        15000,
      );
    },
    sendPlaybackCommand: (command: EchoLinkPlaybackCommand) =>
      requestJson<EchoLinkStatusResponse>('/echo-link/v1/playback/command', {
        method: 'POST',
        body: JSON.stringify(command),
      }),
    createPhoneStream: (trackId: string) =>
      requestJson<EchoLinkStreamResponse>(`/echo-link/v1/library/tracks/${encodeURIComponent(trackId)}/stream`, {
        method: 'POST',
        body: JSON.stringify({ target: 'phone' }),
      }),
    getLyrics: (trackId: string) =>
      requestJson<{ lyrics: string; sourceLabel: string; kind: string }>(
        `/echo-link/v1/library/tracks/${encodeURIComponent(trackId)}/lyrics`,
      ),
  };
};
