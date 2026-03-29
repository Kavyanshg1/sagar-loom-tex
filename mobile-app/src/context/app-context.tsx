import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'textile-flow-mobile-base-url';
const DEFAULT_BASE_URL = 'http://192.168.1.5:8000';

type RecordsPayload = {
  yarn_purchases: Record<string, any>[];
  processing_records: Record<string, any>[];
  direct_processing_records: Record<string, any>[];
  dyeing_records: Record<string, any>[];
  admin: {
    initial_yarn_stock_kg: number;
    initial_fabric_stock_meters: number;
    password_set: boolean;
  };
  dashboard: {
    yarn_with_shubham_kg: number;
    fabric_with_sai_meters: number;
    fabric_sent_direct_to_sagar_meters: number;
    initial_yarn_stock_kg?: number;
    initial_fabric_stock_meters?: number;
    flow_summary: Record<string, any>;
  };
};

type AppContextValue = {
  baseUrl: string;
  setBaseUrlValue: (nextValue: string) => Promise<void>;
  records: RecordsPayload;
  loading: boolean;
  error: string;
  refreshRecords: () => Promise<void>;
  createRecord: (kind: string, payload: Record<string, any>) => Promise<any>;
  uploadDocument: (formData: FormData) => Promise<any>;
  setPassword: (password: string) => Promise<any>;
  setInitialStock: (payload: { yarn_kg: number; fabric_meters: number }) => Promise<any>;
  clearAllData: (password: string) => Promise<any>;
};

const defaultRecords: RecordsPayload = {
  yarn_purchases: [],
  processing_records: [],
  direct_processing_records: [],
  dyeing_records: [],
  admin: {
    initial_yarn_stock_kg: 0,
    initial_fabric_stock_meters: 0,
    password_set: false,
  },
  dashboard: {
    yarn_with_shubham_kg: 0,
    fabric_with_sai_meters: 0,
    fabric_sent_direct_to_sagar_meters: 0,
    initial_yarn_stock_kg: 0,
    initial_fabric_stock_meters: 0,
    flow_summary: {},
  },
};

const endpointMap: Record<string, string> = {
  yarn: '/yarn-purchases',
  processing: '/processing-records',
  direct: '/direct-processing-records',
  dyeing: '/dyeing-records',
};

const AppContext = createContext<AppContextValue | null>(null);

async function parseResponse(response: Response) {
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : null;
  if (!response.ok) {
    throw new Error(data?.error || 'Request failed');
  }
  return data;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [records, setRecords] = useState<RecordsPayload>(defaultRecords);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const request = useCallback(async (path: string, options?: RequestInit) => {
    const response = await fetch(`${baseUrl}${path}`, options);
    return parseResponse(response);
  }, [baseUrl]);

  const refreshRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request('/records');
      setRecords(data);
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load records');
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    async function bootstrap() {
      const savedBaseUrl = await AsyncStorage.getItem(STORAGE_KEY);
      const nextBaseUrl = savedBaseUrl || DEFAULT_BASE_URL;
      setBaseUrl(nextBaseUrl);
    }
    bootstrap().catch(() => undefined);
  }, []);

  const setBaseUrlValue = useCallback(async (nextValue: string) => {
    const cleaned = nextValue.trim();
    setBaseUrl(cleaned);
    await AsyncStorage.setItem(STORAGE_KEY, cleaned);
  }, []);

  const createRecord = useCallback(async (kind: string, payload: Record<string, any>) => {
    const data = await request(endpointMap[kind], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await refreshRecords();
    return data;
  }, [request, refreshRecords]);

  const uploadDocument = useCallback(async (formData: FormData) => {
    return request('/upload', {
      method: 'POST',
      body: formData,
    });
  }, [request]);

  const setPassword = useCallback(async (password: string) => {
    const data = await request('/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    await refreshRecords();
    return data;
  }, [request, refreshRecords]);

  const setInitialStock = useCallback(async (payload: { yarn_kg: number; fabric_meters: number }) => {
    const data = await request('/set-initial-stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await refreshRecords();
    return data;
  }, [request, refreshRecords]);

  const clearAllData = useCallback(async (password: string) => {
    const data = await request('/clear-all-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    await refreshRecords();
    return data;
  }, [request, refreshRecords]);

  useEffect(() => {
    refreshRecords().catch(() => undefined);
  }, [refreshRecords]);

  const value = useMemo(
    () => ({
      baseUrl,
      setBaseUrlValue,
      records,
      loading,
      error,
      refreshRecords,
      createRecord,
      uploadDocument,
      setPassword,
      setInitialStock,
      clearAllData,
    }),
    [
      baseUrl,
      records,
      loading,
      error,
      setBaseUrlValue,
      refreshRecords,
      createRecord,
      uploadDocument,
      setPassword,
      setInitialStock,
      clearAllData,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used inside AppProvider');
  }
  return context;
}
