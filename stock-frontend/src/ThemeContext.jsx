import React, { createContext, useState, useEffect, useContext } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme !== null) {
      setIsDark(savedTheme === 'dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(prefersDark);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      document.body.className = isDark ? 'dark-theme' : 'light-theme';
    }
  }, [isDark, isLoaded]);

  const toggleTheme = async () => {
    try {
      const newTheme = !isDark;
      setIsDark(newTheme);
      localStorage.setItem('appTheme', newTheme ? 'dark' : 'light');
      
      // Save to backend if token exists
      const token = localStorage.getItem('token');
      if (token) {
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/auth/me`, {
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

  const setThemeFromServer = (serverTheme) => {
    const isDarkTheme = serverTheme === 'dark';
    setIsDark(isDarkTheme);
    localStorage.setItem('appTheme', isDarkTheme ? 'dark' : 'light');
  };

  if (!isLoaded) return null;

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, setThemeFromServer }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
