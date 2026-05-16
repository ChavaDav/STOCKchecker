import React, { createContext, useState, useEffect, useContext } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [isDark, setIsDark] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('appTheme');
      if (savedTheme !== null) {
        setIsDark(savedTheme === 'dark');
      } else {
        setIsDark(systemColorScheme === 'dark');
      }
    } catch (e) {
      console.log('Error loading theme:', e);
    } finally {
      setIsLoaded(true);
    }
  };

  const toggleTheme = async () => {
    try {
      const newTheme = !isDark;
      setIsDark(newTheme);
      await AsyncStorage.setItem('appTheme', newTheme ? 'dark' : 'light');
      // Save to backend if token exists
      const token = await AsyncStorage.getItem('token');
      if (token) {
        // Intentionally fire and forget to avoid UI blocking
        fetch('http://192.168.1.80:3001/api/auth/me', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ theme: newTheme ? 'dark' : 'light' })
        }).catch(err => console.log('Failed to sync theme', err));
      }
    } catch (e) {
      console.log('Error saving theme:', e);
    }
  };

  const setThemeFromServer = async (serverTheme) => {
    const isDarkTheme = serverTheme === 'dark';
    setIsDark(isDarkTheme);
    await AsyncStorage.setItem('appTheme', isDarkTheme ? 'dark' : 'light');
  };

  const theme = {
    isDark,
    toggleTheme,
    setThemeFromServer,
    colors: isDark ? {
      background: '#0f172a',
      surface: '#1e293b',
      surfaceHighlight: '#334155',
      primary: '#3b82f6',
      primaryHover: '#2563eb',
      text: '#f8fafc',
      textSecondary: '#94a3b8',
      border: '#334155',
      success: '#10b981',
      danger: '#ef4444',
      badgeSuccessBg: 'rgba(16, 185, 129, 0.2)',
      badgeDangerBg: 'rgba(239, 68, 68, 0.2)',
    } : {
      background: '#f8fafc',
      surface: '#ffffff',
      surfaceHighlight: '#f1f5f9',
      primary: '#2563eb',
      primaryHover: '#1d4ed8',
      text: '#0f172a',
      textSecondary: '#64748b',
      border: '#e2e8f0',
      success: '#059669',
      danger: '#dc2626',
      badgeSuccessBg: 'rgba(16, 185, 129, 0.15)',
      badgeDangerBg: 'rgba(239, 68, 68, 0.15)',
    }
  };

  if (!isLoaded) return null;

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
