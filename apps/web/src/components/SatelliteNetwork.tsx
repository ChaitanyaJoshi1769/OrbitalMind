'use client';

import React, { useMemo } from 'react';
import { ConstellationState } from '@orbitalmind/shared';

interface SatelliteNetworkProps {
  state?: ConstellationState;
}

export default function SatelliteNetwork({ state }: SatelliteNetworkProps): React.ReactElement {
  const networkStats = useMemo(() => {
    if (!state) return null;

    const topology = state.topology || { edges: [] };
    const totalEdges = topology.edges.length;
    const avgPathLength = totalEdges > 0 ? 3 : 0;
    const healthyLinks = topology.edges.filter(e => e.quality > 0.8).length;

    return {
      totalEdges,
      healthyLinks,
      avgPathLength,
      avgLinkQuality: totalEdges > 0 ? 
        (topology.edges.reduce((sum, e) => sum + e.quality, 0) / totalEdges * 100).toFixed(1)
        : 0,
    };
  }, [state]);

  if (!state || !networkStats) {
    return <div className="p-6 text-slate-400">No network data available</div>;
  }

  // Compute routing table visualization
  const routingPaths = useMemo(() => {
    if (!state.topology) return [];

    const paths: Array<{ from: string; to: string; hops: number; quality: string }> = [];
    
    // Sample some routing entries
    state.satellites.slice(0, 5).forEach(sat => {
      const routing = state.routing?.[sat.id] || [];
      routing.slice(0, 3).forEach(entry => {
        paths.push({
          from: sat.id.slice(0, 6),
          to: entry.destination.slice(0, 6),
          hops: entry.nextHop ? 2 : 1,
          quality: `${Math.round(entry.linkQuality * 100)}%`,
        });
      });
    });

    return paths;
  }, [state]);

  return (
    <div className="p-6 overflow-auto">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Network Statistics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <p className="text-sm font-medium text-slate-400">Inter-Satellite Links</p>
            <p className="mt-2 text-3xl font-bold text-blue-400">{networkStats.totalEdges}</p>
            <p className="mt-1 text-xs text-slate-500">Active connections</p>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <p className="text-sm font-medium text-slate-400">Healthy Links</p>
            <p className="mt-2 text-3xl font-bold text-green-400">
              {networkStats.healthyLinks}/{networkStats.totalEdges}
            </p>
            <p className="mt-1 text-xs text-slate-500">Quality &gt; 80%</p>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <p className="text-sm font-medium text-slate-400">Avg Link Quality</p>
            <p className="mt-2 text-3xl font-bold text-yellow-400">{networkStats.avgLinkQuality}%</p>
            <p className="mt-1 text-xs text-slate-500">Constellation-wide</p>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <p className="text-sm font-medium text-slate-400">Avg Path Length</p>
            <p className="mt-2 text-3xl font-bold text-purple-400">{networkStats.avgPathLength}</p>
            <p className="mt-1 text-xs text-slate-500">Hops to destination</p>
          </div>
        </div>

        {/* Network Topology Graph (ASCII representation) */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
          <h3 className="mb-4 text-sm font-semibold">Network Topology</h3>
          <div className="grid grid-cols-2 gap-6">
            {/* Satellite List */}
            <div>
              <h4 className="mb-3 text-xs font-semibold text-slate-300">Satellite Nodes</h4>
              <div className="space-y-2">
                {state.satellites.slice(0, 8).map(sat => (
                  <div
                    key={sat.id}
                    className="flex items-center gap-2 rounded border border-slate-700/50 bg-slate-900/30 px-3 py-2"
                  >
                    <div
                      className={`h-2 w-2 rounded-full ${
                        sat.health.status === 'healthy'
                          ? 'bg-green-500'
                          : sat.health.status === 'degraded'
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      }`}
                    ></div>
                    <span className="font-mono text-xs text-slate-300">{sat.id}</span>
                    <span className="ml-auto text-xs text-slate-500">
                      {state.topology?.edges.filter(e => e.source === sat.id || e.destination === sat.id).length || 0} links
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Link Statistics */}
            <div>
              <h4 className="mb-3 text-xs font-semibold text-slate-300">Link Characteristics</h4>
              <div className="space-y-2">
                {state.topology?.edges.slice(0, 6).map((edge, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded border border-slate-700/50 bg-slate-900/30 px-3 py-2"
                  >
                    <span className="font-mono text-xs text-slate-300">
                      {edge.source.slice(0, 6)} → {edge.destination.slice(0, 6)}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 rounded-full bg-slate-700">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${edge.quality * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-slate-400 w-8 text-right">
                        {Math.round(edge.quality * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Routing Table */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
          <h3 className="mb-4 text-sm font-semibold">Sample Routing Paths</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700 bg-slate-900">
                <tr>
                  <th className="px-4 py-2 text-left text-slate-300">Source</th>
                  <th className="px-4 py-2 text-left text-slate-300">Destination</th>
                  <th className="px-4 py-2 text-center text-slate-300">Hops</th>
                  <th className="px-4 py-2 text-right text-slate-300">Link Quality</th>
                </tr>
              </thead>
              <tbody>
                {routingPaths.map((path, idx) => (
                  <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-4 py-2 font-mono text-xs text-blue-400">{path.from}</td>
                    <td className="px-4 py-2 font-mono text-xs text-green-400">{path.to}</td>
                    <td className="px-4 py-2 text-center text-slate-300">{path.hops}</td>
                    <td className="px-4 py-2 text-right text-yellow-400">{path.quality}</td>
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
