import { 
  Container, 
  Title, 
  Text, 
  Button, 
  Stack, 
  Box,
  Group,
  ActionIcon,
  useMantineColorScheme 
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export function NotFound() {
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

      <Container size="sm">
        <Stack align="center" gap="xl">
          <Text size="8rem" style={{ lineHeight: 1 }}>
            🏎️💨
          </Text>
          
          <Stack align="center" gap="xs">
            <Title order={1} style={{ fontSize: '3rem', letterSpacing: '-0.03em' }}>
              {t('notFound.title')}
            </Title>
            <Text size="lg" c="dimmed" ta="center">
              {t('notFound.description')}
              <br />
              {t('notFound.checkUrl')}
            </Text>
          </Stack>

          <Stack gap="md" align="center">
            <Text size="sm" c="dimmed">
              {t('notFound.addStreamId')}
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
            {t('notFound.refreshPage')}
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}
