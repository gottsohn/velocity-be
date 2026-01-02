import { Badge, Group, ActionIcon, Tooltip } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { ConnectionStatus as ConnectionStatusType } from '../types/stream';

interface ConnectionStatusProps {
  status: ConnectionStatusType;
  onReconnect: () => void;
}

export function ConnectionStatus({ status, onReconnect }: ConnectionStatusProps) {
  const { t } = useTranslation();

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'green';
      case 'connecting': return 'yellow';
      case 'disconnected': return 'gray';
      case 'error': return 'red';
      case 'closed': return 'red';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected': return t('connection.live');
      case 'connecting': return t('connection.connecting');
      case 'disconnected': return t('connection.disconnected');
      case 'error': return t('connection.connectionError');
      case 'closed': return t('connection.streamClosed');
    }
  };

  return (
    <Group gap="xs">
      <Badge 
        variant={status === 'connected' ? 'filled' : 'light'} 
        color={getStatusColor()}
        size="lg"
        leftSection={status === 'connected' && (
          <span style={{ 
            width: 8, 
            height: 8, 
            borderRadius: '50%', 
            background: 'currentColor',
            animation: 'pulse 2s infinite'
          }} />
        )}
      >
        {getStatusText()}
      </Badge>
      
      {(status === 'disconnected' || status === 'error') && (
        <Tooltip label={t('connection.reconnect')}>
          <ActionIcon 
            variant="light" 
            color="orange" 
            onClick={onReconnect}
            radius="xl"
          >
            🔄
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  );
}
