import { NextRequest, NextResponse } from 'next/server';
import type { ConstellationState } from '@orbitalmind/shared';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // In production, this would fetch from the control-plane service
    const state: ConstellationState = {
      timestamp: Date.now(),
      satellites: Array.from({ length: 16 }, (_, i) => ({
        id: `SAT-${String(i).padStart(3, '0')}` as any,
        position: {
          latitude: 45 + Math.sin(Date.now() / 100000) * 45,
          longitude: -120 + Math.cos(Date.now() / 100000) * 120,
          altitude: 400 + Math.random() * 100,
        },
        velocity: {
          x: Math.random() * 100 - 50,
          y: Math.random() * 100 - 50,
          z: Math.random() * 100 - 50,
        },
        health: {
          status: i < 14 ? ('healthy' as const) : ('degraded' as const),
          uptime: Math.random() * 1000000,
        },
        thermal: {
          junctionTemperature: 60 + Math.random() * 15,
          powerDissipation: 50 + Math.random() * 25,
          ambientTemperature: -50,
        },
        radiation: {
          seuRate24h: Math.floor(Math.random() * 100),
          lastEvent: Date.now(),
        },
        power: {
          batteryLevel: 75 + Math.random() * 25,
          solarInput: 200 + Math.random() * 50,
        },
        inference: {
          queued: Math.floor(Math.random() * 3),
          processing: Math.floor(Math.random() * 2),
          completed: Math.floor(Math.random() * 1000),
        },
      })),
      topology: {
        edges: Array.from({ length: 24 }, (_, i) => ({
          source: `SAT-${String(Math.floor(Math.random() * 16)).padStart(3, '0')}` as any,
          destination: `SAT-${String(Math.floor(Math.random() * 16)).padStart(3, '0')}` as any,
          quality: 0.6 + Math.random() * 0.4,
        })),
      },
      routing: {},
    };

    return NextResponse.json(state, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch constellation state' },
      { status: 500 }
    );
  }
}
