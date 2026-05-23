'use client';

import React, { useEffect, useRef } from 'react';
import { ConstellationState } from '@orbitalmind/shared';
import * as Cesium from 'cesium';

interface Visualization3DProps {
  state?: ConstellationState;
}

export default function Visualization3D({ state }: Visualization3DProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const entitiesRef = useRef<Map<string, Cesium.Entity>>(new Map());

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize Cesium Viewer
    Cesium.Ion.defaultAccessToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4NTcxNTk5OC02ZTM1LTQxOTAtODI0NS0zMDI0YmM0NTY2MzAiLCJpZCI6MTc5MzMsInNjb3BlcyI6WyJhc3IiLCJnYyJdLCJpYXQiOjE2Mzc4MzE5NjR9.3j7vKPEJT9qjLJ0sS-8T9LKwQMwBhU4FZkF';

    const viewer = new Cesium.Viewer(containerRef.current, {
      imageryProvider: Cesium.ArcGisMapServerImageryProvider.fromUrl(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
      ),
      terrain: Cesium.Terrain.fromUrl(Cesium.CesiumTerrainProvider.fromIonAssetId(1)),
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      fullscreenButton: true,
      vrButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      selectionIndicator: false,
      navigationHelpButton: false,
    });

    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0f172a');

    viewerRef.current = viewer;

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
      }
    };
  }, []);

  // Update satellite positions
  useEffect(() => {
    if (!viewerRef.current || !state) return;

    const viewer = viewerRef.current;

    state.satellites.forEach(satellite => {
      let entity = entitiesRef.current.get(satellite.id);

      if (!entity) {
        entity = viewer.entities.add({
          name: satellite.id,
          position: Cesium.Cartesian3.fromDegrees(0, 0, 0),
          point: {
            pixelSize: 8,
            color:
              satellite.health.status === 'healthy'
                ? Cesium.Color.LIME
                : satellite.health.status === 'degraded'
                  ? Cesium.Color.YELLOW
                  : Cesium.Color.RED,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1,
          },
          label: {
            text: satellite.id,
            font: '12px Inter, sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -15),
          },
        });

        entitiesRef.current.set(satellite.id, entity);
      }

      // Update position
      const position = satellite.position;
      entity.position = Cesium.Cartesian3.fromDegrees(
        position.longitude,
        position.latitude,
        position.altitude * 1000
      );

      // Update color based on health status
      if (entity.point) {
        entity.point.color =
          satellite.health.status === 'healthy'
            ? Cesium.Color.LIME
            : satellite.health.status === 'degraded'
              ? Cesium.Color.YELLOW
              : Cesium.Color.RED;
      }
    });

    // Remove entities for satellites that are no longer in state
    const satelliteIds = new Set(state.satellites.map(s => s.id));
    entitiesRef.current.forEach((entity, id) => {
      if (!satelliteIds.has(id)) {
        viewer.entities.removeById(id);
        entitiesRef.current.delete(id);
      }
    });

    // Zoom to fit all satellites
    if (state.satellites.length > 0) {
      viewer.zoomTo(viewer.entities);
    }
  }, [state]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-slate-950"
      style={{ minHeight: '100%', minWidth: '100%' }}
    />
  );
}
