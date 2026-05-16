import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, SafeAreaView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchApi } from '../api';
import { LogOut, Search, TrendingUp, AlertCircle, Sun, Moon } from 'lucide-react-native';
import { getLocalSuggestions } from '../utils/stockDictionary';
import { useTheme } from '../ThemeContext';

export default function DashboardScreen({ setToken }) {
  const { colors, isDark, toggleTheme } = useTheme();
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    loadTrending();
  }, []);

  const loadTrending = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi('/stocks/market/trending');
      setTrending(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    setToken(null);
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    if (text.length > 0) {
      setSuggestions(getLocalSuggestions(text));
    } else {
      setSuggestions([]);
    }
  };

  const renderStockItem = ({ item }) => (
    <TouchableOpacity style={[styles.stockCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.stockInfo}>
        <Text style={[styles.stockSymbol, { color: colors.text }]}>{item.symbol}</Text>
        <Text style={[styles.stockName, { color: colors.textSecondary }]} numberOfLines={1}>{item.name}</Text>
      </View>
      <View style={styles.stockPriceContainer}>
        <Text style={[styles.stockPrice, { color: colors.text }]}>${item.price?.toFixed(2) || '---'}</Text>
        <View style={[styles.badge, item.change >= 0 ? { backgroundColor: colors.badgeSuccessBg } : { backgroundColor: colors.badgeDangerBg }]}>
          <Text style={[styles.badgeText, { color: item.change >= 0 ? colors.success : colors.danger }]}>
            {item.change >= 0 ? '+' : ''}{item.changePercent?.toFixed(2) || '0.00'}%
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>Welcome back,</Text>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Dashboard</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={toggleTheme} style={[styles.iconBtn, { backgroundColor: colors.surfaceHighlight }]}>
            {isDark ? <Sun color={colors.text} size={22} /> : <Moon color={colors.text} size={22} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={[styles.iconBtn, { backgroundColor: colors.badgeDangerBg, marginLeft: 12 }]}>
            <LogOut color={colors.danger} size={22} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchWrapper}>
        <View style={[styles.searchContainer, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}>
          <Search color={colors.textSecondary} size={20} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search stocks, ETFs..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Text style={{ color: colors.textSecondary, fontWeight: 'bold', fontSize: 16 }}>×</Text>
            </TouchableOpacity>
          )}
        </View>

        {suggestions.length > 0 && (
          <View style={[styles.suggestionsContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {suggestions.map((item, index) => (
              <TouchableOpacity 
                key={item.symbol} 
                style={[
                  styles.suggestionItem, 
                  { borderBottomColor: colors.border },
                  index === suggestions.length - 1 && { borderBottomWidth: 0 }
                ]}
                onPress={() => {
                  setSearchQuery(item.symbol);
                  setSuggestions([]);
                }}
              >
                <View style={styles.suggestionRow}>
                  <View style={styles.symbolBadge}>
                    <Text style={[styles.suggestionSymbol, { color: colors.text }]}>{item.symbol}</Text>
                  </View>
                  <Text style={[styles.suggestionName, { color: colors.textSecondary }]} numberOfLines={1}>{item.name}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <AlertCircle color={colors.danger} size={48} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Service Error</Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={loadTrending}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.sectionHeader}>
            <TrendingUp color={colors.primary} size={22} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Trending Markets</Text>
          </View>
          <FlatList
            data={trending}
            keyExtractor={item => item.symbol}
            renderItem={renderStockItem}
            contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 40 : 20 }}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
  },
  iconBtn: {
    padding: 10,
    borderRadius: 12,
  },
  searchWrapper: {
    zIndex: 100,
    marginBottom: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 60,
    left: 24,
    right: 24,
    borderRadius: 16,
    padding: 4,
    backgroundColor: 'white',
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 10,
    zIndex: 1000,
  },
  suggestionItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  symbolBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  suggestionSymbol: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  suggestionName: {
    flex: 1,
    fontSize: 14,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginLeft: 10,
    letterSpacing: -0.5,
  },
  stockCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  stockInfo: {
    flex: 1,
  },
  stockSymbol: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  stockName: {
    fontSize: 14,
    marginTop: 6,
    fontWeight: '500',
  },
  stockPriceContainer: {
    alignItems: 'flex-end',
  },
  stockPrice: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 20,
    marginBottom: 10,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 30,
    fontSize: 16,
    lineHeight: 24,
  },
  retryBtn: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
