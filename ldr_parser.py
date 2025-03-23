import os
import re
from collections import defaultdict

def get_available_ldr_files(directory):
    """Get a list of available LDR files in the specified directory."""
    if not os.path.exists(directory):
        return []
    
    ldr_files = []
    for filename in os.listdir(directory):
        if filename.lower().endswith(('.ldr', '.mpd', '.dat')):
            ldr_files.append(filename)
    
    return ldr_files

class LdrParser:
    """Parser for LDR files that extracts layer information."""
    
    def __init__(self, file_path):
        self.file_path = file_path
        self.lines = []
        self.max_layer = 0
        self.parts_by_layer = defaultdict(list)
        self.materials = {}
        self.current_color = 0
    
    def parse(self):
        """Parse the LDR file and extract layer information."""
        try:
            with open(self.file_path, 'r', encoding='utf-8') as file:
                self.lines = file.readlines()
            
            for line in self.lines:
                line = line.strip()
                if not line or line.startswith('0 '):  # Skip empty lines and comments
                    continue
                
                if line.startswith('1 '):  # Line type 1 represents parts
                    parts = line.split()
                    if len(parts) >= 14:  # Valid part line has at least 14 elements
                        color = int(parts[1])
                        # Extract position (Y coordinate determines the layer)
                        y_pos = float(parts[5])
                        
                        # Determine layer based on Y position (higher Y = higher layer)
                        layer = int(y_pos / 24)  # Assuming 24 units per layer
                        
                        # Ensure layer is at least 0
                        layer = max(0, layer)
                        
                        # Update max layer
                        self.max_layer = max(self.max_layer, layer)
                        
                        # Store part information by layer
                        self.parts_by_layer[layer].append({
                            'line': line,
                            'color': color,
                            'y_pos': y_pos
                        })
            
            # Add 1 to max_layer to make it 1-indexed
            self.max_layer += 1
            
            return True
        except Exception as e:
            print(f"Error parsing LDR file: {e}")
            return False
    
    def get_layers_data(self):
        """Get all layers data."""
        layers = []
        
        for layer_num in range(self.max_layer):
            layer_parts = self.parts_by_layer.get(layer_num, [])
            layers.append({
                'layer': layer_num,
                'parts_count': len(layer_parts),
                'parts': [part['line'] for part in layer_parts]
            })
        
        return {
            'layers': layers,
            'max_layer': self.max_layer
        }
    
    def get_layers_up_to(self, layer_num):
        """Get layers up to and including the specified layer."""
        if layer_num < 0 or layer_num >= self.max_layer:
            layer_num = self.max_layer - 1
        
        layers = []
        
        for i in range(layer_num + 1):
            layer_parts = self.parts_by_layer.get(i, [])
            layers.append({
                'layer': i,
                'parts_count': len(layer_parts),
                'parts': [part['line'] for part in layer_parts]
            })
        
        return {
            'layers': layers,
            'layer_num': layer_num,
            'max_layer': self.max_layer
        } 