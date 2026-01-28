import { Redirect } from 'expo-router';

export default function Index() {
  // При запуске приложения сразу переходим в папку (tabs)
  return <Redirect href="/(tabs)" />;
}