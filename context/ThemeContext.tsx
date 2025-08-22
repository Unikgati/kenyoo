
import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { CompanySettings, ThemeColors } from '../types';
import { MOCK_SETTINGS } from '../lib/mockData';
import { hexToHSL } from '../lib/utils';
import { useData } from './DataContext';

interface ThemeContextType {
  settings: CompanySettings;
  updateSettings: (newSettings: Partial<CompanySettings>) => void;
  resetSettings: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  formatCurrency: (value: number) => string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { settings: dataSettings, updateSettings: updateDataSettings } = useData();
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Use settings from data context, but fall back to mock settings if not loaded yet
  const settings = dataSettings || MOCK_SETTINGS;

  const applyTheme = useCallback((themeSettings: CompanySettings, isDark: boolean) => {
    const theme = themeSettings.theme as unknown as ThemeColors;
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.style.setProperty('--color-primary', hexToHSL('#111827'));
      root.style.setProperty('--color-primary-foreground', hexToHSL(theme.background));
      root.style.setProperty('--color-accent', '210 40% 98%'); 
      root.style.setProperty('--color-secondary', hexToHSL('#1f2937'));
      root.style.setProperty('--color-secondary-foreground', hexToHSL('#f9fafb'));
      root.style.setProperty('--color-background', hexToHSL('#111827'));
      root.style.setProperty('--color-card', hexToHSL('#1f2937'));
      root.style.setProperty('--color-foreground', hexToHSL(theme.background));
      root.style.setProperty('--color-card-foreground', hexToHSL(theme.background));
      root.style.setProperty('--color-border', hexToHSL('#374151'));
      root.style.setProperty('--color-input', hexToHSL('#374151'));
    } else {
      root.classList.remove('dark');
      root.style.setProperty('--color-primary', hexToHSL(theme.primary));
      root.style.setProperty('--color-primary-foreground', hexToHSL(theme.background));
      root.style.setProperty('--color-accent', hexToHSL(theme.primary));
      root.style.setProperty('--color-secondary', hexToHSL(theme.secondary));
      root.style.setProperty('--color-secondary-foreground', hexToHSL(theme.primary));
      root.style.setProperty('--color-background', hexToHSL(theme.background));
      root.style.setProperty('--color-foreground', hexToHSL(theme.foreground));
      root.style.setProperty('--color-card', hexToHSL(theme.background));
      root.style.setProperty('--color-card-foreground', hexToHSL(theme.foreground));
      root.style.setProperty('--color-border', hexToHSL(theme.secondary));
      root.style.setProperty('--color-input', hexToHSL(theme.secondary));
    }
  }, []);

  useEffect(() => {
    if (settings) {
        applyTheme(settings, isDarkMode);
        const favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']");
        if (favicon && settings.faviconUrl) {
          favicon.href = settings.faviconUrl;
        }
    }
  }, [settings, isDarkMode, applyTheme]);

  const updateSettings = (newSettings: Partial<CompanySettings>) => {
    updateDataSettings(newSettings);
  };

  const resetSettings = () => {
    const { id, ...mockDataWithoutId } = MOCK_SETTINGS;
    updateDataSettings(mockDataWithoutId);
  };
  
  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  const formatCurrency = useCallback((value: number) => {
      const options: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: settings.currency,
        minimumFractionDigits: ['IDR', 'JPY'].includes(settings.currency) ? 0 : 2,
        maximumFractionDigits: ['IDR', 'JPY'].includes(settings.currency) ? 0 : 2,
      };

      let locale = 'en-US';
      if (settings.currency === 'IDR') locale = 'id-ID';
      if (settings.currency === 'EUR') locale = 'de-DE';
      if (settings.currency === 'JPY') locale = 'ja-JP';

      return new Intl.NumberFormat(locale, options).format(value);
  }, [settings.currency]);

  return (
    <ThemeContext.Provider value={{ settings, updateSettings, resetSettings, isDarkMode, toggleDarkMode, formatCurrency }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
