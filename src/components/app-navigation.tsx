import { Slot, usePathname, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useUser } from '@/components/user-provider';

const tabs = [
  { href: '/', label: 'Hoje', symbol: { ios: 'house.fill', android: 'home', web: 'home' } },
  { href: '/consulta', label: 'Consultas', symbol: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' } },
  { href: '/explore', label: 'Remédios', symbol: { ios: 'pills', android: 'medication', web: 'medication' } },
] as const;

export default function AppNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();

  return (
    <View style={styles.root}>
      {user && (
        <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
          <View style={styles.header}>
            <View style={styles.tabBar} accessibilityRole="tablist">
              {tabs.map((tab) => {
                const isSelected = pathname === tab.href || (tab.href === '/' && pathname === '/index');
                const color = isSelected ? '#fff' : '#55715d';

                return (
                  <Pressable
                    key={tab.href}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => router.replace(tab.href)}
                    style={({ pressed }) => [styles.tab, isSelected && styles.selectedTab, pressed && styles.pressed]}>
                    <SymbolView name={tab.symbol} tintColor={color} size={17} />
                    <Text style={[styles.tabLabel, isSelected && styles.selectedTabLabel]}>{tab.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </SafeAreaView>
      )}
      <Slot />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f7f2' },
  headerSafeArea: { backgroundColor: '#fff' },
  header: { width: '100%', maxWidth: 660, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 9, paddingBottom: 11 },
  tabBar: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 4, borderRadius: 12, backgroundColor: '#eef2ed' },
  tab: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 9, paddingHorizontal: 8 },
  selectedTab: { backgroundColor: '#315f49' },
  tabLabel: { color: '#55715d', fontSize: 12, fontWeight: '600' },
  selectedTabLabel: { color: '#fff', fontWeight: '700' },
  pressed: { opacity: 0.75 },
});