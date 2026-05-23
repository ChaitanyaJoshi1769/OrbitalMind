"""
LSTM-based thermal prediction model for satellite constellation.
Predicts junction temperature 30 minutes ahead using 6-hour historical window.
"""

import torch
import torch.nn as nn
import numpy as np
from typing import Tuple, Optional
from dataclasses import dataclass


@dataclass
class ThermalPredictionConfig:
    """Configuration for thermal prediction model."""
    input_sequence_length: int = 360  # 6 hours at 1-minute resolution
    output_sequence_length: int = 30  # 30 minutes ahead
    hidden_size: int = 128
    num_layers: int = 2
    dropout: float = 0.2
    learning_rate: float = 0.001
    batch_size: int = 64
    num_epochs: int = 50
    device: str = "cuda" if torch.cuda.is_available() else "cpu"


class ThermalLSTM(nn.Module):
    """
    LSTM model for thermal prediction.
    
    Input: (batch_size, sequence_length, input_features)
    - junction_temperature: Primary prediction target
    - power_dissipation: High correlation with temperature
    - ambient_temperature: External environmental factor
    - orbital_position: Sun angle affects solar heating
    - eclipse_indicator: Binary flag for eclipse periods
    
    Output: (batch_size, output_sequence_length, 1)
    - Predicted junction_temperature at each future timestep
    """
    
    def __init__(self, config: ThermalPredictionConfig):
        super(ThermalLSTM, self).__init__()
        self.config = config
        self.input_size = 5  # junction_temp, power, ambient, orbital_pos, eclipse_flag
        
        # LSTM encoder processes historical sequence
        self.lstm_encoder = nn.LSTM(
            input_size=self.input_size,
            hidden_size=config.hidden_size,
            num_layers=config.num_layers,
            dropout=config.dropout if config.num_layers > 1 else 0,
            batch_first=True
        )
        
        # Attention mechanism on encoder outputs
        self.attention = nn.MultiheadAttention(
            embed_dim=config.hidden_size,
            num_heads=8,
            dropout=config.dropout,
            batch_first=True
        )
        
        # Decoder LSTM generates predictions
        self.lstm_decoder = nn.LSTM(
            input_size=config.hidden_size + 1,  # encoder hidden + temperature
            hidden_size=config.hidden_size,
            num_layers=config.num_layers,
            dropout=config.dropout if config.num_layers > 1 else 0,
            batch_first=True
        )
        
        # Output projection layers
        self.fc = nn.Sequential(
            nn.Linear(config.hidden_size, config.hidden_size // 2),
            nn.ReLU(),
            nn.Dropout(config.dropout),
            nn.Linear(config.hidden_size // 2, 1)
        )
        
        self.to(config.device)
    
    def forward(
        self,
        encoder_input: torch.Tensor,  # (batch, seq_len, input_size)
        decoder_init_temp: Optional[torch.Tensor] = None  # (batch, 1)
    ) -> torch.Tensor:  # (batch, output_len, 1)
        """
        Forward pass through thermal prediction model.
        
        Args:
            encoder_input: Historical sequence of shape (batch_size, input_sequence_length, input_features)
            decoder_init_temp: Initial temperature for autoregressive decoding
            
        Returns:
            Predicted temperatures for future timesteps
        """
        batch_size = encoder_input.size(0)
        device = self.config.device
        
        # Encoder: Process historical sequence
        encoder_output, (hidden_state, cell_state) = self.lstm_encoder(encoder_input)
        
        # Attention: Weight encoder outputs
        attn_output, _ = self.attention(encoder_output, encoder_output, encoder_output)
        
        # Initialize decoder with last historical temperature if not provided
        if decoder_init_temp is None:
            decoder_init_temp = encoder_input[:, -1, 0:1]  # Last junction temp
        
        # Decoder: Autoregressive prediction
        decoder_predictions = []
        decoder_hidden = (hidden_state, cell_state)
        current_temp = decoder_init_temp
        
        # Use attention context as decoder input
        context = attn_output.mean(dim=1, keepdim=True)  # (batch, 1, hidden_size)
        
        for step in range(self.config.output_sequence_length):
            # Concatenate current temperature with context
            decoder_input = torch.cat([context, current_temp.unsqueeze(1)], dim=-1)  # (batch, 1, hidden_size+1)
            
            # Decode one timestep
            decoder_output, decoder_hidden = self.lstm_decoder(decoder_input, decoder_hidden)
            
            # Project to temperature prediction
            pred_temp = self.fc(decoder_output)  # (batch, 1, 1)
            decoder_predictions.append(pred_temp)
            
            # Use prediction as next input
            current_temp = pred_temp.squeeze(1)
        
        # Stack predictions
        predictions = torch.cat(decoder_predictions, dim=1)  # (batch, output_len, 1)
        return predictions
    
    def predict(
        self,
        historical_data: np.ndarray
    ) -> np.ndarray:
        """
        Make predictions on new data.
        
        Args:
            historical_data: Array of shape (batch_size, input_sequence_length, input_features)
            
        Returns:
            Predicted temperatures for next 30 minutes
        """
        self.eval()
        with torch.no_grad():
            x = torch.tensor(historical_data, dtype=torch.float32, device=self.config.device)
            predictions = self.forward(x)
            return predictions.cpu().numpy()


class ThermalEnsemble:
    """Ensemble of multiple thermal models for robust predictions."""
    
    def __init__(self, num_models: int = 3, config: Optional[ThermalPredictionConfig] = None):
        self.config = config or ThermalPredictionConfig()
        self.models = [
            ThermalLSTM(self.config)
            for _ in range(num_models)
        ]
    
    def predict(self, historical_data: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Make ensemble predictions with confidence intervals.
        
        Args:
            historical_data: Historical thermal data
            
        Returns:
            Tuple of (mean_predictions, std_predictions)
        """
        predictions = np.array([
            model.predict(historical_data)
            for model in self.models
        ])
        
        mean_pred = predictions.mean(axis=0)
        std_pred = predictions.std(axis=0)
        
        return mean_pred, std_pred
    
    def save(self, path: str):
        """Save all ensemble models."""
        for i, model in enumerate(self.models):
            torch.save(model.state_dict(), f"{path}/model_{i}.pt")
    
    def load(self, path: str):
        """Load ensemble models."""
        for i, model in enumerate(self.models):
            model.load_state_dict(torch.load(f"{path}/model_{i}.pt"))


class VARModel(nn.Module):
    """
    Vector Autoregressive model for multi-variable thermal relationships.
    Jointly models: junction_temperature, power_dissipation, ambient_temperature
    """
    
    def __init__(self, config: ThermalPredictionConfig, num_variables: int = 3):
        super(VARModel, self).__init__()
        self.config = config
        self.num_variables = num_variables
        
        # Autoregressive layers for each variable
        self.ar_layers = nn.ModuleList([
            nn.Sequential(
                nn.Linear(config.input_sequence_length * num_variables, 512),
                nn.ReLU(),
                nn.Dropout(config.dropout),
                nn.Linear(512, 256),
                nn.ReLU(),
                nn.Dropout(config.dropout),
                nn.Linear(256, config.output_sequence_length)
            )
            for _ in range(num_variables)
        ])
        
        self.to(config.device)
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: (batch_size, sequence_length, num_variables)
        
        Returns:
            (batch_size, output_sequence_length, num_variables)
        """
        batch_size = x.size(0)
        flattened = x.view(batch_size, -1)  # (batch, seq_len * num_vars)
        
        predictions = torch.stack([
            layer(flattened)
            for layer in self.ar_layers
        ], dim=-1)  # (batch, output_len, num_vars)
        
        return predictions
