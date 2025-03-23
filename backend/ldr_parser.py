#!/usr/bin/env python3

import sys
import os
import json
from collections import defaultdict

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
                        
                        # Extract part filename
                        part_name = parts[14]
                        
                        # Extract position
                        x_pos = float(parts[2])
                        z_pos = float(parts[6])
                        
                        # Extract rotation matrix
                        matrix = [
                            float(parts[5]), float(parts[6]), float(parts[7]),
                            float(parts[8]), float(parts[9]), float(parts[10]),
                            float(parts[11]), float(parts[12]), float(parts[13])
                        ]
                        
                        # Determine layer based on Y position (higher Y = higher layer)
                        layer = int(y_pos / 24)  # Assuming 24 LDU units per layer
                        
                        # Ensure layer is at least 0
                        layer = max(0, layer)
                        
                        # Update max layer
                        self.max_layer = max(self.max_layer, layer)
                        
                        # Determine brick dimensions based on part name (simplified)
                        dimensions = self.get_brick_dimensions(part_name)
                        
                        # Store part information by layer
                        self.parts_by_layer[layer].append({
                            'line': line,
                            'color': color,
                            'position': {'x': x_pos, 'y': y_pos, 'z': z_pos},
                            'matrix': matrix,
                            'partName': part_name,
                            'dimensions': dimensions
                        })
            
            # Add 1 to max_layer to make it 1-indexed
            self.max_layer += 1
            
            return True
        except Exception as e:
            print(f"Error parsing LDR file: {e}", file=sys.stderr)
            return False
    
    def get_brick_dimensions(self, part_name):
        """
        Get brick dimensions based on part name.
        This is a simplified method that uses common brick naming patterns.
        In a full implementation, this would use a database of brick definitions.
        """
        # Default dimensions
        dimensions = {'width': 1, 'height': 0.5, 'depth': 1}
        
        # Extract brick size from common naming patterns
        if '3001.dat' in part_name:  # 2x4 brick
            dimensions = {'width': 2, 'height': 1, 'depth': 4}
        elif '3003.dat' in part_name:  # 2x2 brick
            dimensions = {'width': 2, 'height': 1, 'depth': 2}
        elif '3004.dat' in part_name:  # 1x2 brick
            dimensions = {'width': 1, 'height': 1, 'depth': 2}
        elif '3005.dat' in part_name:  # 1x1 brick
            dimensions = {'width': 1, 'height': 1, 'depth': 1}
        elif '3010.dat' in part_name:  # 1x4 brick
            dimensions = {'width': 1, 'height': 1, 'depth': 4}
        elif '3020.dat' in part_name:  # 2x4 plate
            dimensions = {'width': 2, 'height': 0.33, 'depth': 4}
        elif '3022.dat' in part_name:  # 2x2 plate
            dimensions = {'width': 2, 'height': 0.33, 'depth': 2}
        elif '3023.dat' in part_name:  # 1x2 plate
            dimensions = {'width': 1, 'height': 0.33, 'depth': 2}
        elif '3024.dat' in part_name:  # 1x1 plate
            dimensions = {'width': 1, 'height': 0.33, 'depth': 1}
        
        return dimensions
    
    def get_layers_data(self):
        """Get all layers data."""
        layers = []
        
        for layer_num in range(self.max_layer):
            layer_parts = self.parts_by_layer.get(layer_num, [])
            
            # Count brick types
            brick_counts = defaultdict(int)
            for part in layer_parts:
                brick_counts[part['partName']] += 1
            
            layers.append({
                'layer': layer_num,
                'parts': layer_parts,
                'partsCount': len(layer_parts),
                'brickCounts': dict(brick_counts)
            })
        
        return {
            'layers': layers,
            'maxLayer': self.max_layer
        }
    
    def get_layers_up_to(self, layer_num):
        """Get layers up to and including the specified layer."""
        if layer_num < 0 or layer_num >= self.max_layer:
            layer_num = self.max_layer - 1
        
        layers = []
        
        for i in range(layer_num + 1):
            layer_parts = self.parts_by_layer.get(i, [])
            
            # Count brick types
            brick_counts = defaultdict(int)
            for part in layer_parts:
                brick_counts[part['partName']] += 1
            
            layers.append({
                'layer': i,
                'parts': layer_parts,
                'partsCount': len(layer_parts),
                'brickCounts': dict(brick_counts)
            })
        
        return {
            'layers': layers,
            'layer_num': layer_num,
            'max_layer': self.max_layer
        }

def main():
    """Main function to run the parser from command line."""
    if len(sys.argv) < 2:
        print("Usage: python ldr_parser.py <ldr_file_path>", file=sys.stderr)
        sys.exit(1)
    
    ldr_file_path = sys.argv[1]
    
    if not os.path.exists(ldr_file_path):
        print(f"File not found: {ldr_file_path}", file=sys.stderr)
        sys.exit(1)
    
    parser = LdrParser(ldr_file_path)
    if parser.parse():
        # Output JSON to stdout for the Node.js server to read
        json_output = json.dumps(parser.get_layers_data())
        print(json_output)
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main() 