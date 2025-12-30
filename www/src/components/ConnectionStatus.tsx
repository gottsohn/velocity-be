import { Badge, Group, ActionIcon, Tooltip } from '@mantine/core';
import type { ConnectionStatus as ConnectionStatusType } from '../types/stream';

interface ConnectionStatusProps {
  status: ConnectionStatusType;
  onReconnect: () => void;
}

export function ConnectionStatus({ status, onReconnect }: ConnectionStatusProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'green';
      case 'connecting': return 'yellow';
      case 'disconnected': return 'gray';
      case 'error': return 'red';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected': return 'Live';
      case 'connecting': return 'Connecting...';
      case 'disconnected': return 'Disconnected';
      case 'error': return 'Connection Error';
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
        <Tooltip label="Reconnect">
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
