import React, { useState } from 'react';

import { Banner, Card, Field, PrimaryButton, Screen, ScreenTitle } from '@/src/components/ui';
import { useAppContext } from '@/src/context/app-context';

export default function SettingsScreen() {
  const { baseUrl, setBaseUrlValue, records, setInitialStock, setPassword, clearAllData } = useAppContext();
  const [apiUrl, setApiUrl] = useState(baseUrl);
  const [yarnStock, setYarnStock] = useState(String(records.admin.initial_yarn_stock_kg || 0));
  const [fabricStock, setFabricStock] = useState(String(records.admin.initial_fabric_stock_meters || 0));
  const [password, setPasswordValue] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [clearPassword, setClearPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function saveBaseUrl() {
    setLoading(true);
    setError('');
    try {
      await setBaseUrlValue(apiUrl);
      setMessage('API base URL saved.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save API URL');
    } finally {
      setLoading(false);
    }
  }

  async function saveInitialStock() {
    setLoading(true);
    setError('');
    try {
      await setInitialStock({
        yarn_kg: Number(yarnStock || 0),
        fabric_meters: Number(fabricStock || 0),
      });
      setMessage('Starting stock updated.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update starting stock');
    } finally {
      setLoading(false);
    }
  }

  async function savePassword() {
    setLoading(true);
    setError('');
    try {
      if (!password || password !== confirmPassword) {
        throw new Error('Passwords must match.');
      }
      await setPassword(password);
      setPasswordValue('');
      setConfirmPassword('');
      setMessage('Password updated.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update password');
    } finally {
      setLoading(false);
    }
  }

  async function handleClearData() {
    setLoading(true);
    setError('');
    try {
      await clearAllData(clearPassword);
      setClearPassword('');
      setMessage('All records cleared successfully.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to clear data');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <ScreenTitle
        title="Settings"
        subtitle="Point the app at your local backend, manage opening stock, and control admin security."
      />

      {message ? <Banner text={message} tone="success" /> : null}
      {error ? <Banner text={error} tone="error" /> : null}

      <Card>
        <Field
          label="Backend API URL"
          value={apiUrl}
          onChangeText={setApiUrl}
          placeholder="http://192.168.1.5:8000"
          keyboardType="url"
        />
        <PrimaryButton label="Save API URL" onPress={saveBaseUrl} loading={loading} />
      </Card>

      <Card>
        <Field label="Initial Yarn Stock (kg)" value={yarnStock} onChangeText={setYarnStock} keyboardType="numeric" />
        <Field label="Initial Fabric Stock (m)" value={fabricStock} onChangeText={setFabricStock} keyboardType="numeric" />
        <PrimaryButton label="Set Starting Stock" onPress={saveInitialStock} loading={loading} tone="amber" />
      </Card>

      <Card>
        <Field label={records.admin.password_set ? 'Change Password' : 'Set Password'} value={password} onChangeText={setPasswordValue} secureTextEntry />
        <Field label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
        <PrimaryButton label="Save Password" onPress={savePassword} loading={loading} />
      </Card>

      <Card>
        <Field label="Password to Clear Data" value={clearPassword} onChangeText={setClearPassword} secureTextEntry />
        <PrimaryButton label="Clear All Data" onPress={handleClearData} loading={loading} tone="rose" />
      </Card>
    </Screen>
  );
}
