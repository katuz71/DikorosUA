import { API_URL } from '@/config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useState } from 'react';

export type UserProfile = {
  bonus_balance: number;
  bonuses?: number;
  name?: string;
  email?: string;
  city?: string;
  warehouse?: string;
  ukrposhta?: string;
  contact_preference?: string;
};

type UserProfileContextType = {
  userProfile: UserProfile | null;
  profileLoading: boolean;
  fetchUserInfo: (phone?: string | null) => Promise<void>;
  /** Обновить баланс бонусов з API (аліас fetchUserInfo для екрану чекаута). */
  updateBalanceFromAPI: (phone?: string | null) => Promise<void>;
};

const UserProfileContext = createContext<UserProfileContextType>({
  userProfile: null,
  profileLoading: false,
  fetchUserInfo: async () => {},
  updateBalanceFromAPI: async () => {},
});

export const UserProfileProvider = ({ children }: { children: React.ReactNode }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const fetchUserInfo = useCallback(async (phoneOverride?: string | null) => {
    setProfileLoading(true);
    try {
      const phone = phoneOverride ?? await AsyncStorage.getItem('userPhone');
      if (!phone?.trim()) {
        setUserProfile(null);
        return;
      }
      const res = await fetch(`${API_URL}/user/${phone.trim()}`);
      if (res.ok) {
        const data = await res.json();
        const bonus_balance = data.bonus_balance ?? 0;
        setUserProfile({
          bonus_balance,
          bonuses: bonus_balance,
          name: data.name,
          email: data.email,
          city: data.city,
          warehouse: data.warehouse,
          ukrposhta: data.ukrposhta,
          contact_preference: data.contact_preference,
        });
      } else {
        setUserProfile(null);
      }
    } catch {
      setUserProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const updateBalanceFromAPI = fetchUserInfo;

  return (
    <UserProfileContext.Provider value={{ userProfile, profileLoading, fetchUserInfo, updateBalanceFromAPI }}>
      {children}
    </UserProfileContext.Provider>
  );
};

export const useUserProfile = () => useContext(UserProfileContext);
