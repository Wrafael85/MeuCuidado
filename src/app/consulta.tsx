import { useState } from 'react';
import * as Linking from 'expo-linking';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Consultation = {
  date: Date;
  doctor: string;
  specialty: string;
  location: string;
};

function formatCalendarDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}00`;
}

export default function ConsultationScreen() {
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [doctor, setDoctor] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [location, setLocation] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [examName, setExamName] = useState('');
  const [examDay, setExamDay] = useState('');
  const [examMonth, setExamMonth] = useState('');
  const [examYear, setExamYear] = useState('');
  const [examTime, setExamTime] = useState('');
  const [examLocation, setExamLocation] = useState('');
  const [examError, setExamError] = useState('');
  const [examStatus, setExamStatus] = useState('');

  function saveConsultation() {
    const numericDay = Number(day);
    const numericMonth = Number(month);
    const numericYear = Number(year);
    const date = new Date(numericYear, numericMonth - 1, numericDay);
    const dateIsValid = numericYear >= 1900
      && numericMonth >= 1
      && numericMonth <= 12
      && numericDay >= 1
      && date.getFullYear() === numericYear
      && date.getMonth() === numericMonth - 1
      && date.getDate() === numericDay;

    if (!dateIsValid) {
      setErrorMessage('Confira o dia, mês e ano da consulta.');
      return;
    }
    if (!doctor.trim() || !specialty.trim() || !location.trim()) {
      setErrorMessage('Preencha o nome do médico, a especialidade e o local.');
      return;
    }

    setConsultation({ date, doctor: doctor.trim(), specialty: specialty.trim(), location: location.trim() });
    setErrorMessage('');
  }

  async function scheduleExam() {
    const numericDay = Number(examDay);
    const numericMonth = Number(examMonth);
    const numericYear = Number(examYear);
    const date = new Date(numericYear, numericMonth - 1, numericDay);
    const dateIsValid = numericYear >= 1900
      && numericMonth >= 1
      && numericMonth <= 12
      && numericDay >= 1
      && date.getFullYear() === numericYear
      && date.getMonth() === numericMonth - 1
      && date.getDate() === numericDay;

    if (!examName.trim() || !examLocation.trim()) {
      setExamError('Informe o exame ou procedimento e o local.');
      setExamStatus('');
      return;
    }
    if (!dateIsValid || date < new Date(new Date().setHours(0, 0, 0, 0))) {
      setExamError('Informe uma data válida, a partir de hoje.');
      setExamStatus('');
      return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(examTime)) {
      setExamError('Informe um horário válido no formato HH:MM.');
      setExamStatus('');
      return;
    }

    const eventStart = new Date(numericYear, numericMonth - 1, numericDay, Number(examTime.slice(0, 2)), Number(examTime.slice(3)));
    if (eventStart < new Date()) {
      setExamError('Escolha um horário futuro.');
      setExamStatus('');
      return;
    }

    const eventEnd = new Date(eventStart.getTime() + 60 * 60 * 1000);
    const parameters = new URLSearchParams({
      action: 'TEMPLATE',
      text: examName.trim(),
      dates: `${formatCalendarDateTime(eventStart)}/${formatCalendarDateTime(eventEnd)}`,
      details: `Lembrete de exame ou procedimento: ${examName.trim()}.`,
      location: examLocation.trim(),
      ctz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
    });

    try {
      await Linking.openURL(`https://calendar.google.com/calendar/render?${parameters.toString()}`);
      setExamError('');
      setExamStatus('Evento preparado. Salve no Google Calendar para ativar o lembrete da sua conta.');
    } catch {
      setExamError('Não foi possível abrir o calendário. Tente novamente.');
      setExamStatus('');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>SEU PRÓXIMO ATENDIMENTO</Text>
        <Text style={styles.title}>Consulta</Text>
        <Text style={styles.subtitle}>Deixe os detalhes importantes em um só lugar.</Text>

        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Quando será?</Text>
          <View style={styles.dateFields}>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>Dia</Text>
              <TextInput
                accessibilityLabel="Dia da consulta"
                value={day}
                onChangeText={setDay}
                placeholder="DD"
                placeholderTextColor="#929b96"
                keyboardType="number-pad"
                maxLength={2}
                style={styles.dateInput}
              />
            </View>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>Mês</Text>
              <TextInput
                accessibilityLabel="Mês da consulta"
                value={month}
                onChangeText={setMonth}
                placeholder="MM"
                placeholderTextColor="#929b96"
                keyboardType="number-pad"
                maxLength={2}
                style={styles.dateInput}
              />
            </View>
            <View style={[styles.dateField, styles.yearField]}>
              <Text style={styles.fieldLabel}>Ano</Text>
              <TextInput
                accessibilityLabel="Ano da consulta"
                value={year}
                onChangeText={setYear}
                placeholder="AAAA"
                placeholderTextColor="#929b96"
                keyboardType="number-pad"
                maxLength={4}
                style={styles.dateInput}
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Nome do médico</Text>
          <TextInput
            accessibilityLabel="Nome do médico"
            value={doctor}
            onChangeText={setDoctor}
            placeholder="Ex.: Dra. Ana Silva"
            placeholderTextColor="#929b96"
            autoCapitalize="words"
            style={styles.textInput}
          />

          <Text style={styles.fieldLabel}>Especialidade</Text>
          <TextInput
            accessibilityLabel="Especialidade médica"
            value={specialty}
            onChangeText={setSpecialty}
            placeholder="Ex.: Cardiologia"
            placeholderTextColor="#929b96"
            autoCapitalize="words"
            style={styles.textInput}
          />

          <Text style={styles.fieldLabel}>Local de atendimento</Text>
          <TextInput
            accessibilityLabel="Local de atendimento"
            value={location}
            onChangeText={setLocation}
            placeholder="Clínica, hospital ou endereço"
            placeholderTextColor="#929b96"
            autoCapitalize="words"
            style={styles.textInput}
          />

          {errorMessage ? <Text accessibilityRole="alert" style={styles.errorMessage}>{errorMessage}</Text> : null}
          <Pressable onPress={saveConsultation} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
            <Text style={styles.saveButtonText}>Salvar consulta</Text>
            <Text style={styles.saveButtonIcon}>✓</Text>
          </Pressable>
        </View>

        {consultation && (
          <View style={styles.savedConsultation}>
            <Text style={styles.savedEyebrow}>CONSULTA SALVA</Text>
            <Text style={styles.savedDate}>{consultation.date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
            <Text style={styles.savedDoctor}>{consultation.doctor}</Text>
            <Text style={styles.savedDetail}>{consultation.specialty}</Text>
            <Text style={styles.savedDetail}>{consultation.location}</Text>
          </View>
        )}

        <View style={styles.examForm}>
          <Text style={styles.sectionTitle}>Exames e procedimentos</Text>
          <Text style={styles.examIntro}>Prepare um evento com alerta no seu calendário.</Text>

          <Text style={styles.fieldLabel}>Exame ou procedimento</Text>
          <TextInput
            accessibilityLabel="Nome do exame ou procedimento"
            value={examName}
            onChangeText={setExamName}
            placeholder="Ex.: Exame de sangue"
            placeholderTextColor="#929b96"
            autoCapitalize="sentences"
            style={styles.textInput}
          />

          <Text style={styles.fieldLabel}>Data</Text>
          <View style={styles.dateFields}>
            <View style={styles.dateField}>
              <TextInput
                accessibilityLabel="Dia do exame"
                value={examDay}
                onChangeText={setExamDay}
                placeholder="DD"
                placeholderTextColor="#929b96"
                keyboardType="number-pad"
                maxLength={2}
                style={styles.dateInput}
              />
            </View>
            <View style={styles.dateField}>
              <TextInput
                accessibilityLabel="Mês do exame"
                value={examMonth}
                onChangeText={setExamMonth}
                placeholder="MM"
                placeholderTextColor="#929b96"
                keyboardType="number-pad"
                maxLength={2}
                style={styles.dateInput}
              />
            </View>
            <View style={[styles.dateField, styles.yearField]}>
              <TextInput
                accessibilityLabel="Ano do exame"
                value={examYear}
                onChangeText={setExamYear}
                placeholder="AAAA"
                placeholderTextColor="#929b96"
                keyboardType="number-pad"
                maxLength={4}
                style={styles.dateInput}
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Horário</Text>
          <TextInput
            accessibilityLabel="Horário do exame"
            value={examTime}
            onChangeText={setExamTime}
            placeholder="HH:MM"
            placeholderTextColor="#929b96"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            style={styles.textInput}
          />

          <Text style={styles.fieldLabel}>Local</Text>
          <TextInput
            accessibilityLabel="Local do exame ou procedimento"
            value={examLocation}
            onChangeText={setExamLocation}
            placeholder="Laboratório, clínica ou endereço"
            placeholderTextColor="#929b96"
            autoCapitalize="words"
            style={styles.textInput}
          />

          <Text style={styles.calendarNote}>O Google Calendar usará os lembretes padrão da sua conta.</Text>
          {examError ? <Text accessibilityRole="alert" style={styles.errorMessage}>{examError}</Text> : null}
          {examStatus ? <Text style={styles.successMessage}>{examStatus}</Text> : null}
          <Pressable onPress={scheduleExam} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
            <Text style={styles.saveButtonText}>Adicionar ao calendário</Text>
            <Text style={styles.saveButtonIcon}>↗</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f6f7f2' },
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 22, paddingBottom: 34 },
  eyebrow: { color: '#68766e', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  title: { color: '#20372d', fontSize: 28, lineHeight: 35, fontWeight: '700', marginTop: 6 },
  subtitle: { color: '#68766e', fontSize: 14, marginTop: 3, marginBottom: 22 },
  form: { backgroundColor: '#fff', borderRadius: 14, padding: 18 },
  examForm: { backgroundColor: '#fff', borderRadius: 14, padding: 18, marginTop: 20 },
  sectionTitle: { color: '#263b31', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  examIntro: { color: '#78847c', fontSize: 12, lineHeight: 17, marginTop: -6, marginBottom: 2 },
  dateFields: { flexDirection: 'row', gap: 10, marginBottom: 7 },
  dateField: { flex: 1 },
  yearField: { flex: 1.5 },
  fieldLabel: { color: '#54645a', fontSize: 11, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  dateInput: { height: 46, borderWidth: 1, borderColor: '#dce3dc', borderRadius: 9, backgroundColor: '#fcfdfb', color: '#263b31', fontSize: 14, textAlign: 'center' },
  textInput: { height: 48, borderWidth: 1, borderColor: '#dce3dc', borderRadius: 9, backgroundColor: '#fcfdfb', paddingHorizontal: 13, color: '#263b31', fontSize: 14 },
  errorMessage: { color: '#a04c44', fontSize: 12, lineHeight: 17, marginTop: 14 },
  successMessage: { color: '#477454', fontSize: 12, lineHeight: 17, marginTop: 14 },
  calendarNote: { color: '#78847c', fontSize: 10, lineHeight: 15, marginTop: 12 },
  saveButton: { minHeight: 48, backgroundColor: '#315f49', borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, marginTop: 20 },
  saveButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  saveButtonIcon: { color: '#fff', fontSize: 17, fontWeight: '700' },
  pressed: { opacity: 0.76 },
  savedConsultation: { backgroundColor: '#e2eee1', borderRadius: 14, padding: 18, marginTop: 18 },
  savedEyebrow: { color: '#54715a', fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  savedDate: { color: '#294d38', fontSize: 18, fontWeight: '700', marginTop: 8, textTransform: 'capitalize' },
  savedDoctor: { color: '#33483a', fontSize: 15, fontWeight: '700', marginTop: 11 },
  savedDetail: { color: '#5e7463', fontSize: 12, marginTop: 5 },
});