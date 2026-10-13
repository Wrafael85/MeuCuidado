import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMedicineSchedules, useMedicines } from '@/components/medicine-provider';

export default function MedicinesScreen() {
  const { doses } = useMedicines();
  const medicines = getMedicineSchedules(doses);
  const iconTones = ['#e6efe4', '#f7edda', '#e5edf0'];

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>SEU CUIDADO, ORGANIZADO</Text>
        <Text style={styles.title}>Meus remédios</Text>
        <Text style={styles.subtitle}>{medicines.length} medicamentos na sua rotina</Text>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Em uso</Text>
          <Text style={styles.count}>{String(medicines.length).padStart(2, '0')}</Text>
        </View>

        <View style={styles.medicineList}>
          {medicines.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Nenhum remédio cadastrado</Text>
              <Text style={styles.emptyText}>Os medicamentos adicionados na tela Hoje aparecerão aqui.</Text>
            </View>
          ) : (
            medicines.map((medicine, index) => (
              <View key={medicine.medicineId} style={[styles.medicineRow, index === medicines.length - 1 && styles.lastRow]}>
                <View style={[styles.medicineIcon, { backgroundColor: iconTones[index % iconTones.length] }]}>
                  <Text style={styles.medicineIconText}>+</Text>
                </View>
                <View style={styles.medicineCopy}>
                  <Text style={styles.medicineName}>{medicine.name}</Text>
                  <Text style={styles.medicineDose}>{medicine.details}</Text>
                  <Text style={styles.medicineSchedule}>Todos os dias · {medicine.times.join(' · ')}</Text>
                </View>
                <View style={styles.moreMark}><Text style={styles.moreMarkText}>···</Text></View>
              </View>
            ))
          )}
        </View>

        <Text style={styles.footerNote}>
          {medicines.length === 0
            ? 'Adicione um medicamento na tela Hoje para começar a organizar sua rotina.'
            : 'Siga sempre a orientação do seu profissional de saúde.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f6f7f2' },
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 22, paddingBottom: 34 },
  eyebrow: { color: '#68766e', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  title: { color: '#20372d', fontSize: 28, lineHeight: 35, fontWeight: '700', marginTop: 6 },
  subtitle: { color: '#68766e', fontSize: 14, marginTop: 3 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 30, marginBottom: 12 },
  sectionTitle: { color: '#263b31', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  count: { color: '#76837a', fontSize: 12, fontWeight: '700' },
  medicineList: { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, marginBottom: 27 },
  emptyState: { paddingVertical: 22 },
  emptyTitle: { color: '#3b4c40', fontSize: 13, fontWeight: '700' },
  emptyText: { color: '#7c8880', fontSize: 11, lineHeight: 16, marginTop: 5 },
  medicineRow: { flexDirection: 'row', alignItems: 'center', minHeight: 91, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e9ede9' },
  lastRow: { borderBottomWidth: 0 },
  medicineIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  medicineIconText: { color: '#527557', fontSize: 22, fontWeight: '500' },
  medicineCopy: { flex: 1, paddingVertical: 12 },
  medicineName: { color: '#2b3b32', fontSize: 14, fontWeight: '700' },
  medicineDose: { color: '#5f6e64', fontSize: 11, marginTop: 3 },
  medicineSchedule: { color: '#89938c', fontSize: 10, marginTop: 4 },
  moreMark: { width: 28, height: 36, alignItems: 'center', justifyContent: 'center' },
  moreMarkText: { color: '#849087', fontSize: 19, fontWeight: '700', marginTop: -8 },
  footerNote: { color: '#88928b', fontSize: 10, lineHeight: 15, marginTop: 24 },
});