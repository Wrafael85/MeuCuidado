import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppNavigation from '@/components/app-navigation';
import { MedicineProvider } from '@/components/medicine-provider';
import { MedicinePinProvider } from '@/components/medicine-pin-provider';
import { UserProvider } from '@/components/user-provider';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <UserProvider>
        <MedicinePinProvider>
          <MedicineProvider>
            <AppNavigation />
          </MedicineProvider>
        </MedicinePinProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
