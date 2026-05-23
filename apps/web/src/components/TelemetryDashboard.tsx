'use client';

import React from 'react';
import { ConstellationState } from '@orbitalmind/shared';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TelemetryDashboardProps {
  state?: ConstellationState;
}

export default function TelemetryDashboard({ state }: TelemetryDashboardProps): React.ReactElement {
  if (!state) {
    return <div className="p-6 text-slate-400">No data available</div>;
  }

  // Aggregate thermal data
  const thermalData = state.satellites.map((sat, idx) => ({
    name: `${sat.id.slice(0, 6)}...`,
    temperature: Math.round(sat.thermal.junctionTemperature),
    powerDissipation: Math.round(sat.thermal.powerDissipation),
  }));

  // Aggregate radiation data
  const radiationData = state.satellites.map(sat => ({
    name: sat.id.slice(0, 6),
    seu: sat.radiation.seuRate24h,
  }));

  // Compute constellation statistics
  const stats = {
    avgTemp: Math.round(
      state.satellites.reduce((sum, s) => sum + s.thermal.junctionTemperature, 0) /
        state.satellites.length
    ),
    maxTemp: Math.round(
      Math.max(...state.satellites.map(s => s.thermal.junctionTemperature))
    ),
    avgPower: Math.round(
      state.satellites.reduce((sum, s) => sum + s.thermal.powerDissipation, 0) /
        state.satellites.length
    ),
    totalSEU: Math.round(
      state.satellites.reduce((sum, s) => sum + s.radiation.seuRate24h, 0)
    ),
  };

  return (
    <div className="p-6 overflow-auto">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <p className="text-sm font-medium text-slate-400">Avg Temperature</p>
            <p className="mt-2 text-3xl font-bold text-blue-400">{stats.avgTemp}°C</p>
            <p className="mt-1 text-xs text-slate-500">Peak: {stats.maxTemp}°C</p>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <p className="text-sm font-medium text-slate-400">Avg Power</p>
            <p className="mt-2 text-3xl font-bold text-green-400">{stats.avgPower}W</p>
            <p className="mt-1 text-xs text-slate-500">Per satellite</p>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <p className="text-sm font-medium text-slate-400">Total SEU Events</p>
            <p className="mt-2 text-3xl font-bold text-yellow-400">{stats.totalSEU}</p>
            <p className="mt-1 text-xs text-slate-500">24-hour count</p>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <p className="text-sm font-medium text-slate-400">Constellation Health</p>
            <p className="mt-2 text-3xl font-bold text-emerald-400">
              {Math.round(
                (state.satellites.filter(s => s.health.status === 'healthy').length /
                  state.satellites.length) *
                  100
              )}
              %
            </p>
            <p className="mt-1 text-xs text-slate-500">Healthy satellites</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-6">
          {/* Thermal Chart */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <h3 className="mb-4 text-sm font-semibold">Thermal Status</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={thermalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Legend />
                <Bar dataKey="temperature" fill="#3b82f6" name="Temperature (°C)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Radiation Chart */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <h3 className="mb-4 text-sm font-semibold">Radiation Events</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={radiationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Legend />
                <Line dataKey="seu" stroke="#eab308" name="SEU Rate (24h)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Satellite Status Table */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
          <h3 className="mb-4 text-sm font-semibold">Satellite Details</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700 bg-slate-900">
                <tr>
                  <th className="px-4 py-2 text-left text-slate-300">Satellite ID</th>
                  <th className="px-4 py-2 text-left text-slate-300">Status</th>
                  <th className="px-4 py-2 text-right text-slate-300">Temp (°C)</th>
                  <th className="px-4 py-2 text-right text-slate-300">Power (W)</th>
                  <th className="px-4 py-2 text-right text-slate-300">Battery (%)</th>
                  <th className="px-4 py-2 text-right text-slate-300">SEU (24h)</th>
                </tr>
              </thead>
              <tbody>
                {state.satellites.map(sat => (
                  <tr key={sat.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-4 py-2 font-mono text-xs text-blue-400">{sat.id}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block rounded px-2 py-1 text-xs font-semibold ${
                          sat.health.status === 'healthy'
                            ? 'bg-green-900/30 text-green-300'
                            : sat.health.status === 'degraded'
                              ? 'bg-yellow-900/30 text-yellow-300'
                              : 'bg-red-900/30 text-red-300'
                        }`}
                      >
                        {sat.health.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {Math.round(sat.thermal.junctionTemperature)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {Math.round(sat.thermal.powerDissipation)}
                    </td>
                    <td className="px-4 py-2 text-right">{Math.round(sat.power.batteryLevel)}</td>
                    <td className="px-4 py-2 text-right">{Math.round(sat.radiation.seuRate24h)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
