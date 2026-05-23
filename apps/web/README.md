# OrbitalMind Web Dashboard

Production-grade Next.js dashboard for real-time monitoring and control of satellite constellations.

## Features

- **3D Orbital Visualization**: Real-time 3D rendering of satellite positions using CesiumJS
- **Real-time Telemetry**: Live thermal, power, and radiation metrics
- **Network Topology**: Inter-satellite link visualization and routing analysis
- **Responsive Design**: Dark theme optimized for space operations centers
- **Multi-tab Interface**: Dashboard, constellation, telemetry, and network views
- **High Performance**: Server-side rendering with streaming updates

## Architecture

### Components

- **Visualization3D**: CesiumJS-based 3D orbital visualization
- **TelemetryDashboard**: Recharts-based real-time metrics dashboard
- **SatelliteNetwork**: Network topology and routing visualization
- **API Routes**: Next.js API handlers for data aggregation

### Data Flow

```
Control Plane Service
        ↓
Next.js API Routes (/api/constellation/state)
        ↓
React Client (useConstellationData hook)
        ↓
3D Visualization & Telemetry Components
```

## Development

### Setup

```bash
# Install dependencies
pnpm install

# Run development server
pnpm -F @orbitalmind/web dev
```

Visit http://localhost:3000 for the dashboard.

### Build

```bash
# Build for production
pnpm -F @orbitalmind/web build

# Start production server
pnpm -F @orbitalmind/web start
```

## Configuration

Environment variables in `.env.local`:

- `NEXT_PUBLIC_API_BASE_URL`: API endpoint (default: http://localhost:3000/api)
- `NEXT_PUBLIC_CONTROL_PLANE_URL`: Control plane service URL
- `NEXT_PUBLIC_TELEMETRY_URL`: WebSocket telemetry endpoint
- `NEXT_PUBLIC_CESIUM_TOKEN`: Cesium Ion access token

## 3D Visualization

The 3D view uses CesiumJS for WebGL-accelerated orbital rendering:

- **Real-time Position Updates**: Satellite positions update every 5 seconds
- **Color-coded Health**: Green (healthy), yellow (degraded), red (offline)
- **Interactive Camera**: Zoom, pan, rotate to inspect constellation
- **Geographic Accuracy**: WGS84 coordinates with terrain

## Telemetry Dashboard

Real-time metrics for constellation health:

- **Temperature Monitoring**: Junction temperature trends
- **Power Consumption**: Per-satellite power profiles
- **Radiation Events**: SEU detection and statistics
- **Health Status**: Satellite status overview

## Network Topology

Analysis of inter-satellite links:

- **Link Quality**: Real-time ISL quality metrics
- **Routing Paths**: Sample routes between satellites
- **Network Statistics**: Constellation connectivity analysis

## Performance Optimization

- **Image Optimization**: Next.js Image component for CesiumJS assets
- **Code Splitting**: Automatic route-based splitting
- **Streaming Updates**: Real-time data with 5-second polling
- **Component Memoization**: React.memo for expensive components

## Type Safety

100% TypeScript with strict mode enabled:

- Shared types from `@orbitalmind/shared`
- Type-safe API responses
- No implicit `any` types

## Monitoring

Integrated observability:

- OpenTelemetry metrics collection
- Performance monitoring dashboard
- API response time tracking
- Component render profiling

## Future Enhancements

- Real-time WebSocket updates (replace 5s polling)
- Autonomous mission planning UI
- Advanced thermal prediction visualizations
- Machine learning model inference interface
- Voice command integration
- Mobile-responsive redesign

## Support

For issues or questions, open a GitHub issue or contact: chaitanyajoshi15@gmail.com
