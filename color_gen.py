import re

def hex_to_rgb_normalized(hex_color):
    """Convert hex color (e.g., '#1B2A34') to RGB floats in 0-1 range."""
    hex_color = hex_color.lstrip('#')  # Remove '#'
    r = int(hex_color[0:2], 16) / 255.0
    g = int(hex_color[2:4], 16) / 255.0
    b = int(hex_color[4:6], 16) / 255.0
    return [r, g, b]

def parse_ldraw_colors(input_file, output_file):
    # Regular expressions to match CODE and VALUE
    code_pattern = re.compile(r'CODE (\d+)')
    value_pattern = re.compile(r'VALUE,#([0-9A-Fa-f]{6})')
    name_pattern = re.compile(r'0 !COLOUR,([^,]+)')  # Capture name after '0 !COLOUR,'

    colors = []
    with open(input_file, 'r') as f:
        for line in f:
            if not line.startswith('0 !COLOUR'):
                continue
            
            # Extract name, code, and value
            name_match = name_pattern.search(line)
            code_match = code_pattern.search(line)
            value_match = value_pattern.search(line)
            
            if name_match and code_match and value_match:
                name = name_match.group(1)
                code = int(code_match.group(1))
                hex_value = value_match.group(1)
                rgb = hex_to_rgb_normalized('#' + hex_value)
                colors.append((code, rgb, name))
    
    # Sort by code for consistency
    colors.sort(key=lambda x: x[0])
    
    # Write to output file
    with open(output_file, 'w') as f:
        for code, rgb, name in colors:
            rgb_str = f"[{rgb[0]:.4f}, {rgb[1]:.4f}, {rgb[2]:.4f}]"
            f.write(f"({code}, {rgb_str}), # {name}\n")

# Example usage
if __name__ == "__main__":
    input_file = "legocolors.csv"  # Replace with your input file path
    output_file = "lego_colors_output.txt"
    parse_ldraw_colors(input_file, output_file)
    print(f"Converted colors saved to {output_file}")