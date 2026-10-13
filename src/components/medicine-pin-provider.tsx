import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useRef, useState, type PropsWithChildren } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PIN_KEY = 'medicine-edit-pin-v1';
const WEB_PIN_ITERATIONS = 120_000;

type WebPinRecord = {
  salt: string;
  hash: string;
};

type PinMode = 'loading' | 'setup' | 'verify';

type MedicinePinContextValue = {
  authorize: (action: () => void) => void;
};

const MedicinePinContext = createContext<MedicinePinContextValue | null>(null);

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashWebPin(pin: string, salt: Uint8Array) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Este navegador não oferece armazenamento seguro para proteger o PIN.');
  }

  const saltBuffer = new ArrayBuffer(salt.byteLength);
  new Uint8Array(saltBuffer).set(salt);
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await globalThis.crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuffer, iterations: WEB_PIN_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
  return toHex(new Uint8Array(bits));
}

async function readSavedPin(): Promise<string | WebPinRecord | null> {
  if (process.env.EXPO_OS === 'web') {
    const value = globalThis.localStorage.getItem(PIN_KEY);
    return value ? JSON.parse(value) as WebPinRecord : null;
  }
  return SecureStore.getItemAsync(PIN_KEY);
}

async function savePin(pin: string) {
  if (process.env.EXPO_OS === 'web') {
    if (!globalThis.crypto?.getRandomValues) {
      throw new Error('Este navegador não oferece armazenamento seguro para proteger o PIN.');
    }
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const record: WebPinRecord = { salt: toHex(salt), hash: await hashWebPin(pin, salt) };
    globalThis.localStorage.setItem(PIN_KEY, JSON.stringify(record));
    return;
  }
  await SecureStore.setItemAsync(PIN_KEY, pin);
}

async function matchesPin(pin: string, savedPin: string | WebPinRecord) {
  if (typeof savedPin === 'string') return pin === savedPin;

  const salt = new Uint8Array(savedPin.salt.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
  if (salt.length !== 16 || !/^[\da-f]{64}$/i.test(savedPin.hash)) {
    throw new Error('O PIN salvo está inválido. Reinstale o app para configurar outro PIN.');
  }
  const hash = await hashWebPin(pin, salt);
  let difference = 0;
  for (let index = 0; index < hash.length; index += 1) {
    difference |= hash.charCodeAt(index) ^ savedPin.hash.charCodeAt(index);
  }
  return difference === 0;
}

export function MedicinePinProvider({ children }: PropsWithChildren) {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<PinMode>('loading');
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const savedPinRef = useRef<string | WebPinRecord | null>(null);
  const actionRef = useRef<(() => void) | null>(null);

  async function loadPin() {
    setMode('loading');
    setError('');
    setBusy(true);
    try {
      savedPinRef.current = await readSavedPin();
      setMode(savedPinRef.current ? 'verify' : 'setup');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível acessar o armazenamento seguro.');
    } finally {
      setBusy(false);
    }
  }

  function authorize(action: () => void) {
    if (visible) return;
    actionRef.current = action;
    setVisible(true);
    setPin('');
    setConfirmation('');
    void loadPin();
  }

  function cancel() {
    actionRef.current = null;
    setVisible(false);
    setPin('');
    setConfirmation('');
    setError('');
  }

  async function submitPin() {
    if (busy || mode === 'loading') return;
    setError('');

    if (!/^\d{6}$/.test(pin)) {
      setError('O PIN deve conter exatamente 6 números.');
      return;
    }
    if (mode === 'setup' && pin !== confirmation) {
      setError('Os PINs não coincidem.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'setup') {
        await savePin(pin);
      } else if (!savedPinRef.current || !(await matchesPin(pin, savedPinRef.current))) {
        setPin('');
        setError('PIN incorreto. Tente novamente.');
        return;
      }

      const action = actionRef.current;
      actionRef.current = null;
      setVisible(false);
      setPin('');
      setConfirmation('');
      action?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar ou validar o PIN.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <MedicinePinContext.Provider value={{ authorize }}>
      {children}
      <Modal visible={visible} transparent animationType="fade" onRequestClose={cancel}>
        <View style={styles.backdrop}>
          <SafeAreaView style={styles.dialog} edges={['top', 'bottom']}>
            <Text style={styles.title}>
              {mode === 'setup' ? 'Proteja suas alterações' : 'Confirme seu PIN'}
            </Text>
            <Text style={styles.description}>
              {mode === 'setup'
                ? 'Crie um PIN de 6 números. Ele será solicitado para desbloquear sua agenda e proteger alterações nos medicamentos.'
                : 'Digite seu PIN de 6 números para desbloquear sua agenda ou continuar.'}
            </Text>
            {mode !== 'loading' && (
              <>
                <Text style={styles.label}>{mode === 'setup' ? 'Novo PIN' : 'PIN'}</Text>
                <TextInput
                  accessibilityLabel={mode === 'setup' ? 'Novo PIN de seis dígitos' : 'PIN de seis dígitos'}
                  autoComplete="off"
                  autoFocus
                  keyboardType="number-pad"
                  maxLength={6}
                  onChangeText={(value) => setPin(value.replace(/\D/g, ''))}
                  onSubmitEditing={() => {
                    if (mode === 'verify') void submitPin();
                  }}
                  secureTextEntry
                  style={styles.input}
                  value={pin}
                />
                {mode === 'setup' && (
                  <>
                    <Text style={styles.label}>Confirme o PIN</Text>
                    <TextInput
                      accessibilityLabel="Confirme o PIN de seis dígitos"
                      autoComplete="off"
                      keyboardType="number-pad"
                      maxLength={6}
                      onChangeText={(value) => setConfirmation(value.replace(/\D/g, ''))}
                      onSubmitEditing={() => void submitPin()}
                      secureTextEntry
                      style={styles.input}
                      value={confirmation}
                    />
                  </>
                )}
              </>
            )}
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {mode === 'loading' && !error ? <Text style={styles.description}>Verificando armazenamento seguro…</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={busy || mode === 'loading'}
              onPress={() => void submitPin()}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, (busy || mode === 'loading') && styles.disabled]}>
              <Text style={styles.primaryButtonText}>{busy ? 'Aguarde…' : mode === 'setup' ? 'Salvar PIN' : 'Confirmar'}</Text>
            </Pressable>
            {error && mode === 'loading' ? (
              <Pressable accessibilityRole="button" onPress={() => void loadPin()} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Tentar novamente</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" onPress={cancel} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>
    </MedicinePinContext.Provider>
  );
}

export function useMedicinePin() {
  const context = useContext(MedicinePinContext);
  if (!context) throw new Error('useMedicinePin deve ser usado dentro de MedicinePinProvider');
  return context;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(24, 38, 29, 0.48)' },
  dialog: { width: '100%', maxWidth: 420, alignSelf: 'center', backgroundColor: '#f8f9f5', borderRadius: 20, padding: 24 },
  title: { color: '#20372d', fontSize: 23, fontWeight: '700' },
  description: { color: '#68766e', fontSize: 14, lineHeight: 21, marginTop: 8 },
  label: { color: '#46584d', fontSize: 12, fontWeight: '700', marginBottom: 7, marginTop: 17 },
  input: { height: 50, borderWidth: 1, borderColor: '#dce3dc', borderRadius: 9, backgroundColor: '#fff', paddingHorizontal: 13, color: '#263b31', fontSize: 18, letterSpacing: 8 },
  error: { color: '#a04c44', fontSize: 12, lineHeight: 17, marginTop: 12 },
  primaryButton: { height: 49, backgroundColor: '#315f49', borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  retryButton: { alignItems: 'center', paddingVertical: 13 },
  retryButtonText: { color: '#315f49', fontSize: 13, fontWeight: '700' },
  cancelButton: { alignItems: 'center', paddingVertical: 13 },
  cancelButtonText: { color: '#68766e', fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.6 },
});
