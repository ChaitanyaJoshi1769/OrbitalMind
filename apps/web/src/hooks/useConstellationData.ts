'use client';

import { useState, useEffect } from 'react';
import { ConstellationState } from '@orbitalmind/shared';

interface UseConstellationDataReturn {
  state: ConstellationState | null;
  loading: boolean;
  error: string | null;
}

export function useConstellationData(): UseConstellationDataReturn {
  const [state, setState] = useState<ConstellationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let intervalId: NodeJS.Timeout;

    const fetchData = async (): Promise<void> => {
      try {
        const response = await fetch('/api/constellation/state', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }

        const data = await response.json();

        if (isMounted) {
          setState(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          setError(errorMessage);
          // Create mock data if API fails
          setState(createMockConstellationState());
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    // Poll for updates every 5 seconds
    intervalId = setInterval(fetchData, 5000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  return { state, loading, error };
}

function createMockConstellationState(): ConstellationState {
  const satellites = Array.from({ length: 16 }, (_, i) => ({
    id: `SAT-${String(i).padStart(3, '0')}` as any,
    position: {
      latitude: Math.random() * 180 - 90,
      longitude: Math.random() * 360 - 180,
      altitude: 400 + Math.random() * 100,
    },
    velocity: {
      x: Math.random() * 1000 - 500,
      y: Math.random() * 1000 - 500,
      z: Math.random() * 1000 - 500,
    },
    health: {
      status: ['healthy', 'healthy', 'degraded', 'offline'][Math.floor(Math.random() * 4)] as any,
      uptime: Math.random() * 100000,
    },
    thermal: {
      junctionTemperature: 60 + Math.random() * 20,
      powerDissipation: 50 + Math.random() * 30,
      ambientTemperature: -50,
    },
    radiation: {
      seuRate24h: Math.floor(Math.random() * 150),
      lastEvent: Date.now(),
    },
    power: {
      batteryLevel: 70 + Math.random() * 30,
      solarInput: 200 + Math.random() * 50,
    },
    inference: {
      queued: Math.floor(Math.random() * 5),
      processing: Math.floor(Math.random() * 3),
      completed: Math.floor(Math.random() * 100),
    },
  }));

  return {
    timestamp: Date.now(),
    satellites,
    topology: {
      edges: Array.from({ length: 20 }, (_, i) => ({
        source: `SAT-${String(Math.floor(Math.random() * 16)).padStart(3, '0')}` as any,
        destination: `SAT-${String(Math.floor(Math.random() * 16)).padStart(3, '0')}` as any,
        quality: 0.5 + Math.random() * 0.5,
      })),
    },
    routing: {},
  };
}
