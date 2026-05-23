'use client';

import React, { useEffect, useState } from 'react';
import { ConstellationState } from '@orbitalmind/shared';
import Visualization3D from '@/components/Visualization3D';
import TelemetryDashboard from '@/components/TelemetryDashboard';
import SatelliteNetwork from '@/components/SatelliteNetwork';
import { useConstellationData } from '@/hooks/useConstellationData';

export default function DashboardPage(): React.ReactElement {
  const { state, loading, error } = useConstellationData();
  const [activeTab, setActiveTab] = useState<'3d' | 'telemetry' | 'network'>('3d');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-slate-400">Loading constellation data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 font-semibold">Error loading data</p>
          <p className="text-slate-400 text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Status Bar */}
      <div className="border-b border-slate-800 bg-slate-900 px-6 py-3">
        <div className="mx-auto max-w-7xl flex items-center justify-between text-sm">
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-green-500"></span>
              <span>
                {state?.satellites.filter(s => s.health.status === 'healthy').length || 0}/
                {state?.satellites.length || 0} Healthy
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-yellow-500"></span>
              <span>
                {state?.satellites.filter(s => s.health.status === 'degraded').length || 0} Degraded
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-red-500"></span>
              <span>
                {state?.satellites.filter(s => s.health.status === 'offline').length || 0} Offline
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-slate-300">Last Update: {new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-800 bg-slate-900 px-6">
        <div className="mx-auto max-w-7xl flex gap-4">
          <button
            onClick={() => setActiveTab('3d')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === '3d'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            3D Visualization
          </button>
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === 'telemetry'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Telemetry
          </button>
          <button
            onClick={() => setActiveTab('network')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === 'network'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Network Topology
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === '3d' && <Visualization3D state={state} />}
        {activeTab === 'telemetry' && <TelemetryDashboard state={state} />}
        {activeTab === 'network' && <SatelliteNetwork state={state} />}
      </div>
    </div>
  );
}
