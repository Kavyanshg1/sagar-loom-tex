import React from 'react';
import { Text, View } from 'react-native';

import { Card, Screen, ScreenTitle, StatCard } from '@/src/components/ui';
import { useAppContext } from '@/src/context/app-context';

function formatMetric(value: number, unit: string) {
  return `${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${unit}`;
}

export default function DashboardScreen() {
  const { records } = useAppContext();
  const dashboard = records.dashboard;
  const flow = dashboard.flow_summary || {};

  return (
    <Screen>
      <ScreenTitle
        title="Textile Flow"
        subtitle="Live production balances from the existing Flask backend, optimized for quick mobile checks."
      />

      <StatCard
        label="Yarn Balance"
        value={formatMetric(dashboard.yarn_with_shubham_kg, 'kg')}
        tone="amber"
      />
      <StatCard
        label="Fabric Balance"
        value={formatMetric(dashboard.fabric_with_sai_meters, 'm')}
        tone="blue"
      />

      <Card>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Operational snapshot</Text>
        <View style={{ gap: 10 }}>
          <Text style={{ color: '#475569' }}>
            Direct to Sagar Loom Tex: {formatMetric(dashboard.fabric_sent_direct_to_sagar_meters, 'm')}
          </Text>
          <Text style={{ color: '#475569' }}>
            Opening yarn stock: {formatMetric(dashboard.initial_yarn_stock_kg || 0, 'kg')}
          </Text>
          <Text style={{ color: '#475569' }}>
            Opening fabric stock: {formatMetric(dashboard.initial_fabric_stock_meters || 0, 'm')}
          </Text>
        </View>
      </Card>

      <Card>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Flow highlights</Text>
        <Text style={{ color: '#475569' }}>
          Manglam total yarn: {formatMetric(flow.manglam?.total_yarn_purchased_kg || 0, 'kg')}
        </Text>
        <Text style={{ color: '#475569' }}>
          Shubham produced: {formatMetric(flow.shubham?.fabric_produced_meters || 0, 'm')}
        </Text>
        <Text style={{ color: '#475569' }}>
          Sai dyed: {formatMetric(flow.sai?.fabric_dyed_meters || 0, 'm')}
        </Text>
        <Text style={{ color: '#475569' }}>
          Direct fabric to Sagar: {formatMetric(flow.sagar?.fabric_received_direct_meters || 0, 'm')}
        </Text>
      </Card>
    </Screen>
  );
}
