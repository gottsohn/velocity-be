import { 
  Container, 
  Title, 
  Text, 
  Button, 
  Stack, 
  Box,
  useMantineColorScheme 
} from '@mantine/core';

export function NotFound() {
  const { colorScheme } = useMantineColorScheme();

  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colorScheme === 'dark' 
          ? 'radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0a 50%, #000 100%)'
          : 'radial-gradient(ellipse at center, #f8fafc 0%, #e2e8f0 100%)',
      }}
    >
      <Container size="sm">
        <Stack align="center" gap="xl">
          <Text size="8rem" style={{ lineHeight: 1 }}>
            🏎️💨
          </Text>
          
          <Stack align="center" gap="xs">
            <Title order={1} style={{ fontSize: '3rem', letterSpacing: '-0.03em' }}>
              Stream Not Found
            </Title>
            <Text size="lg" c="dimmed" ta="center">
              This stream ID doesn't exist or has expired.
              <br />
              Please check the URL and try again.
            </Text>
          </Stack>

          <Stack gap="md" align="center">
            <Text size="sm" c="dimmed">
              Add a stream ID to the URL like:
            </Text>
            <Text 
              ff="monospace" 
              size="sm" 
              p="md" 
              style={{
                background: colorScheme === 'dark' 
                  ? 'rgba(255, 140, 0, 0.1)' 
                  : 'rgba(255, 140, 0, 0.05)',
                borderRadius: 8,
                border: '1px solid rgba(255, 140, 0, 0.2)',
              }}
            >
              {window.location.origin}/?stream=<Text span c="orange">YOUR_STREAM_ID</Text>
            </Text>
          </Stack>

          <Button 
            variant="light" 
            color="orange"
            size="lg"
            radius="xl"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}
