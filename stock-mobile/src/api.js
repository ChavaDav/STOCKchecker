import AsyncStorage from '@react-native-async-storage/async-storage';

// URL base de la API. IMPORTANTE: Si pruebas en dispositivo físico, cambia 'localhost' por la IP de tu PC en la red local.
// Para Android Emulator puedes usar 'http://10.0.2.2:3001/api'
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.80:3001/api';

export const fetchApi = async (endpoint, options = {}) => {
  const token = await AsyncStorage.getItem('token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    let errorMessage = data.message || data.error || 'Something went wrong';
    if (data.details && Array.isArray(data.details)) {
      errorMessage += ': ' + data.details.map(d => d.message).join('. ');
    }
    throw new Error(errorMessage);
  }

  return data;
};
