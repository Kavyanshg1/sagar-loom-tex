import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { Banner, Card, Field, PrimaryButton, Screen, ScreenTitle, SegmentedControl } from '@/src/components/ui';
import { useAppContext } from '@/src/context/app-context';

type UploadType = 'yarn' | 'processing' | 'dyeing';
type ProcessingRoute = 'processing' | 'direct';

export default function UploadScreen() {
  const { uploadDocument, createRecord } = useAppContext();
  const [documentType, setDocumentType] = useState<UploadType>('yarn');
  const [processingRoute, setProcessingRoute] = useState<ProcessingRoute>('processing');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  function setValue(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function processAsset(asset: { uri: string; name?: string; mimeType?: string | null }) {
    setUploading(true);
    setMessage('');
    setError('');
    try {
      const data = new FormData();
      data.append('document_type', documentType);
      data.append('file', {
        uri: asset.uri,
        name: asset.name || 'upload',
        type: asset.mimeType || (asset.name?.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
      } as any);
      const response = await uploadDocument(data);
      setPreview(response);
      setForm(
        Object.fromEntries(
          Object.entries(response.detected_fields || {}).map(([key, value]) => [key, String(value ?? '')]),
        ),
      );
      setMessage(response.message || 'Review detected values before saving.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled) {
      await processAsset(result.assets[0]);
    }
  }

  async function useCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera permission is required.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled) {
      await processAsset(result.assets[0]);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      if (documentType === 'yarn') {
        await createRecord('yarn', {
          date: form.date,
          invoice_number: form.invoice_number,
          yarn_weight_kg: Number(form.yarn_weight_kg),
          notes: form.notes || '',
        });
      } else if (documentType === 'processing') {
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
      setMessage('Detected values saved successfully.');
      setPreview(null);
      setForm({});
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save detected values');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScreenTitle
        title="AI Upload"
        subtitle="Capture or upload invoices and challans, then review detected fields before saving."
      />

      <Card>
        <SegmentedControl
          value={documentType}
          onChange={setDocumentType}
          options={[
            { label: 'Yarn Invoice', value: 'yarn' },
            { label: 'Processing', value: 'processing' },
            { label: 'Dyeing', value: 'dyeing' },
          ]}
        />
        {documentType === 'processing' ? (
          <SegmentedControl
            value={processingRoute}
            onChange={setProcessingRoute}
            options={[
              { label: 'To Sai', value: 'processing' },
              { label: 'Direct', value: 'direct' },
            ]}
          />
        ) : null}

        <PrimaryButton label="Upload File or PDF" onPress={pickDocument} loading={uploading} />
        <PrimaryButton label="Open Camera" onPress={useCamera} tone="amber" loading={uploading} />
      </Card>

      {message ? <Banner text={message} tone="info" /> : null}
      {error ? <Banner text={error} tone="error" /> : null}

      {preview ? (
        <Card>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Detected fields</Text>
          <Text style={{ color: '#64748b' }}>{preview.filename}</Text>

          <View style={{ gap: 12 }}>
            {Object.keys(preview.detected_fields || {}).map((key) => (
              <Field
                key={key}
                label={key.replaceAll('_', ' ')}
                value={form[key] ?? ''}
                onChangeText={(value) => setValue(key, value)}
                keyboardType={key.includes('kg') || key.includes('meters') ? 'numeric' : 'default'}
              />
            ))}
          </View>

          <PrimaryButton label="Save Detected Values" onPress={handleSave} loading={saving} />
        </Card>
      ) : null}
    </Screen>
  );
}
