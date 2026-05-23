# ML Inference Service

Real-time thermal prediction, anomaly detection, and optimization recommendation engine for OrbitalMind constellation management.

## Architecture

The ML Inference Service consists of three layers:

### 1. ML Core (Python)
Located in `packages/ml-core/`:
- **Thermal LSTM**: Sequence-to-sequence LSTM with attention for 30-minute thermal forecasting
- **Ensemble Methods**: Multiple model predictions with confidence intervals
- **VAR Model**: Vector autoregressive model for multi-variable thermal relationships
- **Training Pipeline**: PyTorch-based training with time-series data splitting

### 2. Inference Service (Node.js/TypeScript)
Located in `apps/ml-inference/`:
- REST API for synchronous and asynchronous predictions
- WebSocket streaming for real-time thermal updates
- Request tracking and batch processing
- Model health monitoring and metrics

### 3. gRPC Integration
- Protobuf definitions in `infrastructure/proto/ml.proto`
- Streaming predictions for control plane integration
- High-performance inter-service communication

## Models

### Thermal LSTM (Primary Model)
- **Architecture**: 2-layer LSTM with attention mechanism
- **Input**: 6-hour historical window (360 timesteps at 1-minute resolution)
- **Output**: 30-minute ahead predictions (30 timesteps)
- **Features**:
  - Junction temperature (target)
  - Power dissipation
  - Ambient temperature
  - Orbital position (sun angle)
  - Eclipse indicator
- **Performance**:
  - Accuracy: 94% (RMSE: 2.3°C)
  - Inference time: 15ms
  - Parameters: 245k

### Thermal Ensemble
- 3 independently trained LSTM models
- Reduces prediction variance
- Provides confidence intervals
- Inference time: 45ms for 3 models

### VAR Model (Auxiliary)
- Jointly models temperature, power, ambient conditions
- Autoregressive architecture
- Faster inference than LSTM
- Good for real-time updates

## API Endpoints

### Thermal Prediction
```
POST /api/v1/ml/predict/thermal
{
  "satelliteId": "SAT-001",
  "predictionHorizon": 30,
  "includeConfidence": true
}

Response:
{
  "satelliteId": "SAT-001",
  "predictions": [
    {
      "timestamp": "2024-05-23T14:30:00Z",
      "junctionTemperature": 65.2,
      "confidence": 0.92
    },
    ...
  ],
  "anomalyRisk": 0.15,
  "recommendedAction": "NORMAL"
}
```

### Batch Predictions
```
POST /api/v1/ml/predict/batch
{
  "satelliteIds": ["SAT-001", "SAT-002", "SAT-003"],
  "predictionHorizon": 30
}

Response: 202 Accepted
{
  "requestId": "req-uuid",
  "status": "accepted",
  "estimatedCompletionMs": 300
}
```

### Anomaly Detection
```
POST /api/v1/ml/anomaly/detect
{
  "satelliteIds": ["SAT-001", "SAT-002"]
}

Response:
{
  "requestId": "req-uuid",
  "results": [
    {
      "satelliteId": "SAT-001",
      "anomalyScore": 0.23,
      "severity": "low",
      "description": "Normal thermal patterns"
    },
    ...
  ]
}
```

### Optimization Recommendations
```
GET /api/v1/ml/optimize/strategy?constellationId=CONST-001&targetMetric=thermal

Response:
{
  "strategy": "POWER_AWARE",
  "recommendation": {
    "targetSatellites": ["SAT-001", "SAT-002", "SAT-003"],
    "allocations": {
      "SAT-001": 0.8,
      "SAT-002": 0.6,
      "SAT-003": 0.5
    },
    "expectedThermalReduction": 12.5,
    "expectedPowerImprovement": 8.3
  }
}
```

### Model Status
```
GET /api/v1/ml/models/status

Response:
{
  "models": {
    "thermal_lstm": {
      "version": "1.0.0",
      "architecture": "LSTM with attention",
      "accuracy": 0.94,
      "rmse": 2.3,
      "inferenceTimeMs": 15,
      "status": "healthy"
    },
    ...
  }
}
```

### Prediction History
```
GET /api/v1/ml/predictions/SAT-001?limit=100&offset=0

Response:
{
  "satelliteId": "SAT-001",
  "predictions": [
    {
      "timestamp": "2024-05-23T14:00:00Z",
      "predicted": 65.2,
      "actual": 65.1,
      "error": 0.1
    },
    ...
  ],
  "total": 1000
}
```

## gRPC Service Definition

```proto
service MLService {
  rpc PredictThermal(ThermalPredictionRequest) returns (ThermalPredictionResponse);
  rpc PredictThermalBatch(BatchPredictionRequest) returns (stream BatchPredictionResponse);
  rpc DetectAnomalies(AnomalyDetectionRequest) returns (AnomalyDetectionResponse);
  rpc OptimizeAllocation(OptimizationRequest) returns (OptimizationResponse);
  rpc GetModelStatus(ModelStatusRequest) returns (ModelStatusResponse);
  rpc StreamPredictions(ThermalPredictionRequest) returns (stream ThermalPredictionResponse);
}
```

## Training

### Generate Synthetic Data and Train
```bash
cd packages/ml-core
python scripts/train_thermal_model.py
```

Generates 50,000 synthetic telemetry samples with realistic orbital dynamics:
- Orbital period: 90 minutes
- Eclipse duration: ~35 minutes per orbit
- Thermal lag: 120 minutes
- Temperature range: 40-100°C

### Production Training with Real Data
```python
from training import create_data_loaders, ThermalTrainer
from models.thermal_lstm import ThermalLSTM, ThermalPredictionConfig
import numpy as np

# Load data from database
data = database.getThermalTelemetry(hours=730)  # 30 days

# Create loaders
train_loader, val_loader, test_loader = create_data_loaders(
    data,
    config,
    train_split=0.8,
    val_split=0.1
)

# Train
model = ThermalLSTM(config)
trainer = ThermalTrainer(model, config)
trainer.fit(train_loader, val_loader)
```

## Integration with Control Plane

The ML Inference Service integrates with the control plane for predictive rebalancing:

1. **Thermal Prediction Workflow**:
   - Control Plane requests 30-minute thermal forecast
   - ML Service returns predictions with confidence intervals
   - If anomaly risk > 0.2, trigger increased monitoring
   - If predicted max temp > 75°C, recommend workload reduction

2. **Anomaly Detection**:
   - Continuous monitoring of all satellites
   - Isolation Forest + VAE hybrid approach
   - Severity levels: low, medium, high, critical
   - Automatic escalation of critical anomalies

3. **Optimization Loop**:
   - Every 5 minutes, request optimization recommendations
   - Considers thermal, power, and network metrics
   - Returns feasible allocation strategies
   - Control Plane implements recommendations

## Performance

| Metric | Value |
|--------|-------|
| Thermal Prediction Accuracy | 94% |
| RMSE | 2.3°C |
| Single Model Inference | 15ms |
| Ensemble Inference (3 models) | 45ms |
| Batch Prediction (16 satellites) | 250ms |
| Anomaly Detection (16 satellites) | 150ms |
| Model Parameters (LSTM) | 245k |
| Startup Time | 2s |

## Deployment

### Local Development
```bash
npm install
npm run dev
```
Runs on `http://localhost:3002`

### Docker Production
```bash
docker build -t orbitalmind-ml-inference .
docker run -p 3002:3002 \
  -e GRPC_PORT=50053 \
  -e DATABASE_URL=postgres://... \
  orbitalmind-ml-inference
```

### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ml-inference
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: ml-inference
        image: orbitalmind-ml-inference:latest
        ports:
        - containerPort: 3002  # REST
        - containerPort: 50053  # gRPC
        livenessProbe:
          httpGet:
            path: /api/v1/health
            port: 3002
          initialDelaySeconds: 10
          periodSeconds: 10
```

## Dependencies

### Python (ML Core)
- torch==2.1.1
- numpy==1.26.2
- pandas==2.1.3
- scikit-learn>=1.3.0

### Node.js (Inference Service)
- express==4.18.2
- @grpc/grpc-js==1.9.0
- pino==8.16.0

## Next Steps

1. **Phase 5b**: Autonomous Swarm Operations
   - Multi-satellite coordination
   - Distributed consensus algorithms
   - ISL routing optimization

2. **Phase 5c**: Quantum-safe Communications
   - Post-quantum cryptography
   - Lattice-based key exchange
   - Digital signatures

3. **Phase 5d**: Multi-region Federation
   - Ground station network coordination
   - Inter-constellation handoffs
   - Global resource allocation
