import {
  Container,
  Grid,
  Paper,
  Title,
  Text,
  Group,
  ActionIcon,
  useMantineColorScheme,
  Box,
  Stack,
  Transition,
} from '@mantine/core';
import { useWebSocket } from '../hooks/useWebSocket';
import { RouteMap } from '../components/RouteMap';
import { StatsPanel } from '../components/StatsPanel';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { StreamClosed } from '../components/StreamClosed';
import { StreamPaused } from '../components/StreamPaused';

interface DashboardProps {
  streamId: string;
}

export function Dashboard({ streamId }: DashboardProps) {
  const { streamData, status, error, reconnect, isStreamClosed } = useWebSocket(streamId);
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  // Use a synchronous initial value - component is mounted when it renders
  const mounted = true;

  // Show StreamClosed component when stream is closed
  if (isStreamClosed) {
    return <StreamClosed streamId={streamId} />;
  }

  return (
    <Box
      style={{
        minHeight: '100vh',
        background: colorScheme === 'dark'
          ? 'radial-gradient(ellipse at top, #1a1a2e 0%, #0a0a0a 50%, #000 100%)'
          : 'radial-gradient(ellipse at top, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative elements */}
      <Box
        style={{
          position: 'absolute',
          top: -100,
          right: -100,
          width: 400,
          height: 400,
          background: 'radial-gradient(circle, rgba(255, 140, 0, 0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <Box
        style={{
          position: 'absolute',
          bottom: -150,
          left: -150,
          width: 500,
          height: 500,
          background: 'radial-gradient(circle, rgba(34, 197, 94, 0.05) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <Container size="xl" py="xl" style={{ position: 'relative', zIndex: 1 }}>
        <Transition mounted={mounted} transition="fade" duration={400}>
          {(styles) => (
            <Stack gap="lg" style={styles}>
              {/* Header */}
              <Paper
                p="lg"
                radius="lg"
                style={{
                  background: colorScheme === 'dark'
                    ? 'rgba(30, 30, 30, 0.8)'
                    : 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: colorScheme === 'dark'
                    ? '1px solid rgba(255, 255, 255, 0.1)'
                    : '1px solid rgba(0, 0, 0, 0.1)',
                }}
              >
                <Group justify="space-between" align="center">
                  <Group gap="md">
                    <Text size="2rem">🏁</Text>
                    <Stack gap={0}>
                      <Title order={2} style={{ letterSpacing: '-0.02em' }}>
                        Velocity Live
                      </Title>
                      <Text size="sm" c="dimmed">
                        Stream ID: <Text span ff="monospace" fw={600} c="orange">{streamId}</Text>
                      </Text>
                    </Stack>
                  </Group>

                  <Group gap="md">
                    <ConnectionStatus status={status} onReconnect={reconnect} />
                    <ActionIcon
                      variant="light"
                      size="lg"
                      radius="xl"
                      onClick={() => toggleColorScheme()}
                      color="gray"
                    >
                      {colorScheme === 'dark' ? '☀️' : '🌙'}
                    </ActionIcon>
                  </Group>
                </Group>
              </Paper>

              {/* Error message */}
              {error && !isStreamClosed && (
                <Paper
                  p="md"
                  radius="md"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                  }}
                >
                  <Text c="red" size="sm">
                    ⚠️ {error}
                  </Text>
                </Paper>
              )}

              {/* Main content */}
              <Grid gutter="lg">
                {/* Map section */}
                <Grid.Col span={{ base: 12, md: 8 }}>
                  {/* Stream paused overlay */}
                  {streamData?.isPaused && <StreamPaused />}
                  <Transition mounted={mounted} transition="slide-right" duration={600}>
                    {(styles) => (
                      <Paper
                        p={0}
                        radius="lg"
                        style={{
                          ...styles,
                          height: 'calc(100vh - 200px)',
                          minHeight: 400,
                          overflow: 'hidden',
                          background: colorScheme === 'dark'
                            ? 'rgba(30, 30, 30, 0.6)'
                            : 'rgba(255, 255, 255, 0.8)',
                          backdropFilter: 'blur(10px)',
                          border: colorScheme === 'dark'
                            ? '1px solid rgba(255, 255, 255, 0.1)'
                            : '1px solid rgba(0, 0, 0, 0.1)',
                          position: 'relative',
                        }}
                      >
                        <RouteMap streamData={streamData} />
                      </Paper>
                    )}
                  </Transition>
                </Grid.Col>

                {/* Stats panel */}
                <Grid.Col span={{ base: 12, md: 4 }}>
                  <Transition mounted={mounted} transition="slide-left" duration={600} timingFunction="ease">
                    {(styles) => (
                      <Box
                        style={{
                          ...styles,
                          height: 'calc(100vh - 200px)',
                          minHeight: 400,
                          overflowY: 'auto',
                        }}
                      >
                        <StatsPanel streamData={streamData} />
                      </Box>
                    )}
                  </Transition>
                </Grid.Col>
              </Grid>
            </Stack>
          )}
        </Transition>
      </Container>
    </Box>
  );
}
