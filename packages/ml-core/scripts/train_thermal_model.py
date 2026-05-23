"""
Training script for thermal prediction models.
Loads telemetry from database and trains LSTM ensemble.
"""

import sys
import logging
from pathlib import Path
import numpy as np
import torch
from datetime import datetime, timedelta

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from models.thermal_lstm import ThermalLSTM, ThermalPredictionConfig, ThermalEnsemble
from training import ThermalTrainer, create_data_loaders

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def generate_synthetic_data(num_samples: int = 50000) -> np.ndarray:
    """
    Generate synthetic thermal telemetry for development/testing.
    In production, this loads from PostgreSQL with TimescaleDB.
    
    Returns:
        Array of shape (num_samples, 5)
        - junction_temperature: 40-90°C
        - power_dissipation: 5-20W
        - ambient_temperature: -50 to 50°C
        - orbital_position: 0-1 (normalized)
        - eclipse_indicator: 0-1
    """
    np.random.seed(42)
    
    timestamps = np.arange(num_samples)
    
    # Orbital period ≈ 90 minutes per revolution
    orbital_period = 5400  # samples
    orbital_phase = (timestamps % orbital_period) / orbital_period
    
    # Eclipse occurs when satellite is in Earth's shadow (approx 35 min per orbit)
    eclipse_duration = int(0.65 * orbital_period / 2)  # 35 min in samples
    eclipse_phase = (timestamps % orbital_period)
    eclipse_indicator = ((eclipse_phase > orbital_period/2 - eclipse_duration/2) & 
                        (eclipse_phase < orbital_period/2 + eclipse_duration/2)).astype(float)
    
    # Ambient temperature varies with position in orbit (sun angle)
    ambient_base = 0 + 40 * np.sin(2 * np.pi * orbital_phase)
    ambient_temp = ambient_base + np.random.normal(0, 2, num_samples)
    
    # Power dissipation increases in sunlit periods
    power_base = 10 + 5 * np.sin(2 * np.pi * orbital_phase)
    power_diss = power_base + np.random.normal(0, 1, num_samples)
    
    # Junction temperature follows power dissipation with thermal lag
    thermal_lag = 120  # samples (≈ 2 hours)
    junction_temp = np.zeros(num_samples)
    junction_temp[0] = 65
    
    for i in range(1, num_samples):
        # First-order thermal response
        tau = thermal_lag
        T_ambient = ambient_temp[i]
        h_coeff = 0.2  # Heat transfer coefficient
        
        temp_increase = (power_diss[i] * h_coeff - 
                        h_coeff * (junction_temp[i-1] - T_ambient)) / tau
        junction_temp[i] = junction_temp[i-1] + temp_increase + np.random.normal(0, 0.5)
    
    # Clip to physical bounds
    junction_temp = np.clip(junction_temp, 40, 100)
    ambient_temp = np.clip(ambient_temp, -50, 50)
    power_diss = np.clip(power_diss, 5, 20)
    
    # Stack features
    data = np.column_stack([
        junction_temp,
        power_diss,
        ambient_temp,
        orbital_phase,
        eclipse_indicator
    ])
    
    return data.astype(np.float32)


def train_single_model(config: ThermalPredictionConfig, checkpoint_dir: Path):
    """Train a single LSTM model."""
    logger.info("Generating synthetic telemetry data...")
    data = generate_synthetic_data()
    
    logger.info(f"Data shape: {data.shape}")
    logger.info("Creating data loaders...")
    train_loader, val_loader, test_loader = create_data_loaders(data, config)
    
    logger.info("Initializing model...")
    model = ThermalLSTM(config)
    
    logger.info("Creating trainer...")
    trainer = ThermalTrainer(model, config, device=config.device)
    
    logger.info("Starting training...")
    trainer.fit(train_loader, val_loader, checkpoint_dir)
    
    # Evaluate on test set
    logger.info("Evaluating on test set...")
    test_loss = trainer.validate(test_loader)
    logger.info(f"Test Loss: {test_loss:.6f}")
    
    return model, trainer


def train_ensemble(config: ThermalPredictionConfig, num_models: int = 3):
    """Train ensemble of models."""
    checkpoint_dir = Path("./models/thermal_ensemble")
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    
    data = generate_synthetic_data()
    train_loader, val_loader, test_loader = create_data_loaders(data, config)
    
    ensemble = ThermalEnsemble(num_models, config)
    
    for i, model in enumerate(ensemble.models):
        logger.info(f"\nTraining ensemble model {i+1}/{num_models}...")
        trainer = ThermalTrainer(model, config, device=config.device)
        trainer.fit(train_loader, val_loader, checkpoint_dir)
        
        test_loss = trainer.validate(test_loader)
        logger.info(f"Model {i+1} Test Loss: {test_loss:.6f}")
    
    # Save ensemble
    ensemble.save(str(checkpoint_dir))
    logger.info(f"Ensemble saved to {checkpoint_dir}")
    
    return ensemble


if __name__ == "__main__":
    config = ThermalPredictionConfig(
        input_sequence_length=360,
        output_sequence_length=30,
        hidden_size=128,
        num_layers=2,
        dropout=0.2,
        learning_rate=0.001,
        batch_size=64,
        num_epochs=20  # Reduced for demo
    )
    
    checkpoint_dir = Path("./models/thermal_lstm")
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    
    logger.info("Starting thermal model training...")
    logger.info(f"Config: {config}")
    
    # Train single model
    model, trainer = train_single_model(config, checkpoint_dir)
    logger.info("Single model training complete")
    
    # Train ensemble
    logger.info("\nStarting ensemble training...")
    ensemble = train_ensemble(config, num_models=3)
    logger.info("Ensemble training complete")
    
    logger.info(f"Models saved to ./models/")
