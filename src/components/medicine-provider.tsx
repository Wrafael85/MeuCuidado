import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';

import { useMedicinePin } from '@/components/medicine-pin-provider';
import { useUser } from '@/components/user-provider';

export type Dose = {
  id: number;
  medicineId: string;
  name: string;
  details: string;
  time: string;
  done: boolean;
};

export type PickupReminder = {
  date: string;
  medicineIds: string[];
  medicineDetails: Record<string, PickupMedicineDetails>;
};

export type PickupMedicineDetails = {
  location: string;
  observations: string;
};

export type MedicineSchedule = {
  medicineId: string;
  name: string;
  details: string;
  times: string[];
};

export function getMedicineSchedules(doses: Dose[]): MedicineSchedule[] {
  const schedules = new Map<string, MedicineSchedule>();

  for (const dose of doses) {
    const schedule = schedules.get(dose.medicineId);
    if (schedule) {
      schedule.times.push(dose.time);
    } else {
      schedules.set(dose.medicineId, {
        medicineId: dose.medicineId,
        name: dose.name,
        details: dose.details,
        times: [dose.time],
      });
    }
  }

  return Array.from(schedules.values()).map((schedule) => ({
    ...schedule,
    times: schedule.times.sort((first, second) => first.localeCompare(second)),
  }));
}

let nextDoseId = 1;
const DOSE_STORAGE_PREFIX = 'medicine-doses-v1:';
const PICKUP_STORAGE_PREFIX = 'pickup-reminder-v1:';

function currentDateKey() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function isDose(value: unknown): value is Dose {
  if (typeof value !== 'object' || value === null) return false;
  return 'id' in value
    && typeof value.id === 'number'
    && Number.isInteger(value.id)
    && 'medicineId' in value
    && typeof value.medicineId === 'string'
    && 'name' in value
    && typeof value.name === 'string'
    && 'details' in value
    && typeof value.details === 'string'
    && 'time' in value
    && typeof value.time === 'string'
    && 'done' in value
    && typeof value.done === 'boolean';
}

function isDoseArray(value: unknown): value is Dose[] {
  return Array.isArray(value) && value.every(isDose);
}

function normalizePickupReminder(value: unknown): PickupReminder | null {
  if (typeof value !== 'object'
    || value === null
    || !('date' in value)
    || typeof value.date !== 'string'
    || !('medicineIds' in value)
    || !Array.isArray(value.medicineIds)
    || !value.medicineIds.every((id) => typeof id === 'string')) {
    return null;
  }

  if (!('medicineDetails' in value)) {
    return {
      date: value.date,
      medicineIds: value.medicineIds,
      medicineDetails: {},
    };
  }

  if (typeof value.medicineDetails !== 'object' || value.medicineDetails === null) return null;
  const medicineDetails: Record<string, PickupMedicineDetails> = {};
  for (const [medicineId, details] of Object.entries(value.medicineDetails)) {
    if (
      typeof details !== 'object'
      || details === null
      || !('location' in details)
      || typeof details.location !== 'string'
      || !('observations' in details)
      || typeof details.observations !== 'string'
    ) {
      return null;
    }
    medicineDetails[medicineId] = { location: details.location, observations: details.observations };
  }

  return {
    date: value.date,
    medicineIds: value.medicineIds,
    medicineDetails,
  };
}

async function readDoses(email: string) {
  const value = await AsyncStorage.getItem(`${DOSE_STORAGE_PREFIX}${email}`);
  if (!value) return [];
  const saved: unknown = JSON.parse(value);
  if (
    typeof saved !== 'object'
    || saved === null
    || !('date' in saved)
    || typeof saved.date !== 'string'
    || !('doses' in saved)
    || !isDoseArray(saved.doses)
  ) {
    throw new Error('A agenda de medicamentos salva está inválida.');
  }
  const doses = saved.date === currentDateKey()
    ? saved.doses
    : saved.doses.map((dose) => ({ ...dose, done: false }));
  return doses.sort((first, second) => first.time.localeCompare(second.time));
}

async function writeDoses(email: string, doses: Dose[]) {
  await AsyncStorage.setItem(
    `${DOSE_STORAGE_PREFIX}${email}`,
    JSON.stringify({ date: currentDateKey(), doses }),
  );
}

type MedicineContextValue = {
  doses: Dose[];
  isReady: boolean;
  isLoading: boolean;
  storageError: string;
  unlock: () => void;
  addMedicine: (name: string, details: string, times: string[]) => void;
  updateMedicine: (medicineId: string, name: string, details: string, times: string[]) => void;
  markTaken: (id: number) => void;
  removeDose: (id: number) => void;
  loadPickupReminder: () => Promise<PickupReminder | null>;
  savePickupReminder: (reminder: PickupReminder) => Promise<void>;
};

const MedicineContext = createContext<MedicineContextValue | null>(null);

export function MedicineProvider({ children }: PropsWithChildren) {
  const { user } = useUser();
  const { authorize } = useMedicinePin();
  const email = user?.email ?? null;
  const [doses, setDoses] = useState<Dose[]>([]);
  const [loadedEmail, setLoadedEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [storageError, setStorageError] = useState('');
  const requestedEmailRef = useRef<string | null>(null);
  const activeEmailRef = useRef(email);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  const isReady = email !== null && loadedEmail === email;

  async function loadDoses(userEmail: string) {
    setIsLoading(true);
    setStorageError('');
    try {
      const savedDoses = await readDoses(userEmail);
      if (activeEmailRef.current !== userEmail) return;
      nextDoseId = Math.max(0, ...savedDoses.map((dose) => dose.id)) + 1;
      setDoses(savedDoses);
      setLoadedEmail(userEmail);
    } catch (cause) {
      if (activeEmailRef.current === userEmail) {
        setStorageError(cause instanceof Error ? cause.message : 'Não foi possível carregar os medicamentos salvos.');
      }
    } finally {
      if (activeEmailRef.current === userEmail) setIsLoading(false);
    }
  }

  const unlock = useCallback(() => {
    if (!email) return;
    authorize(() => {
      void loadDoses(email);
    });
  }, [email, authorize]);

  useEffect(() => {
    activeEmailRef.current = email;
    if (!email) {
      requestedEmailRef.current = null;
      return;
    }
    if (requestedEmailRef.current === email) return;

    requestedEmailRef.current = email;
    unlock();
  }, [email, unlock]);

  useEffect(() => {
    if (!email || loadedEmail !== email) return;
    const snapshot = doses;
    const write = writeQueueRef.current.then(() => writeDoses(email, snapshot));
    writeQueueRef.current = write.catch((cause: unknown) => {
      if (activeEmailRef.current === email) {
        setStorageError(cause instanceof Error ? cause.message : 'Não foi possível salvar os medicamentos.');
      }
    });
  }, [doses, email, loadedEmail]);

  const loadPickupReminder = useCallback(async () => {
    if (!email || loadedEmail !== email) {
      throw new Error('Desbloqueie a agenda antes de acessar os lembretes.');
    }
    const value = await AsyncStorage.getItem(`${PICKUP_STORAGE_PREFIX}${email}`);
    if (!value) return null;
    const reminder: unknown = JSON.parse(value);
    const normalizedReminder = normalizePickupReminder(reminder);
    if (!normalizedReminder) {
      throw new Error('Os medicamentos da retirada salva estão inválidos.');
    }
    return normalizedReminder;
  }, [email, loadedEmail]);

  const savePickupReminder = useCallback(async (reminder: PickupReminder) => {
    if (!email || loadedEmail !== email) {
      throw new Error('Desbloqueie a agenda antes de salvar os lembretes.');
    }
    const write = writeQueueRef.current.then(() =>
      AsyncStorage.setItem(`${PICKUP_STORAGE_PREFIX}${email}`, JSON.stringify(reminder)));
    writeQueueRef.current = write.catch((cause: unknown) => {
      if (activeEmailRef.current === email) {
        setStorageError(cause instanceof Error ? cause.message : 'Não foi possível salvar o lembrete de retirada.');
      }
    });
    await write;
  }, [email, loadedEmail]);

  function addMedicine(name: string, details: string, times: string[]) {
    if (!isReady) return;
    const medicineId = `medicine-${Date.now()}-${nextDoseId}`;
    const newDoses = times.map((time) => ({
      id: nextDoseId++,
      medicineId,
      name: name.trim(),
      details: details.trim() || 'Dose cadastrada',
      time,
      done: false,
    }));

    setDoses((current) => [...current, ...newDoses].sort((first, second) => first.time.localeCompare(second.time)));
  }

  function updateMedicine(medicineId: string, name: string, details: string, times: string[]) {
    if (!isReady) return;
    setDoses((current) => {
      const previousDoses = current.filter((dose) => dose.medicineId === medicineId);
      const previousByTime = new Map(previousDoses.map((dose) => [dose.time, dose]));
      const updatedDoses = times.map((time) => {
        const previousDose = previousByTime.get(time);
        return {
          id: previousDose?.id ?? nextDoseId++,
          medicineId,
          name: name.trim(),
          details: details.trim() || 'Dose cadastrada',
          time,
          done: previousDose?.done ?? false,
        };
      });

      return [...current.filter((dose) => dose.medicineId !== medicineId), ...updatedDoses]
        .sort((first, second) => first.time.localeCompare(second.time));
    });
  }

  function markTaken(id: number) {
    if (!isReady) return;
    setDoses((current) => current.map((dose) => (dose.id === id ? { ...dose, done: true } : dose)));
  }

  function removeDose(id: number) {
    if (!isReady) return;
    setDoses((current) => current.filter((dose) => dose.id !== id));
  }

  return (
    <MedicineContext.Provider value={{
      doses,
      isReady,
      isLoading,
      storageError,
      unlock,
      addMedicine,
      updateMedicine,
      markTaken,
      removeDose,
      loadPickupReminder,
      savePickupReminder,
    }}>
      {children}
    </MedicineContext.Provider>
  );
}

export function useMedicines() {
  const context = useContext(MedicineContext);
  if (!context) throw new Error('useMedicines deve ser usado dentro de MedicineProvider');
  return context;
}
