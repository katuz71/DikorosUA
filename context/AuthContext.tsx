import { API_URL } from '@/config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext } from 'react';

export const STORAGE_JWT_KEY = 'userToken';

const AUTH_KEYS = [
  'userPhone',
  'userName',
  'userCity',
  'userWarehouse',
  'userUkrposhta',
  'userEmail',
  'userContactPreference',
  STORAGE_JWT_KEY,
] as const;

type AuthContextType = {
  /** Очищает все данные авторизации (AsyncStorage + SecureStore). Не показывает UI. */
  clearAllAuth: () => Promise<void>;
  /**
   * Проверяет токен запросом GET /api/user/me.
   * Если токен есть и сервер вернул 401 — вызывает clearAllAuth() и возвращает false.
   * Если токена нет — возвращает true (гость). Иначе возвращает true.
   */
  validateToken: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType>({
  clearAllAuth: async () => {},
  validateToken: async () => true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const clearAllAuth = useCallback(async () => {
    console.log('[Auth] clearAllAuth() executing');
    try {
      for (const key of AUTH_KEYS) {
        await AsyncStorage.removeItem(key);
      }
      await SecureStore.deleteItemAsync(STORAGE_JWT_KEY);
    } catch (e) {
      console.warn('[Auth] clearAllAuth error:', e);
    }
  }, []);

  const validateToken = useCallback(async (): Promise<boolean> => {
    let token: string | null = null;
    try {
      token = await SecureStore.getItemAsync(STORAGE_JWT_KEY);
      if (!token?.trim()) {
        token = await AsyncStorage.getItem(STORAGE_JWT_KEY);
      }
    } catch {
      // no token
    }
    if (!token?.trim()) return true; // гость — не валидируем

    try {
      const url = `${API_URL}/api/user/me`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token.trim()}` },
      });
      if (res.status === 401) {
        console.log('[Auth] clearAllAuth called: request GET /api/user/me returned 401 (invalid or expired token)');
        await clearAllAuth();
        return false;
      }
      return true;
    } catch (e) {
      // сетевые ошибки не считаем за 401 — сессию не ломаем
      console.warn('[Auth] validateToken request failed:', e);
      return true;
    }
  }, [clearAllAuth]);

  return (
    <AuthContext.Provider value={{ clearAllAuth, validateToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
