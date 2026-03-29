import React, { useMemo, useState } from 'react';

import { Card, Field, RecordCard, Screen, ScreenTitle, SegmentedControl } from '@/src/components/ui';
import { useAppContext } from '@/src/context/app-context';

type RecordType = 'yarn' | 'processing' | 'direct' | 'dyeing';

export default function RecordsScreen() {
  const { records } = useAppContext();
  const [recordType, setRecordType] = useState<RecordType>('yarn');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const sourceMap = {
      yarn: records.yarn_purchases,
      processing: records.processing_records,
      direct: records.direct_processing_records,
      dyeing: records.dyeing_records,
    };
    const items = sourceMap[recordType] || [];
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) =>
      JSON.stringify(item).toLowerCase().includes(normalizedQuery),
    );
  }, [recordType, query, records]);

  return (
    <Screen>
      <ScreenTitle
        title="Records"
        subtitle="Search challans and invoices with a cleaner mobile record list."
      />

      <Card>
        <SegmentedControl
          value={recordType}
          onChange={setRecordType}
          options={[
            { label: 'Yarn', value: 'yarn' },
            { label: 'Processing', value: 'processing' },
            { label: 'Direct', value: 'direct' },
            { label: 'Dyeing', value: 'dyeing' },
          ]}
        />
        <Field
          label="Search"
          value={query}
          onChangeText={setQuery}
          placeholder="Search invoice, challan, notes"
        />
      </Card>

      {rows.map((row) => (
        <RecordCard
          key={`${recordType}-${row.id}`}
          title={row.invoice_number || row.challan_number || `Record #${row.id}`}
          subtitle={`${row.date} • ${row.created_at || 'Saved'}`}
          meta={JSON.stringify(row)}
        />
      ))}
    </Screen>
  );
}
