import { useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMedicineSchedules, useMedicines } from '@/components/medicine-provider';
import { useMedicinePin } from '@/components/medicine-pin-provider';
import { RefillReminderCard } from '@/components/refill-reminder-card';
import { useUser } from '@/components/user-provider';

export default function HomeScreen() {
  const { user, isLoading, storageError, retryLoad } = useUser();
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View style={styles.statusContent}><Text style={styles.registrationSubtitle}>Carregando seu perfil…</Text></View>
      </SafeAreaView>
    );
  }
  if (storageError) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View style={styles.statusContent}>
          <Text accessibilityRole="alert" style={styles.formError}>{storageError}</Text>
          <Pressable accessibilityRole="button" onPress={retryLoad} style={({ pressed }) => [styles.registerButton, pressed && styles.pressed]}>
            <Text style={styles.registerButtonText}>Tentar novamente</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }
  return user ? <HomeDashboard name={user.name} /> : <RegistrationScreen />;
}

function RegistrationScreen() {
  const { register } = useUser();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleRegister() {
    if (isSaving) return;
    const normalizedName = name.trim();
    const normalizedEmail = email.trim();

    if (!normalizedName) {
      setError('Informe seu nome.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Informe um e-mail válido.');
      return;
    }
    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setIsSaving(true);
    try {
      await register(normalizedName, normalizedEmail);
      setPassword('');
      setConfirmPassword('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o perfil neste dispositivo.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.registrationContent} keyboardShouldPersistTaps="handled">
        <View style={styles.registrationMark}>
          <Text style={styles.registrationMarkText}>+</Text>
        </View>
        <Text style={styles.registrationEyebrow}>CUIDADO NO SEU RITMO</Text>
        <Text style={styles.registrationTitle}>Crie sua conta</Text>
        <Text style={styles.registrationSubtitle}>Organize seus medicamentos e acompanhe sua rotina de cuidado.</Text>

        <Text style={styles.inputLabel}>Nome completo</Text>
        <TextInput
          accessibilityLabel="Nome completo"
          autoComplete="name"
          autoCapitalize="words"
          value={name}
          onChangeText={setName}
          placeholder="Como podemos chamar você?"
          placeholderTextColor="#929b96"
          returnKeyType="next"
          style={styles.input}
        />
        <Text style={styles.inputLabel}>E-mail</Text>
        <TextInput
          accessibilityLabel="E-mail"
          autoComplete="email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="voce@exemplo.com"
          placeholderTextColor="#929b96"
          returnKeyType="next"
          style={styles.input}
        />
        <Text style={styles.inputLabel}>Senha</Text>
        <TextInput
          accessibilityLabel="Senha"
          autoComplete="new-password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="Pelo menos 8 caracteres"
          placeholderTextColor="#929b96"
          returnKeyType="next"
          style={styles.input}
        />
        <Text style={styles.inputLabel}>Confirme sua senha</Text>
        <TextInput
          accessibilityLabel="Confirme sua senha"
          autoComplete="new-password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Digite a senha novamente"
          placeholderTextColor="#929b96"
          returnKeyType="done"
          onSubmitEditing={handleRegister}
          style={styles.input}
        />
        {error ? <Text accessibilityRole="alert" style={styles.formError}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={isSaving}
          onPress={handleRegister}
          style={({ pressed }) => [styles.registerButton, pressed && styles.pressed, isSaving && styles.disabledButton]}>
          <Text style={styles.registerButtonText}>{isSaving ? 'Salvando…' : 'Criar conta'}</Text>
        </Pressable>
        <Text style={styles.registrationFootnote}>Ao continuar, você poderá montar sua agenda de cuidados.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function HomeDashboard({ name }: { name: string }) {
  const { doses, isReady, isLoading, storageError, unlock, addMedicine, updateMedicine, markTaken, removeDose } = useMedicines();
  const { authorize } = useMedicinePin();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingMedicineId, setEditingMedicineId] = useState<string | null>(null);
  const [medicineName, setMedicineName] = useState('');
  const [medicineDetails, setMedicineDetails] = useState('');
  const [scheduleTimes, setScheduleTimes] = useState(['18:00']);
  const [formError, setFormError] = useState('');
  if (!isReady) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View style={styles.statusContent}>
          <Text style={styles.sectionTitle}>Agenda protegida</Text>
          <Text style={styles.registrationSubtitle}>
            {isLoading ? 'Carregando seus medicamentos…' : 'Confirme seu PIN para acessar sua agenda neste dispositivo.'}
          </Text>
          {storageError ? <Text accessibilityRole="alert" style={styles.formError}>{storageError}</Text> : null}
          {!isLoading && (
            <Pressable accessibilityRole="button" onPress={unlock} style={({ pressed }) => [styles.registerButton, pressed && styles.pressed]}>
              <Text style={styles.registerButtonText}>{storageError ? 'Tentar novamente' : 'Desbloquear agenda'}</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }
  const completedCount = doses.filter((dose) => dose.done).length;
  const nextDose = doses.find((dose) => !dose.done);
  const currentDate = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).toLocaleUpperCase('pt-BR');

  function openAddMedicine() {
    setEditingMedicineId(null);
    setMedicineName('');
    setMedicineDetails('');
    setScheduleTimes(['18:00']);
    setFormError('');
    setIsAddOpen(true);
  }

  function openEditMedicine(medicineId: string) {
    const medicine = getMedicineSchedules(doses).find((item) => item.medicineId === medicineId);
    if (!medicine) return;

    setEditingMedicineId(medicineId);
    setMedicineName(medicine.name);
    setMedicineDetails(medicine.details);
    setScheduleTimes(medicine.times);
    setFormError('');
    setIsAddOpen(true);
  }

  function handleSaveMedicine() {
    const name = medicineName.trim();
    const times = scheduleTimes.map((time) => time.trim());

    if (!name) {
      setFormError('Informe o nome do medicamento.');
      return;
    }
    if (times.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
      setFormError('Informe cada horário no formato HH:MM.');
      return;
    }
    if (new Set(times).size !== times.length) {
      setFormError('Cada horário precisa ser diferente.');
      return;
    }

    if (editingMedicineId) {
      updateMedicine(editingMedicineId, name, medicineDetails, times);
    } else {
      addMedicine(name, medicineDetails, times);
    }
    setIsAddOpen(false);
  }

  function addScheduleTime() {
    setScheduleTimes((current) => current.length < 6 ? [...current, ''] : current);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {storageError ? <Text accessibilityRole="alert" style={styles.formError}>{storageError}</Text> : null}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{currentDate}</Text>
            <Text style={styles.title}>Bom dia, {name.split(' ')[0]}</Text>
            <Text style={styles.subtitle}>Seu cuidado de hoje, no seu ritmo.</Text>
          </View>
          <View style={styles.avatar}><Text style={styles.avatarText}>{name.charAt(0).toLocaleUpperCase('pt-BR')}</Text></View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressCopy}>
            <View>
              <Text style={styles.progressLabel}>ROTINA DE HOJE</Text>
              <Text style={styles.progressTitle}>{completedCount} de {doses.length} doses</Text>
            </View>
            <Text style={styles.progressPercent}>{doses.length ? Math.round(completedCount / doses.length * 100) : 0}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${doses.length ? completedCount / doses.length * 100 : 0}%` }]} />
          </View>
          <Text style={styles.progressFootnote}>Um passo de cada vez. Você está indo bem.</Text>
        </View>

        {doses.length === 0 ? (
          <View style={styles.allDone}>
            <Text style={styles.allDoneTitle}>Sua agenda está vazia</Text>
            <Text style={styles.allDoneText}>Adicione um remédio pelo botão + para organizar seus horários.</Text>
          </View>
        ) : nextDose ? (
          <View style={styles.nextDose}>
            <View style={styles.nextDoseTop}>
              <Text style={styles.nextDoseEyebrow}>PRÓXIMA DOSE</Text>
              <Text style={styles.timePill}>{nextDose.time}</Text>
            </View>
            <Text style={styles.nextDoseName}>{nextDose.name}</Text>
            <Text style={styles.nextDoseDetails}>{nextDose.details}</Text>
            <Pressable style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed]} onPress={() => markTaken(nextDose.id)}>
              <Text style={styles.confirmButtonText}>Marcar como tomada</Text>
              <Text style={styles.confirmCheck}>✓</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.allDone}>
            <Text style={styles.allDoneTitle}>Rotina concluída!</Text>
            <Text style={styles.allDoneText}>Todas as doses de hoje foram registradas.</Text>
          </View>
        )}

        <RefillReminderCard />

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Agenda de hoje</Text>
            <Text style={styles.sectionSubtitle}>Seus horários de cuidado</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Adicionar medicamento" onPress={() => authorize(openAddMedicine)} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
            <Text style={styles.addButtonSymbol}>+</Text>
          </Pressable>
        </View>

        <View style={styles.doseList}>
          {doses.map((dose, index) => (
            <View key={dose.id} style={[styles.doseRow, index === doses.length - 1 && styles.lastDoseRow]}>
              <View style={styles.doseTimeColumn}>
                <Text style={styles.doseTime}>{dose.time}</Text>
                <View style={[styles.timelineDot, dose.done && styles.timelineDotDone]} />
                {index < doses.length - 1 && <View style={styles.timelineLine} />}
              </View>
              <View style={styles.doseInfo}>
                <View style={styles.medicineMark}><Text style={styles.medicineMarkText}>+</Text></View>
                <View style={styles.doseCopy}>
                  <Text style={styles.doseName}>{dose.name}</Text>
                  <Text style={styles.doseDetails}>{dose.details}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Editar horários de ${dose.name}`}
                  hitSlop={8}
                  onPress={() => authorize(() => openEditMedicine(dose.medicineId))}
                  style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
                  <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} tintColor="#477454" size={16} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remover o horário ${dose.time} de ${dose.name}`}
                  hitSlop={8}
                  onPress={() => authorize(() => removeDose(dose.id))}
                  style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}>
                  <SymbolView
                    name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                    tintColor="#a95c52"
                    size={16}
                  />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={isAddOpen} transparent animationType="slide" onRequestClose={() => setIsAddOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingMedicineId ? 'Editar medicamento' : 'Novo medicamento'}</Text>
              <Pressable onPress={() => setIsAddOpen(false)} accessibilityLabel="Fechar" style={styles.closeButton}><Text style={styles.closeButtonText}>×</Text></Pressable>
            </View>
            <Text style={styles.inputLabel}>Nome</Text>
            <TextInput value={medicineName} onChangeText={setMedicineName} placeholder="Ex.: Vitamina C" placeholderTextColor="#929b96" style={styles.input} returnKeyType="next" />
            <Text style={styles.inputLabel}>Dose e observação</Text>
            <TextInput value={medicineDetails} onChangeText={setMedicineDetails} placeholder="Ex.: 500 mg · após o almoço" placeholderTextColor="#929b96" style={styles.input} />
            <Text style={styles.inputLabel}>Horários por dia</Text>
            <View style={styles.scheduleTimes}>
              {scheduleTimes.map((time, index) => (
                <View key={index} style={styles.scheduleTimeRow}>
                  <TextInput
                    accessibilityLabel={`Horário ${index + 1}`}
                    value={time}
                    onChangeText={(value) => setScheduleTimes((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))}
                    placeholder="HH:MM"
                    placeholderTextColor="#929b96"
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    style={[styles.input, styles.scheduleTimeInput]}
                  />
                  {scheduleTimes.length > 1 && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remover horário ${index + 1}`}
                      onPress={() => setScheduleTimes((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      style={({ pressed }) => [styles.removeTimeButton, pressed && styles.pressed]}>
                      <SymbolView name={{ ios: 'minus', android: 'remove', web: 'remove' }} tintColor="#a95c52" size={16} />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
            {scheduleTimes.length < 6 && (
              <Pressable accessibilityRole="button" onPress={addScheduleTime} style={({ pressed }) => [styles.addTimeButton, pressed && styles.pressed]}>
                <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor="#477454" size={16} />
                <Text style={styles.addTimeText}>Adicionar outro horário</Text>
              </Pressable>
            )}
            <Text style={styles.formHint}>Cadastre um horário para cada dose diária.</Text>
            {formError ? <Text style={styles.formError}>{formError}</Text> : null}
            <Pressable onPress={handleSaveMedicine} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
              <Text style={styles.saveButtonText}>{editingMedicineId ? 'Salvar horários' : 'Adicionar à agenda'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6f7f2',
  },
  content: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 32,
  },
  registrationContent: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 26,
    paddingTop: 36,
    paddingBottom: 36,
  },
  statusContent: { flex: 1, justifyContent: 'center', paddingHorizontal: 26 },
  registrationMark: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#dce9dc', marginBottom: 28 },
  registrationMarkText: { color: '#3c704f', fontSize: 36, lineHeight: 42, fontWeight: '400' },
  registrationEyebrow: { color: '#68766e', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  registrationTitle: { color: '#20372d', fontSize: 30, lineHeight: 36, fontWeight: '700' },
  registrationSubtitle: { color: '#68766e', fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 18 },
  registerButton: { height: 50, backgroundColor: '#315f49', borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  registerButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  disabledButton: { opacity: 0.65 },
  registrationFootnote: { color: '#78847c', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 15 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  eyebrow: { color: '#68766e', fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 7 },
  title: { color: '#20372d', fontSize: 28, lineHeight: 34, fontWeight: '700' },
  subtitle: { color: '#68766e', fontSize: 14, marginTop: 4 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#dce9dc' },
  avatarText: { color: '#315d45', fontSize: 18, fontWeight: '700' },
  progressSection: { backgroundColor: '#fff', padding: 18, borderRadius: 14, marginBottom: 18 },
  progressCopy: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { color: '#7a867f', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  progressTitle: { color: '#263b31', fontSize: 18, fontWeight: '700', marginTop: 5 },
  progressPercent: { color: '#3d7655', fontSize: 20, fontWeight: '700' },
  progressTrack: { height: 7, backgroundColor: '#e8eee8', borderRadius: 4, overflow: 'hidden', marginTop: 15 },
  progressFill: { height: '100%', backgroundColor: '#4d8a62', borderRadius: 4 },
  progressFootnote: { color: '#78847c', fontSize: 12, marginTop: 10 },
  nextDose: { backgroundColor: '#315f49', borderRadius: 14, padding: 19, marginBottom: 27 },
  nextDoseTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nextDoseEyebrow: { color: '#d0e0d2', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  timePill: { color: '#244d38', backgroundColor: '#d8e9d6', overflow: 'hidden', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5, fontSize: 12, fontWeight: '700' },
  nextDoseName: { color: '#fff', fontSize: 23, fontWeight: '700', marginTop: 13 },
  nextDoseDetails: { color: '#d8e5db', fontSize: 13, marginTop: 4 },
  confirmButton: { backgroundColor: '#f4f6ed', minHeight: 46, borderRadius: 9, marginTop: 17, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  confirmButtonText: { color: '#294d38', fontSize: 14, fontWeight: '700' },
  confirmCheck: { color: '#477454', fontSize: 19, fontWeight: '700' },
  allDone: { padding: 18, borderRadius: 14, backgroundColor: '#e2eee1', marginBottom: 27 },
  allDoneTitle: { color: '#294d38', fontSize: 18, fontWeight: '700' },
  allDoneText: { color: '#536d5c', fontSize: 13, marginTop: 4 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { color: '#263b31', fontSize: 19, fontWeight: '700' },
  sectionSubtitle: { color: '#78847c', fontSize: 12, marginTop: 3 },
  addButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#e2eee1', alignItems: 'center', justifyContent: 'center' },
  addButtonSymbol: { color: '#3c704f', fontSize: 26, lineHeight: 30, fontWeight: '400' },
  doseList: { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14 },
  doseRow: { minHeight: 76, flexDirection: 'row' },
  lastDoseRow: { minHeight: 66 },
  doseTimeColumn: { width: 57, alignItems: 'flex-start', paddingTop: 18, position: 'relative' },
  doseTime: { color: '#53645a', fontSize: 12, fontWeight: '600' },
  timelineDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#d8a64c', right: 8, top: 22, zIndex: 1 },
  timelineDotDone: { backgroundColor: '#4d8a62' },
  timelineLine: { position: 'absolute', right: 11, top: 30, bottom: -1, width: 1, backgroundColor: '#e5eae5' },
  doseInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e9ede9', paddingVertical: 12 },
  medicineMark: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#f0f4ed', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  medicineMarkText: { color: '#56805e', fontSize: 20, fontWeight: '500' },
  doseCopy: { flex: 1 },
  doseName: { color: '#2b3b32', fontSize: 14, fontWeight: '700' },
  doseDetails: { color: '#7c8880', fontSize: 11, marginTop: 4 },
  doneLabel: { color: '#4d8059', fontSize: 10, fontWeight: '700' },
  pendingLabel: { color: '#a2762d', fontSize: 10, fontWeight: '700' },
  editButton: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: 4, borderRadius: 8, backgroundColor: '#edf3ed' },
  removeButton: { width: 34, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: 5, borderRadius: 8, backgroundColor: '#fbefed' },
  pressed: { opacity: 0.76 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(24, 38, 29, 0.36)' },
  modalSheet: { backgroundColor: '#f8f9f5', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 22, paddingBottom: 34 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#243a2d', fontSize: 21, fontWeight: '700' },
  closeButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#e8ece6' },
  closeButtonText: { color: '#526258', fontSize: 24, lineHeight: 27 },
  inputLabel: { color: '#46584d', fontSize: 12, fontWeight: '700', marginBottom: 7, marginTop: 12 },
  input: { height: 48, borderWidth: 1, borderColor: '#dce3dc', borderRadius: 9, backgroundColor: '#fff', paddingHorizontal: 13, color: '#263b31', fontSize: 14 },
  scheduleTimes: { gap: 8 },
  scheduleTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scheduleTimeInput: { flex: 1 },
  removeTimeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#fbefed' },
  addTimeButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 4, marginTop: 5 },
  addTimeText: { color: '#477454', fontSize: 12, fontWeight: '700' },
  formHint: { color: '#78847c', fontSize: 11, marginTop: 8 },
  formError: { color: '#a04c44', fontSize: 11, marginTop: 8 },
  saveButton: { height: 49, backgroundColor: '#315f49', borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  saveButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
