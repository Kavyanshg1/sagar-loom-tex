import React, { useMemo, useState } from 'react';
import { Text } from 'react-native';

import { Banner, Card, Field, PrimaryButton, Screen, ScreenTitle, SegmentedControl } from '@/src/components/ui';
import { useAppContext } from '@/src/context/app-context';

type EntryType = 'yarn' | 'processing' | 'dyeing';
type ProcessingRoute = 'processing' | 'direct';

const today = new Date().toISOString().slice(0, 10);

export default function AddEntryScreen() {
  const { createRecord, records } = useAppContext();
  const [entryType, setEntryType] = useState<EntryType>('yarn');
  const [processingRoute, setProcessingRoute] = useState<ProcessingRoute>('processing');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: today,
    invoice_number: '',
    challan_number: '',
    yarn_weight_kg: '',
    yarn_consumed_kg: '',
    fabric_produced_meters: '',
    fabric_dyed_meters: '',
    notes: '',
  });

  const summaryHint = useMemo(() => {
    if (entryType === 'yarn') {
      return `Current yarn balance: ${records.dashboard.yarn_with_shubham_kg} kg`;
    }
    if (entryType === 'processing') {
      return `Current Sai fabric balance: ${records.dashboard.fabric_with_sai_meters} m`;
    }
    return `Current direct fabric total: ${records.dashboard.fabric_sent_direct_to_sagar_meters} m`;
  }, [entryType, records.dashboard]);

  function setValue(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      if (entryType === 'yarn') {
        await createRecord('yarn', {
          date: form.date,
          invoice_number: form.invoice_number,
          yarn_weight_kg: Number(form.yarn_weight_kg),
          notes: form.notes,
        });
      } else if (entryType === 'processing') {
        await createRecord(processingRoute, {
          date: form.date,
          challan_number: form.challan_number,
          yarn_consumed_kg: Number(form.yarn_consumed_kg),
          fabric_produced_meters: Number(form.fabric_produced_meters),
        });
      } else {
        await createRecord('dyeing', {
          date: form.date,
          challan_number: form.challan_number,
          fabric_dyed_meters: Number(form.fabric_dyed_meters),
        });
      }

      setMessage('Entry saved successfully.');
      setForm({
        date: today,
        invoice_number: '',
        challan_number: '',
        yarn_weight_kg: '',
        yarn_consumed_kg: '',
        fabric_produced_meters: '',
        fabric_dyed_meters: '',
        notes: '',
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save entry');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScreenTitle
        title="Add Entry"
        subtitle="Fast mobile forms for yarn purchases, processing challans, and dyeing output."
      />

      <Card>
        <SegmentedControl
          value={entryType}
          onChange={setEntryType}
          options={[
            { label: 'Yarn Purchase', value: 'yarn' },
            { label: 'Processing', value: 'processing' },
            { label: 'Dyeing', value: 'dyeing' },
          ]}
        />
        <Text style={{ color: '#64748b', fontSize: 13 }}>{summaryHint}</Text>
      </Card>

      <Card>
        <Field label="Date" value={form.date} onChangeText={(value) => setValue('date', value)} placeholder="YYYY-MM-DD" />

        {entryType === 'yarn' ? (
          <>
            <Field label="Invoice Number" value={form.invoice_number} onChangeText={(value) => setValue('invoice_number', value)} />
            <Field label="Yarn Weight (kg)" value={form.yarn_weight_kg} onChangeText={(value) => setValue('yarn_weight_kg', value)} keyboardType="numeric" />
            <Field label="Notes" value={form.notes} onChangeText={(value) => setValue('notes', value)} multiline />
          </>
        ) : null}

        {entryType === 'processing' ? (
          <>
            <SegmentedControl
              value={processingRoute}
              onChange={setProcessingRoute}
              options={[
                { label: 'To Sai Leela', value: 'processing' },
                { label: 'Direct to Sagar', value: 'direct' },
              ]}
            />
            <Field label="Challan Number" value={form.challan_number} onChangeText={(value) => setValue('challan_number', value)} />
            <Field label="Yarn Consumed (kg)" value={form.yarn_consumed_kg} onChangeText={(value) => setValue('yarn_consumed_kg', value)} keyboardType="numeric" />
            <Field label="Fabric Produced (meters)" value={form.fabric_produced_meters} onChangeText={(value) => setValue('fabric_produced_meters', value)} keyboardType="numeric" />
          </>
        ) : null}

        {entryType === 'dyeing' ? (
          <>
            <Field label="Challan Number" value={form.challan_number} onChangeText={(value) => setValue('challan_number', value)} />
            <Field label="Fabric Dyed (meters)" value={form.fabric_dyed_meters} onChangeText={(value) => setValue('fabric_dyed_meters', value)} keyboardType="numeric" />
          </>
        ) : null}

        {message ? <Banner text={message} tone="success" /> : null}
        {error ? <Banner text={error} tone="error" /> : null}
        <PrimaryButton label="Save Entry" onPress={handleSave} loading={saving} />
      </Card>
    </Screen>
  );
}
