import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { getMedicineSchedules, useMedicines, type PickupMedicineDetails } from '@/components/medicine-provider';

const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatCalendarDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

export function RefillReminderCard() {
  const { doses, loadPickupReminder, savePickupReminder } = useMedicines();
  const medicines = getMedicineSchedules(doses);
  const [pickupDate, setPickupDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return startOfDay(date);
  });
  const [selectedMedicineIds, setSelectedMedicineIds] = useState<string[]>([]);
  const [medicineDetails, setMedicineDetails] = useState<Record<string, PickupMedicineDetails>>({});
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(pickupDate.getFullYear(), pickupDate.getMonth(), 1));
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isMedicinePickerOpen, setIsMedicinePickerOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isPickupLoaded, setIsPickupLoaded] = useState(false);
  const selectedMedicines = medicines.filter((medicine) => selectedMedicineIds.includes(medicine.medicineId));
  const selectedMedicineNames = selectedMedicines.map((medicine) => medicine.name).join(', ');

  useEffect(() => {
    let cancelled = false;
    void loadPickupReminder()
      .then((reminder) => {
        if (!cancelled && reminder) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(reminder.date)) {
            throw new Error('A data do lembrete salvo está inválida.');
          }
          const [year, month, day] = reminder.date.split('-').map(Number);
          const date = new Date(year, month - 1, day);
          if (
            !Number.isFinite(date.getTime())
            || date.getFullYear() !== year
            || date.getMonth() !== month - 1
            || date.getDate() !== day
          ) {
            throw new Error('A data do lembrete salvo está inválida.');
          }
          setPickupDate(date);
          setVisibleMonth(new Date(year, month - 1, 1));
          setSelectedMedicineIds(reminder.medicineIds);
          setMedicineDetails(reminder.medicineDetails);
        }
        if (!cancelled) setIsPickupLoaded(true);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setErrorMessage(cause instanceof Error ? cause.message : 'Não foi possível carregar o lembrete salvo.');
          setIsPickupLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadPickupReminder]);

  function persistPickupReminder(
    date: Date,
    medicineIds: string[],
    details: Record<string, PickupMedicineDetails>,
  ) {
    const reminder = { date: formatCalendarDate(date), medicineIds, medicineDetails: details };
    void savePickupReminder(reminder).then(() => {
      setErrorMessage('');
    }).catch((cause: unknown) => {
      setErrorMessage(cause instanceof Error ? cause.message : 'Não foi possível salvar o lembrete.');
    });
  }

  const firstWeekday = (new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const calendarCells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  function changeMonth(offset: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function selectDate(day: number) {
    const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
    setPickupDate(date);
    setIsCalendarOpen(false);
    setErrorMessage('');
    persistPickupReminder(date, selectedMedicineIds, medicineDetails);
  }

  function updateMedicineDetails(medicineId: string, field: keyof PickupMedicineDetails, value: string) {
    const nextDetails = {
      ...medicineDetails,
      [medicineId]: {
        location: medicineDetails[medicineId]?.location ?? '',
        observations: medicineDetails[medicineId]?.observations ?? '',
        [field]: value,
      },
    };
    setMedicineDetails(nextDetails);
    persistPickupReminder(pickupDate, selectedMedicineIds, nextDetails);
  }

  async function addToCalendar() {
    if (selectedMedicines.length === 0) {
      setErrorMessage('Selecione pelo menos um medicamento para retirada.');
      return;
    }

    const startDate = `${formatCalendarDate(pickupDate)}T090000`;
    const endDate = `${formatCalendarDate(pickupDate)}T093000`;
    const medicineList = selectedMedicines
      .map((medicine) => {
        const pickupDetails = medicineDetails[medicine.medicineId];
        return [
          `- ${medicine.name} (${medicine.details})`,
          pickupDetails?.location ? `  Local de retirada: ${pickupDetails.location}` : '',
          pickupDetails?.observations ? `  Observações: ${pickupDetails.observations}` : '',
        ].filter(Boolean).join('\n');
      })
      .join('\n');
    const parameters = new URLSearchParams({
      action: 'TEMPLATE',
      text: selectedMedicines.length === 1 ? `Buscar ${selectedMedicines[0].name}` : 'Retirar medicamentos',
      dates: `${startDate}/${endDate}`,
      details: `Medicamentos para retirar na farmácia:\n${medicineList}`,
      ctz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
    });

    try {
      await Linking.openURL(`https://calendar.google.com/calendar/render?${parameters.toString()}`);
      setErrorMessage('');
    } catch {
      setErrorMessage('Não foi possível abrir o calendário. Tente novamente.');
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeading}>
        <View style={styles.headingIcon}><Text style={styles.headingIconText}>↗</Text></View>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>LEMBRETE DE REPOSIÇÃO</Text>
          <Text style={styles.title}>Agende a retirada</Text>
        </View>
      </View>

      <Text style={styles.fieldLabel}>Medicamentos para retirar</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={selectedMedicines.length
          ? `${selectedMedicines.length} medicamentos selecionados: ${selectedMedicineNames}. Toque para alterar`
          : 'Selecione os medicamentos para retirar'}
        disabled={!isPickupLoaded || medicines.length === 0}
        onPress={() => setIsMedicinePickerOpen(true)}
        style={({ pressed }) => [styles.selectionField, pressed && styles.pressed, (!isPickupLoaded || medicines.length === 0) && styles.disabled]}>
        <View style={styles.selectedMedicineCopy}>
          <Text style={styles.selectionText}>
            {selectedMedicines.length
              ? `${selectedMedicines.length} ${selectedMedicines.length === 1 ? 'medicamento selecionado' : 'medicamentos selecionados'}`
              : 'Selecionar medicamentos'}
          </Text>
          {selectedMedicineNames ? <Text style={styles.dateHint}>{selectedMedicineNames}</Text> : null}
        </View>
        <Text style={styles.selectionAction}>Marcar</Text>
      </Pressable>

      <Text style={styles.fieldLabel}>Dia de buscar</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Data da retirada: ${pickupDate.toLocaleDateString('pt-BR')}. Escolher outra data`}
        disabled={!isPickupLoaded}
        onPress={() => {
          setVisibleMonth(new Date(pickupDate.getFullYear(), pickupDate.getMonth(), 1));
          setIsCalendarOpen(true);
        }}
        style={({ pressed }) => [styles.selectionField, pressed && styles.pressed, !isPickupLoaded && styles.disabled]}>
        <View>
          <Text style={styles.selectionText}>{pickupDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
          <Text style={styles.dateHint}>Toque para escolher outro dia</Text>
        </View>
        <Text style={styles.calendarIcon}>▦</Text>
      </Pressable>

      <View style={styles.pickupList}>
        <Text style={styles.pickupListTitle}>
          {selectedMedicines.length
            ? `Na lista de retirada (${selectedMedicines.length})`
            : 'Lista de retirada'}
        </Text>
        {selectedMedicines.length ? selectedMedicines.map((medicine) => (
          <View key={medicine.medicineId} style={styles.pickupMedicine}>
            <View style={styles.pickupMedicineHeading}>
              <View style={styles.pickupMedicineMark}><Text style={styles.pickupMedicineMarkText}>+</Text></View>
              <View style={styles.pickupMedicineCopy}>
                <Text style={styles.pickupMedicineName}>{medicine.name}</Text>
                <Text style={styles.pickupMedicineDetails}>{medicine.details}</Text>
              </View>
            </View>
            <Text style={styles.pickupFieldLabel}>Local de retirada</Text>
            <TextInput
              accessibilityLabel={`Local de retirada de ${medicine.name}`}
              editable={isPickupLoaded}
              value={medicineDetails[medicine.medicineId]?.location ?? ''}
              onChangeText={(value) => updateMedicineDetails(medicine.medicineId, 'location', value)}
              placeholder="Ex.: Farmácia Central"
              placeholderTextColor="#929b96"
              style={styles.pickupInput}
            />
            <Text style={styles.pickupFieldLabel}>Observações</Text>
            <TextInput
              accessibilityLabel={`Observações para retirar ${medicine.name}`}
              editable={isPickupLoaded}
              value={medicineDetails[medicine.medicineId]?.observations ?? ''}
              onChangeText={(value) => updateMedicineDetails(medicine.medicineId, 'observations', value)}
              placeholder="Informações importantes para a retirada"
              placeholderTextColor="#929b96"
              multiline
              textAlignVertical="top"
              style={[styles.pickupInput, styles.pickupObservationsInput]}
            />
          </View>
        )) : (
          <Text style={styles.emptyPickupList}>Marque os medicamentos que devem ser retirados nesta data.</Text>
        )}
      </View>

      <Text style={styles.notificationNote}>
        {isPickupLoaded
          ? 'O Google Calendar aplicará os lembretes padrão da sua conta.'
          : 'Carregando o lembrete salvo…'}
      </Text>
      {errorMessage ? <Text style={styles.errorMessage}>{errorMessage}</Text> : null}

      <Pressable
        accessibilityRole="button"
        disabled={!isPickupLoaded || selectedMedicines.length === 0}
        onPress={addToCalendar}
        style={({ pressed }) => [styles.addButton, pressed && styles.pressed, (!isPickupLoaded || selectedMedicines.length === 0) && styles.disabledButton]}>
        <Text style={styles.addButtonText}>Agendar retirada no Google Calendar</Text>
        <Text style={styles.addButtonArrow}>↗</Text>
      </Pressable>

      <Modal visible={isCalendarOpen} transparent animationType="slide" onRequestClose={() => setIsCalendarOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.calendarSheet}>
            <View style={styles.modalHeading}>
              <Text style={styles.modalTitle}>Escolha o dia</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Fechar calendário" onPress={() => setIsCalendarOpen(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </Pressable>
            </View>
            <View style={styles.monthNavigation}>
              <Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" onPress={() => changeMonth(-1)} style={styles.monthArrow}>
                <Text style={styles.monthArrowText}>‹</Text>
              </Pressable>
              <Text style={styles.monthTitle}>{visibleMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Próximo mês" onPress={() => changeMonth(1)} style={styles.monthArrow}>
                <Text style={styles.monthArrowText}>›</Text>
              </Pressable>
            </View>
            <View style={styles.calendarGrid}>
              {weekDays.map((day, index) => <Text key={`${day}-${index}`} style={styles.weekDay}>{day}</Text>)}
              {calendarCells.map((day, index) => {
                const date = day ? new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day) : null;
                const isPast = date ? startOfDay(date).getTime() < startOfDay(new Date()).getTime() : false;
                const isSelected = day === pickupDate.getDate()
                  && visibleMonth.getMonth() === pickupDate.getMonth()
                  && visibleMonth.getFullYear() === pickupDate.getFullYear();

                return day ? (
                  <Pressable
                    key={`${visibleMonth.getFullYear()}-${visibleMonth.getMonth()}-${day}`}
                    accessibilityRole="button"
                    accessibilityLabel={date?.toLocaleDateString('pt-BR')}
                    accessibilityState={{ selected: isSelected, disabled: isPast }}
                    disabled={isPast}
                    onPress={() => selectDate(day)}
                    style={({ pressed }) => [styles.dayCell, isSelected && styles.selectedDay, isPast && styles.pastDay, pressed && styles.pressed]}>
                    <Text style={[styles.dayText, isSelected && styles.selectedDayText, isPast && styles.pastDayText]}>{day}</Text>
                  </Pressable>
                ) : <View key={`empty-${index}`} style={styles.dayCell} />;
              })}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isMedicinePickerOpen} transparent animationType="slide" onRequestClose={() => setIsMedicinePickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.medicineSheet}>
            <View style={styles.modalHeading}>
              <Text style={styles.modalTitle}>Quais remédios buscar?</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Fechar lista de medicamentos" onPress={() => setIsMedicinePickerOpen(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </Pressable>
            </View>
            {medicines.map((medicine) => (
              <Pressable
                key={medicine.medicineId}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedMedicineIds.includes(medicine.medicineId) }}
                onPress={() => {
                  const nextMedicineIds = selectedMedicineIds.includes(medicine.medicineId)
                    ? selectedMedicineIds.filter((id) => id !== medicine.medicineId)
                    : [...selectedMedicineIds, medicine.medicineId];
                  const nextDetails = { ...medicineDetails };
                  if (!nextMedicineIds.includes(medicine.medicineId)) delete nextDetails[medicine.medicineId];
                  setSelectedMedicineIds(nextMedicineIds);
                  setMedicineDetails(nextDetails);
                  setErrorMessage('');
                  persistPickupReminder(pickupDate, nextMedicineIds, nextDetails);
                }}
                style={({ pressed }) => [styles.medicineOption, pressed && styles.pressed]}>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionName}>{medicine.name}</Text>
                  <Text style={styles.optionDetails}>{medicine.details}</Text>
                </View>
                <View style={[
                  styles.medicineCheckbox,
                  selectedMedicineIds.includes(medicine.medicineId) && styles.medicineCheckboxSelected,
                ]}>
                  {selectedMedicineIds.includes(medicine.medicineId) && <Text style={styles.optionCheck}>✓</Text>}
                </View>
              </Pressable>
            ))}
            {medicines.length === 0 && <Text style={styles.emptyMedicines}>Cadastre um medicamento na agenda primeiro.</Text>}
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsMedicinePickerOpen(false)}
              style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}>
              <Text style={styles.doneButtonText}>Concluir seleção</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 17, marginBottom: 24 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  headingIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f7edda', marginRight: 11 },
  headingIconText: { color: '#a77936', fontSize: 19, fontWeight: '700' },
  headingCopy: { flex: 1 },
  eyebrow: { color: '#7c887f', fontSize: 9, fontWeight: '700', letterSpacing: 0.7 },
  title: { color: '#263b31', fontSize: 17, fontWeight: '700', marginTop: 3 },
  fieldLabel: { color: '#54645a', fontSize: 11, fontWeight: '700', marginBottom: 6, marginTop: 10 },
  selectionField: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e3e9e2', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fcfdfb' },
  selectedMedicineCopy: { flex: 1, paddingRight: 8 },
  selectionText: { color: '#2f4035', fontSize: 13, fontWeight: '600' },
  selectionAction: { color: '#477454', fontSize: 11, fontWeight: '700' },
  dateHint: { color: '#89938c', fontSize: 10, marginTop: 3 },
  pickupList: { marginTop: 14, padding: 12, borderRadius: 10, backgroundColor: '#f5f7f2' },
  pickupListTitle: { color: '#46584d', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  pickupMedicine: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e1e8df' },
  pickupMedicineHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  pickupMedicineMark: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#e2eee1', marginRight: 9 },
  pickupMedicineMarkText: { color: '#477454', fontSize: 17, fontWeight: '600' },
  pickupMedicineCopy: { flex: 1 },
  pickupMedicineName: { color: '#2b3b32', fontSize: 12, fontWeight: '700' },
  pickupMedicineDetails: { color: '#7c8880', fontSize: 10, marginTop: 3 },
  pickupFieldLabel: { color: '#54645a', fontSize: 10, fontWeight: '700', marginTop: 9, marginBottom: 5 },
  pickupInput: { minHeight: 40, borderWidth: 1, borderColor: '#dce3dc', borderRadius: 8, backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 9, color: '#263b31', fontSize: 12 },
  pickupObservationsInput: { minHeight: 64 },
  emptyPickupList: { color: '#7c8880', fontSize: 11, lineHeight: 16, paddingVertical: 6 },
  calendarIcon: { color: '#557a5c', fontSize: 21, marginRight: 2 },
  notificationNote: { color: '#7c887f', fontSize: 10, lineHeight: 15, marginTop: 11 },
  errorMessage: { color: '#a04c44', fontSize: 11, marginTop: 8 },
  addButton: { minHeight: 44, borderRadius: 9, backgroundColor: '#315f49', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, marginTop: 13 },
  addButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  addButtonArrow: { color: '#fff', fontSize: 17 },
  disabledButton: { backgroundColor: '#87968b' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.75 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(24, 38, 29, 0.36)' },
  calendarSheet: { backgroundColor: '#f8f9f5', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 30 },
  medicineSheet: { backgroundColor: '#f8f9f5', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 30 },
  modalHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { color: '#243a2d', fontSize: 19, fontWeight: '700' },
  closeButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#e8ece6' },
  closeButtonText: { color: '#526258', fontSize: 24, lineHeight: 27 },
  monthNavigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 17, marginBottom: 13 },
  monthArrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#e8eee7' },
  monthArrowText: { color: '#41684b', fontSize: 24, lineHeight: 28 },
  monthTitle: { color: '#33483a', fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekDay: { width: `${100 / 7}%`, height: 34, textAlign: 'center', textAlignVertical: 'center', color: '#89938c', fontSize: 9, fontWeight: '700' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  dayText: { color: '#36463b', fontSize: 13 },
  selectedDay: { backgroundColor: '#315f49' },
  selectedDayText: { color: '#fff', fontWeight: '700' },
  pastDay: { opacity: 0.45 },
  pastDayText: { color: '#a0a7a1' },
  medicineOption: { flexDirection: 'row', alignItems: 'center', minHeight: 62, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e0e6df' },
  optionCopy: { flex: 1 },
  optionName: { color: '#2b3b32', fontSize: 14, fontWeight: '700' },
  optionDetails: { color: '#7c8880', fontSize: 11, marginTop: 4 },
  optionCheck: { color: '#477454', fontSize: 17, fontWeight: '700', marginLeft: 12 },
  medicineCheckbox: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#bac8bb', borderRadius: 6, marginLeft: 12 },
  medicineCheckboxSelected: { backgroundColor: '#e2eee1', borderColor: '#477454' },
  doneButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#315f49', marginTop: 16 },
  doneButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  emptyMedicines: { color: '#78847c', fontSize: 12, paddingVertical: 20 },
});