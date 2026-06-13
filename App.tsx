import { Component, useCallback, useEffect, useMemo, useState, type ErrorInfo, type ReactElement, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
  type EchoLinkConnection,
} from './src/echoLink/client';
import type { EchoLinkStatusResponse, EchoLinkTrackPreview } from './src/echoLink/types';
import { parsePairingUri } from './src/echoLink/pairing';
import { loadSavedConnection, saveConnection } from './src/storage/connectionStore';

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
  const [connection, setConnection] = useState<EchoLinkConnection>(initialConnection);
  const [pairingText, setPairingText] = useState('');
  const [status, setStatus] = useState<EchoLinkStatusResponse | null>(null);
  const [tracks, setTracks] = useState<EchoLinkTrackPreview[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    try {
      const [nextStatus, library] = await Promise.all([
        client.getStatus(),
        client.getLibraryTracks({ page: 1, pageSize: 40, query }),
      ]);
      setStatus(nextStatus);
      setTracks(library.tracks);
    } catch (refreshError) {
      const message = refreshError instanceof EchoLinkHttpError
        ? `${refreshError.statusCode} ${refreshError.message}`
        : refreshError instanceof Error
          ? refreshError.message
          : String(refreshError);
      setError(message);
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
      setConnection(parsed);
      await saveConnection(parsed);
      setPairingText('');
      setError(null);
    } catch (pairingError) {
      Alert.alert('配对失败', pairingError instanceof Error ? pairingError.message : String(pairingError));
    }
  }, [pairingText]);

  const saveManualConnection = useCallback(async () => {
    const nextConnection = {
      ...connection,
      host: connection.host.trim(),
      token: connection.token.trim(),
      port: Number(connection.port) || 26789,
      scheme: connection.scheme || 'http',
    };
    setConnection(nextConnection);
    await saveConnection(nextConnection);
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
      setError(commandError instanceof Error ? commandError.message : String(commandError));
    } finally {
      setBusy(false);
    }
  }, [client]);

  const playTrackOnPc = useCallback((track: EchoLinkTrackPreview) => {
    void sendCommand({ command: 'playTrack', trackId: track.id, output: 'pc' });
  }, [sendCommand]);

  const nowPlaying = status?.playback.track;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void refresh()} />}
        >
          <View style={styles.header}>
            <Text style={styles.kicker}>ECHO Link</Text>
            <Text style={styles.title}>iPhone 遥控端</Text>
            <Text style={styles.description}>
              连接电脑端 ECHO NEXT 后，可以查看播放状态、搜索本地曲库，并让电脑端播放指定歌曲。
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>配对</Text>
            <Text style={styles.hint}>
              在电脑端打开 Connect / Mobile ECHO Link，复制或扫描二维码里的 echo://pair 链接，然后粘贴到这里。
            </Text>
            <TextInput
              value={pairingText}
              onChangeText={setPairingText}
              placeholder="echo://pair?host=192.168.1.12&port=26789&token=..."
              placeholderTextColor="#7d8596"
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
            <Text style={styles.cardTitle}>手动连接</Text>
            <TextInput
              value={connection.host}
              onChangeText={(host) => setConnection((current) => ({ ...current, host }))}
              placeholder="电脑 IP，例如 192.168.1.12"
              placeholderTextColor="#7d8596"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <TextInput
              value={String(connection.port)}
              onChangeText={(port) => setConnection((current) => ({ ...current, port: Number(port) || 26789 }))}
              placeholder="端口"
              placeholderTextColor="#7d8596"
              keyboardType="number-pad"
              style={styles.input}
            />
            <TextInput
              value={connection.token}
              onChangeText={(token) => setConnection((current) => ({ ...current, token }))}
              placeholder="Token"
              placeholderTextColor="#7d8596"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              style={styles.input}
            />
            <View style={styles.buttonRow}>
              <Pressable style={styles.secondaryButton} onPress={() => void saveManualConnection()}>
                <Text style={styles.secondaryButtonText}>保存并刷新</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => void refresh()} disabled={!client || busy}>
                <Text style={styles.secondaryButtonText}>{busy ? '刷新中...' : '刷新状态'}</Text>
              </Pressable>
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>连接异常</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.cardTitle}>当前播放</Text>
                <Text style={styles.hint}>{status ? `${status.device.name} / ${status.playback.outputMode}` : '尚未连接'}</Text>
              </View>
              {busy ? <ActivityIndicator /> : null}
            </View>
            <Text style={styles.trackTitle}>{nowPlaying?.title ?? '没有正在播放的歌曲'}</Text>
            <Text style={styles.trackMeta}>{nowPlaying ? `${nowPlaying.artist} · ${nowPlaying.album || 'Unknown Album'}` : '先连接电脑端 ECHO NEXT'}</Text>
            <Text style={styles.progressText}>
              {status ? `${formatTime(status.playback.positionMs)} / ${formatTime(status.playback.durationMs)}` : '0:00 / 0:00'}
            </Text>
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
            <Text style={styles.cardTitle}>电脑端曲库</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void refresh()}
              placeholder="搜索歌曲、艺术家或专辑"
              placeholderTextColor="#7d8596"
              style={styles.input}
            />
            <FlatList
              data={tracks}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={<Text style={styles.hint}>{client ? '暂无曲库结果' : '连接后会显示电脑端曲库'}</Text>}
              renderItem={({ item }) => (
                <Pressable style={styles.trackRow} onPress={() => playTrackOnPc(item)}>
                  <View style={styles.trackText}>
                    <Text style={styles.listTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.listMeta} numberOfLines={1}>{item.artist} · {item.sourceLabel}</Text>
                  </View>
                  <Text style={styles.playInline}>电脑播放</Text>
                </Pressable>
              )}
            />
          </View>
        </ScrollView>
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
    backgroundColor: '#0a1020',
  },
  root: {
    flex: 1,
  },
  content: {
    padding: 18,
    gap: 16,
  },
  header: {
    gap: 8,
    paddingTop: 12,
  },
  kicker: {
    color: '#7dd3fc',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#f8fafc',
    fontSize: 32,
    fontWeight: '800',
  },
  description: {
    color: '#a8b3c7',
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#111a2e',
    borderColor: '#22314f',
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
  },
  hint: {
    color: '#9ca8bd',
    fontSize: 13,
    lineHeight: 19,
  },
  input: {
    backgroundColor: '#0b1222',
    borderColor: '#263757',
    borderRadius: 14,
    borderWidth: 1,
    color: '#f8fafc',
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
    backgroundColor: '#38bdf8',
    borderRadius: 14,
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: '#04111f',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#365276',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: '#d9e7fb',
    fontSize: 14,
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  errorBox: {
    backgroundColor: '#3a1620',
    borderColor: '#7f2638',
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  errorTitle: {
    color: '#fecdd3',
    fontWeight: '800',
  },
  errorText: {
    color: '#fecdd3',
    fontSize: 13,
    lineHeight: 18,
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trackTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '800',
  },
  trackMeta: {
    color: '#9ca8bd',
    fontSize: 14,
  },
  progressText: {
    color: '#cbd5e1',
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
    borderColor: '#365276',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  roundButtonText: {
    color: '#d9e7fb',
    fontWeight: '700',
  },
  playButton: {
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    borderRadius: 999,
    flex: 1,
    paddingVertical: 13,
  },
  playButtonText: {
    color: '#04111f',
    fontWeight: '900',
  },
  separator: {
    backgroundColor: '#22314f',
    height: 1,
  },
  trackRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  trackText: {
    flex: 1,
    gap: 3,
  },
  listTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
  },
  listMeta: {
    color: '#9ca8bd',
    fontSize: 13,
  },
  playInline: {
    color: '#7dd3fc',
    fontSize: 13,
    fontWeight: '800',
  },
});
