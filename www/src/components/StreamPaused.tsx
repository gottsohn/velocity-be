import { 
  Box,
  Text,
  Stack,
  useMantineColorScheme,
} from '@mantine/core';

export function StreamPaused() {
  const { colorScheme } = useMantineColorScheme();

  return (
    <Box
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colorScheme === 'dark'
          ? 'rgba(0, 0, 0, 0.85)'
          : 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        borderRadius: 'inherit',
      }}
    >
      <Stack align="center" gap="md">
        <Box
          style={{
            width: 80,
            height: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: colorScheme === 'dark'
              ? 'rgba(255, 140, 0, 0.15)'
              : 'rgba(255, 140, 0, 0.1)',
            borderRadius: '50%',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        >
          <Text size="2.5rem">⏸️</Text>
        </Box>
        
        <Stack align="center" gap={4}>
          <Text 
            size="xl" 
            fw={700}
            style={{
              letterSpacing: '-0.02em',
            }}
          >
            Stream Paused
          </Text>
          <Text size="sm" c="dimmed" ta="center">
            The broadcaster has paused the stream.
            <br />
            It will resume shortly...
          </Text>
        </Stack>

        {/* Animated dots */}
        <Box style={{ display: 'flex', gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#ff8c00',
                animation: `bounce 1.4s ease-in-out ${i * 0.16}s infinite`,
              }}
            />
          ))}
        </Box>
      </Stack>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.8;
          }
        }
        
        @keyframes bounce {
          0%, 80%, 100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-8px);
          }
        }
      `}</style>
    </Box>
  );
}
