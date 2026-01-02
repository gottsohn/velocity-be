import { useState } from 'react';
import { Paper, Group, Stack, Text, Badge, ThemeIcon, useMantineTheme } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { StreamData } from '../types/stream';

interface CachedAddressData {
  startAddressLine: string;
  startPostalCode: string;
  startCity: string;
  endAddressLine: string;
  endPostalCode: string;
  endCity: string;
  destinationAddressLine: string;
  destinationPostalCode: string;
  destinationCity: string;
  destinationName: string;
}

const defaultAddressData: CachedAddressData = {
  startAddressLine: '',
  startPostalCode: '',
  startCity: '',
  endAddressLine: '',
  endPostalCode: '',
  endCity: '',
  destinationAddressLine: '',
  destinationPostalCode: '',
  destinationCity: '',
  destinationName: '',
};

interface StatsPanelProps {
  streamData: StreamData | null;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

function StatCard({ 
  icon, 
  label, 
  value, 
  unit,
  color = 'orange'
}: { 
  icon: string; 
  label: string; 
  value: string | number; 
  unit?: string;
  color?: string;
}) {
  const theme = useMantineTheme();
  
  return (
    <Paper 
      p="md" 
      radius="lg"
      style={{
        background: `linear-gradient(135deg, ${theme.colors.dark[7]} 0%, ${theme.colors.dark[8]} 100%)`,
        border: `1px solid ${theme.colors.dark[5]}`,
      }}
    >
      <Group gap="sm">
        <ThemeIcon 
          size="lg" 
          radius="md" 
          variant="light"
          color={color}
        >
          <span style={{ fontSize: '1.2rem' }}>{icon}</span>
        </ThemeIcon>
        <Stack gap={2}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
            {label}
          </Text>
          <Group gap={4} align="baseline">
            <Text size="xl" fw={700} c={color}>
              {value}
            </Text>
            {unit && (
              <Text size="sm" c="dimmed">
                {unit}
              </Text>
            )}
          </Group>
        </Stack>
      </Group>
    </Paper>
  );
}

export function StatsPanel({ streamData }: StatsPanelProps) {
  const { t } = useTranslation();
  // Cache address data - only update when new non-empty values are received
  const [addressData, setAddressData] = useState<CachedAddressData>(defaultAddressData);
  const [prevStreamData, setPrevStreamData] = useState<StreamData | null>(null);

  // Update cached values during render (React-approved pattern for derived state)
  // This avoids cascading renders from useEffect + setState
  if (streamData !== prevStreamData) {
    setPrevStreamData(streamData);
    if (streamData) {
      const nextAddressData = {
        startAddressLine: streamData.startAddressLine || addressData.startAddressLine,
        startPostalCode: streamData.startPostalCode || addressData.startPostalCode,
        startCity: streamData.startCity || addressData.startCity,
        endAddressLine: streamData.endAddressLine || addressData.endAddressLine,
        endPostalCode: streamData.endPostalCode || addressData.endPostalCode,
        endCity: streamData.endCity || addressData.endCity,
        destinationAddressLine: streamData.destinationAddressLine || addressData.destinationAddressLine,
        destinationPostalCode: streamData.destinationPostalCode || addressData.destinationPostalCode,
        destinationCity: streamData.destinationCity || addressData.destinationCity,
        destinationName: streamData.destinationName || addressData.destinationName,
      };
      setAddressData(nextAddressData);
    }
  }

  if (!streamData) {
    return (
      <Paper p="xl" radius="lg" withBorder>
        <Text c="dimmed" ta="center">
          {t('stats.waitingForData')}
        </Text>
      </Paper>
    );
  }

  const progress = streamData.expectedDistanceKm 
    ? Math.min(100, (streamData.distanceKm / streamData.expectedDistanceKm) * 100)
    : 0;

    console.log(streamData);
  return (
    <Stack gap="md">
      {/* Car Info */}
      <Paper 
        p="lg" 
        radius="lg"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 140, 0, 0.1) 0%, rgba(255, 140, 0, 0.05) 100%)',
          border: '1px solid rgba(255, 140, 0, 0.2)',
        }}
      >
        <Group justify="space-between" align="center">
          <Stack gap={2}>
            <Text size="lg" fw={700}>
              {streamData.car ? streamData.car.name + " " + streamData.car.model : "-"}
            </Text>
            <Group gap="xs">
              <Badge variant="light" color="orange" size="sm">
                {streamData.car?.horsePower ?? "-"} {t('stats.hp')}
              </Badge>
            </Group>
          </Stack>
          <Text size="2rem">🏎️</Text>
        </Group>
      </Paper>

      {/* Current Speed - Prominent Display */}
      <Paper 
        p="lg" 
        radius="lg"
        style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
        }}
      >
        <Group justify="space-between" align="center">
          <Stack gap={2}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
              {t('stats.currentSpeed')}
            </Text>
            <Group gap={4} align="baseline">
              <Text size="2.5rem" fw={700} c="blue" style={{ lineHeight: 1 }}>
                {streamData.currentSpeedKmh.toFixed(1)}
              </Text>
              <Text size="lg" c="dimmed">
                {t('stats.kmh')}
              </Text>
            </Group>
          </Stack>
          <Text size="3rem">🏎️💨</Text>
        </Group>
      </Paper>

      {/* Stats Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(2, 1fr)', 
        gap: '12px' 
      }}>
        <StatCard 
          icon="⏱️" 
          label={t('stats.duration')} 
          value={formatDuration(streamData.duration)} 
        />
        <StatCard 
          icon="📏" 
          label={t('stats.distance')} 
          value={streamData.distanceKm.toFixed(2)} 
          unit={t('stats.km')}
        />
        <StatCard 
          icon="🚀" 
          label={t('stats.maxSpeed')} 
          value={streamData.maxSpeedKmh.toFixed(1)} 
          unit={t('stats.kmh')}
          color="red"
        />
        <StatCard 
          icon="📊" 
          label={t('stats.progress')} 
          value={progress.toFixed(0)} 
          unit="%"
          color="teal"
        />
      </div>

      {/* Route Info */}
      <Paper 
        p="lg" 
        radius="lg"
        style={{
          background: 'linear-gradient(180deg, rgba(34, 197, 94, 0.05) 0%, rgba(239, 68, 68, 0.05) 100%)',
        }}
      >
        <Stack gap="md">
          {/* Start */}
          <Group gap="sm" align="flex-start">
            <ThemeIcon size="md" radius="xl" color="green" variant="filled">
              <span style={{ fontSize: '0.8rem' }}>📍</span>
            </ThemeIcon>
            <Stack gap={2}>
              <Text size="xs" c="dimmed" tt="uppercase">{t('stats.from')}</Text>
              <Text size="sm" fw={600}>
                {addressData.startAddressLine}
              </Text>
              <Text size="xs" c="dimmed">
                {addressData.startPostalCode} {addressData.startCity}
              </Text>
            </Stack>
          </Group>

          {/* Divider line */}
          <div style={{ 
            width: '2px', 
            height: '20px', 
            background: 'linear-gradient(to bottom, #22c55e, #ef4444)',
            marginLeft: '15px'
          }} />

          {/* End */}
          <Group gap="sm" align="flex-start">
            <ThemeIcon size="md" radius="xl" color="red" variant="filled">
              <span style={{ fontSize: '0.8rem' }}>🎯</span>
            </ThemeIcon>
            <Stack gap={2}>
              <Text size="xs" c="dimmed" tt="uppercase">{t('stats.to')}</Text>
              <Text size="sm" fw={600}>
                {addressData.destinationName}
              </Text>
              <Text size="xs" c="dimmed">
                {addressData.destinationPostalCode} {addressData.destinationCity}
              </Text>
            </Stack>
          </Group>
        </Stack>
      </Paper>

      {/* Expected Stats */}
      <Group grow>
        <Paper p="md" radius="md" withBorder>
          <Stack gap={2} align="center">
            <Text size="xs" c="dimmed">{t('stats.expectedTime')}</Text>
            <Text size="lg" fw={700}>
              {formatDuration(streamData.expectedDuration)}
            </Text>
          </Stack>
        </Paper>
        {streamData.expectedDistanceKm && (
          <Paper p="md" radius="md" withBorder>
            <Stack gap={2} align="center">
              <Text size="xs" c="dimmed">{t('stats.expectedDistance')}</Text>
              <Text size="lg" fw={700}>
                {streamData.expectedDistanceKm.toFixed(1)} {t('stats.km')}
              </Text>
            </Stack>
          </Paper>
        )}
      </Group>
    </Stack>
  );
}
