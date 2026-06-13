import { Component, useCallback, useEffect, useMemo, useState, type ErrorInfo, type ReactElement, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  createEchoLinkClient,
  EchoLinkHttpError,
  EchoLinkNetworkError,
  normalizeEchoLinkHost,
  type EchoLinkConnection,
} from './src/echoLink/client';
import type { EchoLinkStatusResponse, EchoLinkTrackPreview } from './src/echoLink/types';
import { parsePairingUri } from './src/echoLink/pairing';
import { loadSavedConnection, saveConnection } from './src/storage/connectionStore';

type AppPage = 'connect' | 'control';

const formatTime = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const initialConnection: EchoLinkConnection = {
  host: '',
  port: 26789,
  token: '',
  name: 'PC ECHO',
  scheme: 'http',
};

const formatRequestError = (error: unknown): string => {
  if (error instanceof EchoLinkNetworkError) {
    return error.message;
  }
  if (error instanceof EchoLinkHttpError) {
    if (error.statusCode === 401) {
      return '认证失败：Token 不匹配。请在电脑端重新生成配对链接，或重新输入最新 token。';
    }
    if (error.statusCode === 403) {
      return '电脑端拒绝了请求：请确认手机和电脑在同一个局域网，且没有走蜂窝网络、访客 Wi-Fi、VPN 或热点隔离。';
    }
    return `${error.statusCode} ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
};

type ErrorBoundaryState = {
  error: Error | null;
};

class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ECHO iPhone startup error', error, errorInfo.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>应用启动失败</Text>
            <Text style={styles.errorText}>{this.state.error.message}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }
}

function EchoLinkApp(): ReactElement {
  const [page, setPage] = useState<AppPage>('connect');
  const [connection, setConnection] = useState<EchoLinkConnection>(initialConnection);
  const [pairingText, setPairingText] = useState('');
  const [status, setStatus] = useState<EchoLinkStatusResponse | null>(null);
  const [tracks, setTracks] = useState<EchoLinkTrackPreview[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  const client = useMemo(() => (
    connection.host.trim() && connection.token.trim()
      ? createEchoLinkClient(connection)
      : null
  ), [connection]);

  const refresh = useCallback(async () => {
    if (!client) {
      return;
    }
    setBusy(true);
    setError(null);
    setLibraryError(null);
    try {
      const nextStatus = await client.getStatus();
      setStatus(nextStatus);
    } catch (refreshError) {
      setError(formatRequestError(refreshError));
      setBusy(false);
      return;
    }

    try {
      const library = await client.getLibraryTracks({ page: 1, pageSize: 20, query });
      setTracks(library.tracks);
    } catch (libraryLoadError) {
      setLibraryError(`已连接电脑端，但曲库加载失败：${formatRequestError(libraryLoadError)}`);
    } finally {
      setBusy(false);
    }
  }, [client, query]);

  useEffect(() => {
    let mounted = true;
    void loadSavedConnection().then((saved) => {
      if (mounted && saved) {
        setConnection(saved);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (client) {
      void refresh();
    }
  }, [client, refresh]);

  const applyPairingText = useCallback(async () => {
    try {
      const parsed = parsePairingUri(pairingText);
      parsed.host = normalizeEchoLinkHost(parsed.host);
      setConnection(parsed);
      await saveConnection(parsed);
      setPairingText('');
      setError(null);
      setPage('control');
    } catch (pairingError) {
      Alert.alert('配对失败', pairingError instanceof Error ? pairingError.message : String(pairingError));
    }
  }, [pairingText]);

  const saveManualConnection = useCallback(async () => {
    const nextConnection = {
      ...connection,
      host: normalizeEchoLinkHost(connection.host),
      token: connection.token.trim(),
      port: Number(connection.port) || 26789,
      scheme: connection.scheme || 'http',
    };
    setConnection(nextConnection);
    await saveConnection(nextConnection);
    setPage('control');
    void refresh();
  }, [connection, refresh]);

  const sendCommand = useCallback(async (command: Parameters<NonNullable<typeof client>['sendPlaybackCommand']>[0]) => {
    if (!client) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setStatus(await client.sendPlaybackCommand(command));
    } catch (commandError) {
      setError(formatRequestError(commandError));
    } finally {
      setBusy(false);
    }
  }, [client]);

  const playTrackOnPc = useCallback((track: EchoLinkTrackPreview) => {
    void sendCommand({ command: 'playTrack', trackId: track.id, output: 'pc' });
  }, [sendCommand]);

  const nowPlaying = status?.playback.track;
  const volumePercent = Math.round((status?.playback.volume ?? 0) * 100);
  const connectedLabel = status ? `已连接 ${status.device.name}` : '尚未连接';
  const progressRatio = status?.playback.durationMs
    ? Math.max(0, Math.min(1, status.playback.positionMs / status.playback.durationMs))
    : 0;

  const changeVolume = useCallback((deltaPercent: number) => {
    const nextVolume = Math.max(0, Math.min(1, (volumePercent + deltaPercent) / 100));
    void sendCommand({ command: 'setVolume', volume: nextVolume });
  }, [sendCommand, volumePercent]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <View style={styles.pageShell}>
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void refresh()} tintColor="#f59e0b" />}
          >
            <View style={styles.header}>
              <Text style={styles.kicker}>ECHO Link</Text>
              <Text style={styles.title}>{page === 'connect' ? '连接电脑端' : '音乐控制台'}</Text>
              <Text style={styles.description}>
                {page === 'connect'
                  ? '用配对链接或手动输入局域网地址，连接你的 ECHO NEXT 桌面端。'
                  : '像随身遥控器一样控制电脑播放、音量和曲库。'}
              </Text>
              <View style={[styles.statusPill, status ? styles.statusPillOnline : null]}>
                <Text style={[styles.statusPillText, status ? styles.statusPillTextOnline : null]}>{connectedLabel}</Text>
              </View>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>连接异常</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {page === 'connect' ? (
              <>
                <View style={styles.card}>
                  <Text style={styles.cardEyebrow}>Quick Pair</Text>
                  <Text style={styles.cardTitle}>配对连接</Text>
                  <Text style={styles.hint}>
                    在电脑端打开 Connect / Mobile ECHO Link，复制或扫描二维码里的 echo://pair 链接，然后粘贴到这里。
                  </Text>
                  <TextInput
                    value={pairingText}
                    onChangeText={setPairingText}
                    placeholder="echo://pair?host=192.168.1.12&port=26789&token=..."
                    placeholderTextColor="#a8a29e"
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline
                    style={[styles.input, styles.pairingInput]}
                  />
                  <Pressable style={styles.primaryButton} onPress={() => void applyPairingText()}>
                    <Text style={styles.primaryButtonText}>使用配对链接</Text>
                  </Pressable>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardEyebrow}>Manual</Text>
                  <Text style={styles.cardTitle}>手动连接</Text>
                  <TextInput
                    value={connection.host}
                    onChangeText={(host) => setConnection((current) => ({ ...current, host }))}
                    placeholder="电脑 IP，例如 192.168.1.12"
                    placeholderTextColor="#a8a29e"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                  />
                  <TextInput
                    value={String(connection.port)}
                    onChangeText={(port) => setConnection((current) => ({ ...current, port: Number(port) || 26789 }))}
                    placeholder="端口"
                    placeholderTextColor="#a8a29e"
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                  <TextInput
                    value={connection.token}
                    onChangeText={(token) => setConnection((current) => ({ ...current, token }))}
                    placeholder="Token"
                    placeholderTextColor="#a8a29e"
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                    style={styles.input}
                  />
                  <View style={styles.buttonRow}>
                    <Pressable style={styles.secondaryButton} onPress={() => void saveManualConnection()}>
                      <Text style={styles.secondaryButtonText}>保存连接</Text>
                    </Pressable>
                    <Pressable style={styles.secondaryButton} onPress={() => void refresh()} disabled={!client || busy}>
                      <Text style={styles.secondaryButtonText}>{busy ? '刷新中...' : '测试连接'}</Text>
                    </Pressable>
                  </View>
                </View>
              </>
            ) : (
              <>
                <View style={styles.playerCard}>
                  <View style={styles.artworkShell}>
                    {nowPlaying?.artworkUrl ? (
                      <Image source={{ uri: nowPlaying.artworkUrl }} style={styles.artworkImage} />
                    ) : (
                      <View style={styles.artworkFallback}>
                        <Text style={styles.artworkFallbackText}>ECHO</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.playerLabel}>{status ? `${status.device.name} / ${status.playback.outputMode}` : '等待连接'}</Text>
                  <Text style={styles.trackTitle} numberOfLines={2}>{nowPlaying?.title ?? '没有正在播放的歌曲'}</Text>
                  <Text style={styles.trackMeta} numberOfLines={1}>
                    {nowPlaying ? `${nowPlaying.artist} · ${nowPlaying.album || 'Unknown Album'}` : '先连接电脑端 ECHO NEXT'}
                  </Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
                  </View>
                  <View style={styles.timeRow}>
                    <Text style={styles.progressText}>{status ? formatTime(status.playback.positionMs) : '0:00'}</Text>
                    <Text style={styles.progressText}>{status ? formatTime(status.playback.durationMs) : '0:00'}</Text>
                  </View>
                  <View style={styles.transportRow}>
                    <Pressable style={styles.roundButton} onPress={() => void sendCommand({ command: 'previous' })} disabled={!client}>
                      <Text style={styles.roundButtonText}>上一首</Text>
                    </Pressable>
                    <Pressable style={styles.playButton} onPress={() => void sendCommand({ command: 'playPause' })} disabled={!client}>
                      <Text style={styles.playButtonText}>{status?.playback.state === 'playing' ? '暂停' : '播放'}</Text>
                    </Pressable>
                    <Pressable style={styles.roundButton} onPress={() => void sendCommand({ command: 'next' })} disabled={!client}>
                      <Text style={styles.roundButtonText}>下一首</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.card}>
                  <View style={styles.rowBetween}>
                    <View>
                      <Text style={styles.cardEyebrow}>Volume</Text>
                      <Text style={styles.cardTitle}>音量 {volumePercent}%</Text>
                    </View>
                    {busy ? <ActivityIndicator color="#f59e0b" /> : null}
                  </View>
                  <View style={styles.volumeTrack}>
                    <View style={[styles.volumeFill, { width: `${volumePercent}%` }]} />
                  </View>
                  <View style={styles.buttonRow}>
                    <Pressable style={styles.secondaryButton} onPress={() => changeVolume(-10)} disabled={!client}>
                      <Text style={styles.secondaryButtonText}>音量 -</Text>
                    </Pressable>
                    <Pressable style={styles.secondaryButton} onPress={() => changeVolume(10)} disabled={!client}>
                      <Text style={styles.secondaryButtonText}>音量 +</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardEyebrow}>Library</Text>
                  <Text style={styles.cardTitle}>电脑端曲库</Text>
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    onSubmitEditing={() => void refresh()}
                    placeholder="搜索歌曲、艺术家或专辑"
                    placeholderTextColor="#a8a29e"
                    style={styles.input}
                  />
                  {libraryError ? (
                    <View style={styles.warningBox}>
                      <Text style={styles.warningTitle}>曲库加载异常</Text>
                      <Text style={styles.warningText}>{libraryError}</Text>
                    </View>
                  ) : null}
                  <View style={styles.libraryList}>
                    {tracks.length > 0 ? tracks.map((item) => (
                      <Pressable key={item.id} style={styles.trackRow} onPress={() => playTrackOnPc(item)}>
                        <View style={styles.trackBadge}>
                          <Text style={styles.trackBadgeText}>♪</Text>
                        </View>
                        <View style={styles.trackText}>
                          <Text style={styles.listTitle} numberOfLines={1}>{item.title}</Text>
                          <Text style={styles.listMeta} numberOfLines={1}>{item.artist} · {item.sourceLabel}</Text>
                        </View>
                        <Text style={styles.playInline}>播放</Text>
                      </Pressable>
                    )) : (
                      <Text style={styles.hint}>{client ? '暂无曲库结果' : '连接后会显示电脑端曲库'}</Text>
                    )}
                  </View>
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.dock}>
            <Pressable
              style={[styles.dockItem, page === 'connect' ? styles.dockItemActive : null]}
              onPress={() => setPage('connect')}
            >
              <Text style={[styles.dockIcon, page === 'connect' ? styles.dockIconActive : null]}>⌁</Text>
              <Text style={[styles.dockLabel, page === 'connect' ? styles.dockLabelActive : null]}>连接</Text>
            </Pressable>
            <Pressable
              style={[styles.dockItem, page === 'control' ? styles.dockItemActive : null]}
              onPress={() => setPage('control')}
            >
              <Text style={[styles.dockIcon, page === 'control' ? styles.dockIconActive : null]}>▶</Text>
              <Text style={[styles.dockLabel, page === 'control' ? styles.dockLabelActive : null]}>控制</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App(): ReactElement {
  return (
    <AppErrorBoundary>
      <EchoLinkApp />
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff7ed',
  },
  root: {
    flex: 1,
  },
  pageShell: {
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 116,
    gap: 16,
  },
  header: {
    gap: 8,
    paddingTop: 12,
  },
  kicker: {
    color: '#f97316',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#1f2937',
    fontSize: 32,
    fontWeight: '800',
  },
  description: {
    color: '#6b7280',
    fontSize: 15,
    lineHeight: 22,
  },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusPillOnline: {
    backgroundColor: '#ecfdf5',
    borderColor: '#bbf7d0',
  },
  statusPillText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '800',
  },
  statusPillTextOnline: {
    color: '#047857',
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#fed7aa',
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 16,
    shadowColor: '#fb923c',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
  },
  cardEyebrow: {
    color: '#fb923c',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: '#1f2937',
    fontSize: 18,
    fontWeight: '800',
  },
  hint: {
    color: '#78716c',
    fontSize: 13,
    lineHeight: 19,
  },
  input: {
    backgroundColor: '#fffaf5',
    borderColor: '#fed7aa',
    borderRadius: 14,
    borderWidth: 1,
    color: '#1f2937',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pairingInput: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#fb923c',
    borderRadius: 14,
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: '#c2410c',
    fontSize: 14,
    fontWeight: '800',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  errorBox: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  errorTitle: {
    color: '#be123c',
    fontWeight: '800',
  },
  errorText: {
    color: '#be123c',
    fontSize: 13,
    lineHeight: 18,
  },
  warningBox: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  warningTitle: {
    color: '#a16207',
    fontWeight: '800',
  },
  warningText: {
    color: '#92400e',
    fontSize: 13,
    lineHeight: 18,
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  playerCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#fdba74',
    borderRadius: 30,
    borderWidth: 1,
    gap: 10,
    padding: 18,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
  },
  artworkShell: {
    alignItems: 'center',
    backgroundColor: '#ffedd5',
    borderColor: '#fed7aa',
    borderRadius: 28,
    borderWidth: 1,
    height: 230,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  artworkImage: {
    height: '100%',
    width: '100%',
  },
  artworkFallback: {
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  artworkFallbackText: {
    color: '#f97316',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 4,
  },
  playerLabel: {
    color: '#f97316',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  trackTitle: {
    color: '#1f2937',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  trackMeta: {
    color: '#78716c',
    fontSize: 14,
    textAlign: 'center',
  },
  progressTrack: {
    backgroundColor: '#ffedd5',
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    backgroundColor: '#fb923c',
    borderRadius: 999,
    height: '100%',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  progressText: {
    color: '#78716c',
    fontVariant: ['tabular-nums'],
  },
  transportRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  roundButton: {
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  roundButtonText: {
    color: '#c2410c',
    fontWeight: '800',
  },
  playButton: {
    alignItems: 'center',
    backgroundColor: '#fb923c',
    borderRadius: 999,
    flex: 1,
    paddingVertical: 13,
  },
  playButtonText: {
    color: '#ffffff',
    fontWeight: '900',
  },
  volumeTrack: {
    backgroundColor: '#ffedd5',
    borderRadius: 999,
    height: 12,
    overflow: 'hidden',
  },
  volumeFill: {
    backgroundColor: '#f59e0b',
    borderRadius: 999,
    height: '100%',
  },
  libraryList: {
    gap: 8,
  },
  trackRow: {
    alignItems: 'center',
    backgroundColor: '#fffaf5',
    borderColor: '#ffedd5',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  trackBadge: {
    alignItems: 'center',
    backgroundColor: '#fed7aa',
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  trackBadgeText: {
    color: '#c2410c',
    fontSize: 16,
    fontWeight: '900',
  },
  trackText: {
    flex: 1,
    gap: 3,
  },
  listTitle: {
    color: '#1f2937',
    fontSize: 15,
    fontWeight: '800',
  },
  listMeta: {
    color: '#78716c',
    fontSize: 13,
  },
  playInline: {
    color: '#f97316',
    fontSize: 13,
    fontWeight: '800',
  },
  dock: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderColor: '#fed7aa',
    borderRadius: 28,
    borderWidth: 1,
    bottom: 16,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    left: 18,
    padding: 8,
    position: 'absolute',
    right: 18,
    shadowColor: '#fb923c',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
  },
  dockItem: {
    alignItems: 'center',
    borderRadius: 22,
    flex: 1,
    gap: 3,
    paddingVertical: 10,
  },
  dockItemActive: {
    backgroundColor: '#ffedd5',
  },
  dockIcon: {
    color: '#a8a29e',
    fontSize: 20,
    fontWeight: '900',
  },
  dockIconActive: {
    color: '#ea580c',
  },
  dockLabel: {
    color: '#a8a29e',
    fontSize: 12,
    fontWeight: '800',
  },
  dockLabelActive: {
    color: '#ea580c',
  },
});
