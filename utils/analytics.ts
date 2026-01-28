import { API_URL } from '@/config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const trackEvent = async (eventName: string, properties: any = {}) => {
  try {
    const phone = await AsyncStorage.getItem('userPhone');
    const user_data = {
        phone: phone || undefined,
        user_agent: 'Mobile App',
    };
    
    // Fire and forget
    fetch(`${API_URL}/api/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            event_name: eventName,
            properties,
            user_data
        })
    }).catch(err => console.log('[Analytics Error]', err));
    
    console.log(`📊 [Analytics] ${eventName}`, properties);
  } catch (e) {
    console.log('[Analytics] Error:', e);
  }
};
