import { Menu, ActionIcon, Text, Group, ScrollArea } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { languages } from '../i18n';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const currentLanguage = languages.find((lang) => lang.code === i18n.language) || languages[0];

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
  };

  return (
    <Menu shadow="md" width={220} position="bottom-end">
      <Menu.Target>
        <ActionIcon
          variant="light"
          size="lg"
          radius="xl"
          color="gray"
          aria-label={t('language.select')}
        >
          🌐
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>{t('language.select')}</Menu.Label>
        <ScrollArea.Autosize mah={300}>
          {languages.map((language) => (
            <Menu.Item
              key={language.code}
              onClick={() => handleLanguageChange(language.code)}
              style={{
                backgroundColor:
                  language.code === currentLanguage.code
                    ? 'var(--mantine-color-orange-light)'
                    : undefined,
              }}
            >
              <Group gap="xs" justify="space-between" w="100%">
                <Text size="sm" fw={language.code === currentLanguage.code ? 600 : 400}>
                  {language.nativeName}
                </Text>
                <Text size="xs" c="dimmed">
                  {language.name}
                </Text>
              </Group>
            </Menu.Item>
          ))}
        </ScrollArea.Autosize>
      </Menu.Dropdown>
    </Menu>
  );
}
