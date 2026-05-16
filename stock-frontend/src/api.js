const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const fetchApi = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  
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
