import { 
  Container, 
  Title, 
  Text, 
  Stack, 
  Box,
  useMantineColorScheme,
  Paper,
  ThemeIcon,
  Group,
  ActionIcon,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';

interface StreamClosedProps {
  streamId: string;
}

export function StreamClosed({ streamId }: StreamClosedProps) {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const { t } = useTranslation();

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
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Language and theme switcher */}
      <Group
        gap="xs"
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          zIndex: 10,
        }}
      >
        <LanguageSwitcher />
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

      {/* Decorative gradient overlay */}
      <Box
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600,
          height: 600,
          background: 'radial-gradient(circle, rgba(239, 68, 68, 0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <Container size="sm" style={{ position: 'relative', zIndex: 1 }}>
        <Paper
          p="xl"
          radius="xl"
          style={{
            background: colorScheme === 'dark'
              ? 'rgba(30, 30, 30, 0.8)'
              : 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(20px)',
            border: colorScheme === 'dark'
              ? '1px solid rgba(239, 68, 68, 0.2)'
              : '1px solid rgba(239, 68, 68, 0.1)',
            textAlign: 'center',
          }}
        >
          <Stack align="center" gap="xl">
            <ThemeIcon
              size={100}
              radius="xl"
              variant="light"
              color="red"
              style={{
                animation: 'fadeIn 0.5s ease-out',
              }}
            >
              <Text size="3rem">🏁</Text>
            </ThemeIcon>
            
            <Stack align="center" gap="xs">
              <Title 
                order={1} 
                style={{ 
                  fontSize: '2.5rem', 
                  letterSpacing: '-0.03em',
                  background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {t('streamClosed.title')}
              </Title>
              <Text size="lg" c="dimmed" ta="center" maw={400}>
                {t('streamClosed.description')}
              </Text>
            </Stack>

            <Paper
              p="md"
              radius="md"
              style={{
                background: colorScheme === 'dark'
                  ? 'rgba(255, 255, 255, 0.05)'
                  : 'rgba(0, 0, 0, 0.03)',
              }}
            >
              <Stack gap={4} align="center">
                <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                  {t('streamClosed.streamId')}
                </Text>
                <Text ff="monospace" fw={600} c="orange">
                  {streamId}
                </Text>
              </Stack>
            </Paper>

            <Text size="sm" c="dimmed">
              {t('streamClosed.thankYou')} 🚗💨
            </Text>
          </Stack>
        </Paper>
      </Container>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </Box>
  );
}
