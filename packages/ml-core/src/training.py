"""
Training pipeline for thermal prediction models.
"""

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import numpy as np
from typing import Tuple, Optional
import logging
from pathlib import Path
from models.thermal_lstm import ThermalLSTM, ThermalPredictionConfig

logger = logging.getLogger(__name__)


class ThermalDataset(Dataset):
    """
    PyTorch dataset for thermal time-series data.
    
    Loads data from database or CSV and creates sequences for training.
    """
    
    def __init__(
        self,
        data: np.ndarray,  # (num_samples, num_features)
        input_sequence_length: int = 360,
        output_sequence_length: int = 30,
        feature_index_temp: int = 0
    ):
        """
        Args:
            data: Historical telemetry data
            input_sequence_length: Number of past timesteps to use as input
            output_sequence_length: Number of future timesteps to predict
            feature_index_temp: Index of junction temperature in features
        """
        self.data = data
        self.input_seq_len = input_sequence_length
        self.output_seq_len = output_sequence_length
        self.temp_idx = feature_index_temp
        
        # Normalize data to [0, 1]
        self.data_min = data.min(axis=0)
        self.data_max = data.max(axis=0)
        self.data_normalized = (data - self.data_min) / (self.data_max - self.data_min + 1e-8)
        
        # Valid indices for creating sequences
        self.valid_indices = np.arange(
            input_sequence_length,
            len(data) - output_sequence_length
        )
    
    def __len__(self) -> int:
        return len(self.valid_indices)
    
    def __getitem__(self, idx: int) -> Tuple[np.ndarray, np.ndarray]:
        """
        Returns:
            Tuple of (input_sequence, target_temperatures)
        """
        pos = self.valid_indices[idx]
        
        # Input: historical window
        input_seq = self.data_normalized[
            pos - self.input_seq_len:pos
        ]
        
        # Target: future temperatures only
        target_seq = self.data_normalized[
            pos:pos + self.output_seq_len,
            self.temp_idx
        ]
        
        return (
            input_seq.astype(np.float32),
            target_seq.astype(np.float32)
        )
    
    def denormalize(self, normalized: np.ndarray, feature_idx: int = 0) -> np.ndarray:
        """Convert from normalized to original scale."""
        return (
            normalized * (self.data_max[feature_idx] - self.data_min[feature_idx]) +
            self.data_min[feature_idx]
        )


class ThermalTrainer:
    """Training loop for thermal prediction models."""
    
    def __init__(
        self,
        model: ThermalLSTM,
        config: ThermalPredictionConfig,
        device: str = "cuda"
    ):
        self.model = model
        self.config = config
        self.device = device
        
        self.optimizer = torch.optim.AdamW(
            model.parameters(),
            lr=config.learning_rate,
            weight_decay=1e-5
        )
        
        # Multi-scale loss: weight recent predictions higher
        self.criterion = nn.MSELoss()
        self.lr_scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
            self.optimizer,
            T_max=config.num_epochs
        )
        
        self.train_losses = []
        self.val_losses = []
    
    def train_epoch(self, train_loader: DataLoader) -> float:
        """Train for one epoch."""
        self.model.train()
        total_loss = 0.0
        
        for batch_idx, (encoder_input, target) in enumerate(train_loader):
            encoder_input = encoder_input.to(self.device)
            target = target.to(self.device).unsqueeze(-1)
            
            # Forward pass
            predictions = self.model(encoder_input)
            
            # Loss with temporal weighting (recent predictions more important)
            timesteps = predictions.shape[1]
            weights = torch.linspace(0.5, 1.0, timesteps, device=self.device)
            weighted_loss = (
                ((predictions - target) ** 2 * weights.view(1, -1, 1)).mean()
            )
            
            # Backward pass
            self.optimizer.zero_grad()
            weighted_loss.backward()
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
            self.optimizer.step()
            
            total_loss += weighted_loss.item()
            
            if (batch_idx + 1) % 10 == 0:
                logger.info(
                    f"Batch {batch_idx + 1}/{len(train_loader)}, "
                    f"Loss: {weighted_loss.item():.6f}"
                )
        
        avg_loss = total_loss / len(train_loader)
        self.train_losses.append(avg_loss)
        return avg_loss
    
    def validate(self, val_loader: DataLoader) -> float:
        """Validation step."""
        self.model.eval()
        total_loss = 0.0
        
        with torch.no_grad():
            for encoder_input, target in val_loader:
                encoder_input = encoder_input.to(self.device)
                target = target.to(self.device).unsqueeze(-1)
                
                predictions = self.model(encoder_input)
                loss = self.criterion(predictions, target)
                total_loss += loss.item()
        
        avg_loss = total_loss / len(val_loader)
        self.val_losses.append(avg_loss)
        return avg_loss
    
    def fit(
        self,
        train_loader: DataLoader,
        val_loader: DataLoader,
        checkpoint_dir: Optional[Path] = None
    ):
        """Complete training loop."""
        best_val_loss = float('inf')
        
        for epoch in range(self.config.num_epochs):
            train_loss = self.train_epoch(train_loader)
            val_loss = self.validate(val_loader)
            self.lr_scheduler.step()
            
            logger.info(
                f"Epoch {epoch + 1}/{self.config.num_epochs} | "
                f"Train: {train_loss:.6f} | Val: {val_loss:.6f}"
            )
            
            # Save best model
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                if checkpoint_dir:
                    checkpoint_dir.mkdir(parents=True, exist_ok=True)
                    torch.save(
                        self.model.state_dict(),
                        checkpoint_dir / f"best_model_epoch_{epoch}.pt"
                    )
                    logger.info(f"Saved checkpoint at epoch {epoch}")


def create_data_loaders(
    data: np.ndarray,
    config: ThermalPredictionConfig,
    train_split: float = 0.8,
    val_split: float = 0.1
) -> Tuple[DataLoader, DataLoader, DataLoader]:
    """
    Create train/val/test data loaders.
    
    Args:
        data: Complete telemetry dataset
        config: Training configuration
        train_split: Fraction for training (0.8 = 80%)
        val_split: Fraction for validation (0.1 = 10%)
        
    Returns:
        Tuple of (train_loader, val_loader, test_loader)
    """
    n = len(data)
    train_end = int(n * train_split)
    val_end = train_end + int(n * val_split)
    
    train_data = data[:train_end]
    val_data = data[train_end:val_end]
    test_data = data[val_end:]
    
    train_dataset = ThermalDataset(
        train_data,
        config.input_sequence_length,
        config.output_sequence_length
    )
    val_dataset = ThermalDataset(
        val_data,
        config.input_sequence_length,
        config.output_sequence_length
    )
    test_dataset = ThermalDataset(
        test_data,
        config.input_sequence_length,
        config.output_sequence_length
    )
    
    train_loader = DataLoader(
        train_dataset,
        batch_size=config.batch_size,
        shuffle=True,
        num_workers=4
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=config.batch_size,
        shuffle=False,
        num_workers=2
    )
    test_loader = DataLoader(
        test_dataset,
        batch_size=config.batch_size,
        shuffle=False,
        num_workers=2
    )
    
    return train_loader, val_loader, test_loader
