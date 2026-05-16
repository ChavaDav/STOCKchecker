import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchApi } from '../api';
import { Activity } from 'lucide-react-native';
import { useTheme } from '../ThemeContext';

export default function LoginScreen({ setToken }) {
  const { colors, isDark, setThemeFromServer } = useTheme();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const body = isLogin ? { email, password } : { email, username, password };
      
      const data = await fetchApi(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
      });

      if (data.accessToken) {
        await AsyncStorage.setItem('token', data.accessToken);
        // Sync theme if it exists in user data
        if (data.user && data.user.theme) {
          setThemeFromServer(data.user.theme);
        }
        setToken(data.accessToken);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.logoContainer}>
        <Activity color={colors.primary} size={56} />
        <Text style={[styles.title, { color: colors.text }]}>StockSense</Text>
        <Text style={[styles.subtitleText, { color: colors.textSecondary }]}>Premium Market Insights</Text>
      </View>
      
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.subtitle, { color: colors.text }]}>{isLogin ? 'Welcome Back' : 'Create Account'}</Text>

        {error ? <Text style={[styles.error, { color: colors.danger, backgroundColor: colors.badgeDangerBg }]}>{error}</Text> : null}

        {!isLogin && (
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceHighlight, color: colors.text, borderColor: colors.border }]}
            placeholder="Username"
            placeholderTextColor={colors.textSecondary}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
        )}

        <TextInput
          style={[styles.input, { backgroundColor: colors.surfaceHighlight, color: colors.text, borderColor: colors.border }]}
          placeholder="Email address"
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={[styles.input, { backgroundColor: colors.surfaceHighlight, color: colors.text, borderColor: colors.border }]}
          placeholder="Password"
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isLogin ? 'Sign In' : 'Sign Up'}</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.switchButton}>
          <Text style={[styles.switchText, { color: colors.textSecondary }]}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{isLogin ? "Sign up" : "Log in"}</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    marginTop: 16,
    letterSpacing: -1,
  },
  subtitleText: {
    fontSize: 16,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  card: {
    padding: 28,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  subtitle: {
    fontSize: 24,
    marginBottom: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  input: {
    padding: 18,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    fontSize: 16,
  },
  button: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  switchButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 15,
  },
  error: {
    marginBottom: 16,
    textAlign: 'center',
    padding: 12,
    borderRadius: 8,
    overflow: 'hidden',
    fontWeight: '500',
  }
});
