import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

const USER_KEY = 'local-user-profile-v1';

export type UserProfile = {
  name: string;
  email: string;
};

type UserContextValue = {
  user: UserProfile | null;
  isLoading: boolean;
  storageError: string;
  register: (name: string, email: string) => Promise<void>;
  retryLoad: () => void;
};

const UserContext = createContext<UserContextValue | null>(null);

async function readSavedUser(): Promise<UserProfile | null> {
  const value = process.env.EXPO_OS === 'web'
    ? globalThis.localStorage.getItem(USER_KEY)
    : await SecureStore.getItemAsync(USER_KEY);
  if (!value) return null;

  const profile: unknown = JSON.parse(value);
  if (
    typeof profile !== 'object'
    || profile === null
    || !('name' in profile)
    || typeof profile.name !== 'string'
    || !('email' in profile)
    || typeof profile.email !== 'string'
  ) {
    throw new Error('O perfil salvo está inválido. Limpe os dados locais do app para cadastrar novamente.');
  }

  return { name: profile.name, email: profile.email };
}

async function saveUser(user: UserProfile) {
  const value = JSON.stringify(user);
  if (process.env.EXPO_OS === 'web') {
    globalThis.localStorage.setItem(USER_KEY, value);
    return;
  }
  await SecureStore.setItemAsync(USER_KEY, value);
}

export function UserProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [storageError, setStorageError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void readSavedUser()
      .then((savedUser) => {
        if (!cancelled) setUser(savedUser);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setStorageError(cause instanceof Error ? cause.message : 'Não foi possível carregar o perfil salvo.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  async function register(name: string, email: string) {
    const profile = { name: name.trim(), email: email.trim().toLowerCase() };
    await saveUser(profile);
    setStorageError('');
    setUser(profile);
  }

  function retryLoad() {
    setIsLoading(true);
    setStorageError('');
    setLoadAttempt((current) => current + 1);
  }

  return (
    <UserContext.Provider value={{ user, isLoading, storageError, register, retryLoad }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser deve ser usado dentro de UserProvider');
  return context;
}
