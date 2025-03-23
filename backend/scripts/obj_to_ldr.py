# LEGO Model Generator (Final Version with Interior/Exterior Mask for Solid Fill and Color Mapping)

import os
import numpy as np
from pathlib import Path
import trimesh
from scipy.ndimage import label, binary_fill_holes
from scipy.spatial import distance, KDTree
import colorsys


# Step 0: Uniform Rescale with Centering and Vertex Color Extraction
def rescale_obj_uniform(input_path, output_path, target_dims=(64, 64, 30)):
    mesh = trimesh.load(input_path, force='mesh')
    bounds = mesh.bounds
    scale_factors = np.array(target_dims) / (bounds[1] - bounds[0])
    uniform_scale = min(scale_factors)
    mesh.apply_scale(uniform_scale)
    new_bounds = mesh.bounds
    translation = (np.array(target_dims) - (new_bounds[1] - new_bounds[0])) / 2 - new_bounds[0]
    mesh.apply_translation(translation)
    mesh.export(output_path)
    return output_path, mesh  # Return mesh to access vertices and colors later

# Step 1: Trimesh-based Voxelization
def voxelize_obj_trimesh(path, pitch=1.0):
    mesh = trimesh.load(path, force='mesh')
    voxelized = mesh.voxelized(pitch=pitch)
    return voxelized.matrix.astype(int)

# Step 2: Ensure Connectivity (Minimal 1x1 Bridging)
def connect_components_minimal(voxels):
    structure = np.ones((3, 3, 3), dtype=int)
    labeled, num_features = label(voxels, structure=structure)
    if num_features <= 1:
        return voxels

    sizes = [(labeled == i).sum() for i in range(1, num_features + 1)]
    main_label = np.argmax(sizes) + 1
    main_coords = np.argwhere(labeled == main_label)

    for label_id in range(1, num_features + 1):
        if label_id == main_label:
            continue
        other_coords = np.argwhere(labeled == label_id)
        min_dist = float('inf')
        best_pair = (None, None)
        for a in other_coords:
            dists = distance.cdist([a], main_coords)
            idx = np.argmin(dists)
            if dists[0][idx] < min_dist:
                min_dist = dists[0][idx]
                best_pair = (tuple(a), tuple(main_coords[idx]))
        a, b = best_pair
        path = np.linspace(a, b, int(min_dist) + 1).astype(int)
        for pt in path:
            voxels[tuple(pt)] = 1
    return voxels

# Step 3: Create Interior Mask for Solid Structure
def create_interior_mask(voxels):
    mask = np.copy(voxels)
    for z in range(mask.shape[2]):
        mask[:, :, z] = binary_fill_holes(mask[:, :, z])
    return mask

# Step 4: Brick Placement with Gap Filling
def optimized_brick_placement_full_integrity(layer_voxels, available_bricks=None):
    if available_bricks is None:
        available_bricks = [(2, 4), (4, 2), (2, 1), (1, 2), (1, 1)]
    h, w = layer_voxels.shape
    placed = np.zeros_like(layer_voxels)
    brick_plan = []

    def fits(y, x, bh, bw):
        if y + bh > h or x + bw > w:
            return False
        if placed[y:y+bh, x:x+bw].any():
            return False
        if np.all(layer_voxels[y:y+bh, x:x+bw] == 1):
            return True
        return False

    for bh, bw in sorted(available_bricks, key=lambda b: -(b[0]*b[1])):
        for y in range(h):
            for x in range(w):
                if fits(y, x, bh, bw):
                    brick_plan.append((y, x, bw, bh))
                    placed[y:y+bh, x:x+bw] = 1

    remaining = np.logical_and(layer_voxels == 1, placed == 0)
    for y, x in np.argwhere(remaining):
        brick_plan.append((y, x, 1, 1))
        placed[y, x] = 1

    return brick_plan

# Step 5: Bounding Box
def bounding_box(mask):
    coords = np.argwhere(mask)
    if coords.size == 0:
        return None
    min_coords = coords.min(axis=0)
    max_coords = coords.max(axis=0) + 1
    return tuple(slice(min_, max_) for min_, max_ in zip(min_coords, max_coords))

# Step 6: Process Voxel Layers
def process_3d_voxel_fully_connected(voxels, max_layers=30):
    voxels = connect_components_minimal(voxels)
    interior_voxels = create_interior_mask(voxels)
    z_layers = interior_voxels.shape[2]
    all_bricks = []
    for z in range(min(z_layers, max_layers)):
        layer = interior_voxels[:, :, z]
        bbox = bounding_box(layer)
        if bbox is None:
            continue
        slice_mask = layer[bbox]
        if np.sum(slice_mask) == 0:
            continue
        brick_plan = optimized_brick_placement_full_integrity(slice_mask)
        all_bricks.append({'z': z, 'bricks': brick_plan, 'offset': bbox})
    return all_bricks

# Step 7: Save Brick Plan (.txt)
def save_brick_plan(brick_layers, output_file):
    with open(output_file, 'w') as f:
        for layer in brick_layers:
            z = layer['z']
            y_offset, x_offset = layer['offset'][0].start, layer['offset'][1].start
            f.write(f"Layer {z}:\n")
            for i, j, bw, bh, *rest in layer['bricks']:  # *rest to handle optional color_code
                f.write(f"  Brick at (x={j + x_offset}, y={i + y_offset}, z={z}) size=({bw}x{bh})\n")

# Step 8: Save Aligned LDraw (.ldr) with Color Codes
def save_ldr_file_vertical_flip_aligned(brick_layers, output_file):
    part_id_map = {
        (1, 1): '3005.dat', (1, 2): '3004.dat', (2, 1): '3004.dat',
        (2, 2): '3003.dat', (2, 4): '3001.dat', (4, 2): '87079.dat',
        (4, 1): '3010.dat', (1, 4): '3010.dat'
    }
    brick_height_ldu = 24
    brick_length_ldu = 20
    with open(output_file, 'w') as f:
        for layer in brick_layers:
            z = layer['z']
            y_offset, x_offset = layer['offset'][0].start, layer['offset'][1].start
            for brick in layer['bricks']:
                i, j, bw, bh, *rest = brick
                color_code = rest[0] if rest else 14  # Default to 14 (yellow) if no color
                part = part_id_map.get((bh, bw), '3001.dat')
                x_pos = (j + x_offset) * brick_length_ldu
                y_pos = -z * brick_height_ldu
                z_pos = (i + y_offset) * brick_length_ldu
                f.write(f"1 {color_code} {x_pos} {y_pos} {z_pos} 1 0 0 0 1 0 0 0 1 {part}\n")

# Step 9: Save Brick-to-Voxel Mapping (.txt)
# def save_brick_to_voxels(brick_layers, output_file):
#     with open(output_file, 'w') as f:
#         brick_id = 1
#         for layer in brick_layers:
#             z = layer['z']
#             y_offset = layer['offset'][0].start
#             x_offset = layer['offset'][1].start
#             for y_local, x_local, bw, bh, *rest in layer['bricks']:
#                 x_start = x_local + x_offset
#                 y_start = y_local + y_offset
#                 f.write(f"Brick ID: {brick_id}\n")
#                 f.write(f"Position: ({x_start}, {y_start}, {z})\n")
#                 f.write(f"Size: ({bw} x {bh})\n")
#                 f.write("Voxels: ")
#                 voxels_list = [(x_start + j, y_start + i, z) for i in range(bh) for j in range(bw)]
#                 f.write(", ".join([f"({x},{y},{z})" for x, y, z in voxels_list]) + "\n")
#                 f.write("\n")
#                 brick_id += 1


def rgb_to_hsl(rgb):
    """Convert RGB (0-1 range) to HSL (H: 0-1, S: 0-1, L: 0-1)."""
    r, g, b = rgb
    h, l, s = colorsys.rgb_to_hls(r, g, b)  # Note: HLS order in colorsys
    return np.array([h, s, l])  # Return in HSL order for consistency

def get_lego_color_code(vertex_rgb, lego_colors, lego_hsl):
    """
    Find the closest LEGO color code to vertex_rgb using HSL distance,
    prioritizing hue.
    """
    # Convert vertex RGB to HSL
    vertex_hsl = rgb_to_hsl(vertex_rgb)
    
    # Calculate distances with weights: hue (H) is more important
    weights = np.array([2.0, 0.5, 0.5])  # Hue x2, Saturation x0.5, Lightness x0.5
    distances = np.sum(weights * np.abs(lego_hsl - vertex_hsl), axis=1)
    
    # Handle hue wraparound (e.g., 0 and 1 are close)
    hue_diff = np.minimum(np.abs(lego_hsl[:, 0] - vertex_hsl[0]),
                         1.0 - np.abs(lego_hsl[:, 0] - vertex_hsl[0]))
    distances = weights[0] * hue_diff + weights[1] * np.abs(lego_hsl[:, 1] - vertex_hsl[1]) + \
                weights[2] * np.abs(lego_hsl[:, 2] - vertex_hsl[2])
    
    min_idx = np.argmin(distances)
    return lego_colors[min_idx][0]

# Step 10
def assign_colors_to_bricks(brick_layers, mesh):
    # Expanded LEGO color palette (code, RGB in 0-1 range)
    lego_colors = [
        (0, [0.1059, 0.1647, 0.2039]), # Black
        (1, [0.1176, 0.3529, 0.6588]), # Blue
        (2, [0.0000, 0.5216, 0.1686]), # Green
        (3, [0.0235, 0.6157, 0.6235]), # Dark_Turquoise
        (4, [0.7059, 0.0000, 0.0000]), # Red
        (5, [0.8275, 0.2078, 0.6157]), # Dark_Pink
        (6, [0.3294, 0.2000, 0.1412]), # Brown
        (7, [0.5412, 0.5725, 0.5529]), # Light_Grey
        (8, [0.3294, 0.3490, 0.3333]), # Dark_Grey
        (9, [0.5922, 0.7961, 0.8510]), # Light_Blue
        (10, [0.3451, 0.6706, 0.2549]), # Bright_Green
        (11, [0.0000, 0.6667, 0.6431]), # Light_Turquoise
        (12, [0.9412, 0.4275, 0.3804]), # Salmon
        (13, [0.9647, 0.6627, 0.7333]), # Pink
        (14, [0.9804, 0.7843, 0.0392]), # Yellow
        (15, [0.9569, 0.9569, 0.9569]), # White
        (16, [1.0000, 1.0000, 0.5020]), # Main_Colour
        (17, [0.6784, 0.8510, 0.6588]), # Light_Green
        (18, [1.0000, 0.8392, 0.4980]), # Light_Yellow
        (19, [0.8431, 0.7294, 0.5490]), # Tan
        (20, [0.6863, 0.7451, 0.8392]), # Light_Violet
        (22, [0.4039, 0.1216, 0.5059]), # Purple
        (23, [0.0549, 0.2431, 0.6039]), # Dark_Blue_Violet
        (24, [0.4980, 0.4980, 0.4980]), # Edge_Colour
        (25, [0.8392, 0.4745, 0.1373]), # Orange
        (26, [0.5647, 0.1216, 0.4627]), # Magenta
        (27, [0.6471, 0.7922, 0.0941]), # Lime
        (28, [0.5373, 0.4902, 0.3843]), # Dark_Tan
        (29, [1.0000, 0.6196, 0.8039]), # Bright_Pink
        (30, [0.6275, 0.4314, 0.7255]), # Medium_Lavender
        (31, [0.8039, 0.6431, 0.8706]), # Lavender
        (65, [0.9804, 0.7843, 0.0392]), # Rubber_Yellow
        (68, [0.9922, 0.7647, 0.5137]), # Very_Light_Orange
        (69, [0.5412, 0.0706, 0.6588]), # Bright_Reddish_Lilac
        (70, [0.3725, 0.1922, 0.0353]), # Reddish_Brown
        (71, [0.5882, 0.5882, 0.5882]), # Light_Bluish_Grey
        (72, [0.3922, 0.3922, 0.3922]), # Dark_Bluish_Grey
        (73, [0.4510, 0.5882, 0.7843]), # Medium_Blue
        (74, [0.4980, 0.7686, 0.4588]), # Medium_Green
        (75, [0.0000, 0.0000, 0.0000]), # Speckle_Black_Copper
        (76, [0.3882, 0.3725, 0.3804]), # Speckle_Dark_Bluish_Grey_Silver
        (77, [0.9961, 0.8000, 0.8118]), # Light_Pink
        (78, [1.0000, 0.7882, 0.5843]), # Light_Nougat
        (79, [0.9333, 0.9333, 0.9333]), # Milky_White
        (83, [0.0392, 0.0745, 0.1529]), # Pearl_Black
        (84, [0.6667, 0.4902, 0.3333]), # Medium_Nougat
        (85, [0.2667, 0.1020, 0.5686]), # Medium_Lilac
        (86, [0.4824, 0.3647, 0.2549]), # Light_Brown
        (89, [0.1098, 0.3451, 0.6549]), # Blue_Violet
        (92, [0.7333, 0.5020, 0.3529]), # Nougat
        (100, [0.9765, 0.7176, 0.6471]), # Light_Salmon
        (110, [0.1490, 0.2745, 0.6039]), # Violet
        (112, [0.2824, 0.3804, 0.6745]), # Medium_Violet
        (115, [0.7176, 0.8314, 0.1451]), # Medium_Lime
        (118, [0.6118, 0.8392, 0.8000]), # Aqua
        (120, [0.8706, 0.9176, 0.5725]), # Light_Lime
        (125, [0.9765, 0.6549, 0.4667]), # Light_Orange
        (128, [0.6784, 0.3804, 0.2510]), # Dark_Nougat
        (132, [0.0000, 0.0000, 0.0000]), # Speckle_Black_Silver
        (133, [0.0000, 0.0000, 0.0000]), # Speckle_Black_Gold
        (134, [0.4627, 0.3020, 0.2314]), # Copper
        (135, [0.6275, 0.6275, 0.6275]), # Pearl_Light_Grey
        (142, [0.8706, 0.6745, 0.4000]), # Pearl_Light_Gold
        (147, [0.5137, 0.4471, 0.3098]), # Pearl_Dark_Gold
        (148, [0.2824, 0.3020, 0.2824]), # Pearl_Dark_Grey
        (150, [0.5961, 0.6078, 0.6000]), # Pearl_Very_Light_Grey
        (151, [0.7843, 0.7843, 0.7843]), # Very_Light_Bluish_Grey
        (176, [0.5804, 0.3176, 0.2824]), # Pearl_Red
        (178, [0.6706, 0.4039, 0.2275]), # Pearl_Yellow
        (179, [0.5373, 0.5294, 0.5333]), # Pearl_Silver
        (183, [0.9647, 0.9490, 0.8745]), # Pearl_White
        (187, [0.3412, 0.2235, 0.1725]), # Pearl_Brown
        (189, [0.6745, 0.5098, 0.2784]), # Reddish_Gold
        (191, [0.9882, 0.6745, 0.0000]), # Bright_Light_Orange
        (212, [0.6157, 0.7647, 0.9686]), # Bright_Light_Blue
        (216, [0.5294, 0.1686, 0.0902]), # Rust
        (218, [0.5569, 0.3333, 0.5922]), # Reddish_Lilac
        (219, [0.3373, 0.3059, 0.6157]), # Lilac
        (226, [1.0000, 0.9255, 0.4235]), # Bright_Light_Yellow
        (232, [0.4667, 0.7882, 0.8471]), # Sky_Blue
        (256, [0.1059, 0.1647, 0.2039]), # Rubber_Black
        (272, [0.0980, 0.1961, 0.3529]), # Dark_Blue
        (273, [0.1176, 0.3529, 0.6588]), # Rubber_Blue
        (288, [0.0000, 0.2706, 0.1020]), # Dark_Green
        (295, [1.0000, 0.5804, 0.7608]), # Flamingo_Pink
        (297, [0.6667, 0.4980, 0.1804]), # Pearl_Gold
        (308, [0.2078, 0.1294, 0.0000]), # Dark_Brown
        (313, [0.6706, 0.8510, 1.0000]), # Maersk_Blue
        (320, [0.4471, 0.0000, 0.0706]), # Dark_Red
        (321, [0.2745, 0.6078, 0.7647]), # Dark_Azure
        (322, [0.4078, 0.7647, 0.8863]), # Medium_Azure
        (323, [0.8275, 0.9490, 0.9176]), # Light_Aqua
        (324, [0.7059, 0.0000, 0.0000]), # Rubber_Red
        (326, [0.8863, 0.9765, 0.6039]), # Yellowish_Green
        (330, [0.4667, 0.4667, 0.3059]), # Olive_Green
        (335, [0.5333, 0.3765, 0.3686]), # Sand_Red
        (350, [0.8392, 0.4745, 0.1373]), # Rubber_Orange
        (351, [0.9686, 0.5216, 0.6941]), # Medium_Dark_Pink
        (353, [1.0000, 0.4275, 0.4667]), # Coral
        (366, [0.8471, 0.4275, 0.1725]), # Earth_Orange
        (368, [0.9294, 1.0000, 0.1294]), # Neon_Yellow
        (370, [0.4588, 0.3490, 0.2706]), # Medium_Brown
        (371, [0.8000, 0.6392, 0.4510]), # Medium_Tan
        (373, [0.4588, 0.3961, 0.4902]), # Sand_Purple
        (375, [0.5412, 0.5725, 0.5529]), # Rubber_Light_Grey
        (378, [0.4392, 0.5569, 0.4863]), # Sand_Green
        (379, [0.4392, 0.5059, 0.6039]), # Sand_Blue
        (402, [0.7922, 0.2980, 0.0431]), # Reddish_Orange
        (406, [0.0980, 0.1961, 0.3529]), # Rubber_Dark_Blue
        (422, [0.5686, 0.3608, 0.2353]), # Sienna_Brown
        (423, [0.3294, 0.2471, 0.2000]), # Umber_Brown
        (449, [0.4039, 0.1216, 0.5059]), # Rubber_Purple
        (450, [0.8235, 0.4667, 0.2667]), # Fabuland_Brown
        (462, [0.9608, 0.5255, 0.1412]), # Medium_Orange
        (484, [0.5686, 0.3137, 0.1098]), # Dark_Orange
        (490, [0.6471, 0.7922, 0.0941]), # Rubber_Lime
        (493, [0.3961, 0.4039, 0.3804]), # Magnet
        (494, [0.8157, 0.8157, 0.8157]), # Electric_Contact_Alloy
        (495, [0.6824, 0.4784, 0.3490]), # Electric_Contact_Copper
        (496, [0.5882, 0.5882, 0.5882]), # Rubber_Light_Bluish_Grey
        (503, [0.7373, 0.7059, 0.6471]), # Very_Light_Grey
        (504, [0.5373, 0.5294, 0.5333]), # Rubber_Flat_Silver
        (507, [0.9804, 0.6118, 0.1098]), # Light_Orange_Brown
        (508, [0.7765, 0.3176, 0.1529]), # Fabuland_Red
        (509, [0.8118, 0.5412, 0.2784]), # Fabuland_Orange
        (510, [0.4706, 0.9882, 0.4706]), # Fabuland_Lime
        (511, [0.9569, 0.9569, 0.9569]), # Rubber_White
        (10000, [0.9725, 0.9529, 0.8941]), # Fabric_Cream
        (10002, [0.0000, 0.5216, 0.1686]), # Rubber_Green
        (10010, [0.3451, 0.6706, 0.2549]), # Rubber_Bright_Green
        (10019, [0.8431, 0.7294, 0.5490]), # Rubber_Tan
        (10026, [0.5647, 0.1216, 0.4627]), # Rubber_Magenta
        (10029, [1.0000, 0.6196, 0.8039]), # Rubber_Bright_Pink
        (10030, [0.6275, 0.4314, 0.7255]), # Rubber_Medium_Lavender
        (10031, [0.8039, 0.6431, 0.8706]), # Rubber_Lavender
        (10070, [0.3725, 0.1922, 0.0353]), # Rubber_Reddish_Brown
        (10072, [0.3922, 0.3922, 0.3922]), # Rubber_Dark_Bluish_Grey
        (10073, [0.4510, 0.5882, 0.7843]), # Rubber_Medium_Blue
        (10078, [1.0000, 0.7882, 0.5843]), # Rubber_Light_Nougat
        (10226, [1.0000, 0.9255, 0.4235]), # Rubber_Bright_Light_Yellow
        (10308, [0.2078, 0.1294, 0.0000]), # Rubber_Dark_Brown
        (10320, [0.4471, 0.0000, 0.0706]), # Rubber_Dark_Red
        (10321, [0.2745, 0.6078, 0.7647]), # Rubber_Dark_Azure
        (10322, [0.4078, 0.7647, 0.8863]), # Rubber_Medium_Azure
        (10323, [0.8275, 0.9490, 0.9176]), # Rubber_Light_Aqua
        (10378, [0.4392, 0.5569, 0.4863]), # Rubber_Sand_Green
        (10484, [0.5686, 0.3137, 0.1098]) # Rubber_Dark_Orange
    ]
    lego_rgbs = np.array([rgb for code, rgb in lego_colors])
    # Precompute HSL for LEGO colors
    lego_hsl = np.array([rgb_to_hsl(rgb) for code, rgb in lego_colors])

    # Build KD-tree from mesh vertices
    vertices = mesh.vertices
    tree = KDTree(vertices)
    vertex_colors = mesh.visual.vertex_colors[:, :3]  # Assuming 0-1 floats

    if vertex_colors.dtype == np.uint8:
        vertex_colors = vertex_colors / 255.0

    # Assign colors to each brick
    for layer in brick_layers:
        z = layer['z']
        y_offset = layer['offset'][0].start
        x_offset = layer['offset'][1].start
        new_bricks = []
        for y_local, x_local, bw, bh in layer['bricks']:
            x_center = x_local + x_offset + (bw - 1) / 2.0
            y_center = y_local + y_offset + (bh - 1) / 2.0
            z_center = z + 0.5
            center = np.array([x_center, y_center, z_center])
            _, vertex_idx = tree.query(center)
            vertex_rgb = vertex_colors[vertex_idx]
            color_code = get_lego_color_code(vertex_rgb, lego_colors, lego_hsl)
            new_bricks.append((y_local, x_local, bw, bh, color_code))
        layer['bricks'] = new_bricks

    return brick_layers

# Example Usage
if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python obj_to_ldr.py <obj_file_path> <output_ldr_path> [resolution]")
        sys.exit(1)
    
    obj_file_path = sys.argv[1]
    output_ldr_path = sys.argv[2]
    resolution = 64
    if len(sys.argv) > 3:
        resolution = int(sys.argv[3])
    
    try:
        print(f"Processing OBJ file: {obj_file_path}")
        print(f"Output LDR path: {output_ldr_path}")
        print(f"Resolution: {resolution}")
        
        # Step 1: Rescale and center the model (with temp file for intermediate steps)
        temp_obj_path = obj_file_path + ".rescaled.obj"
        scaled_path, mesh = rescale_obj_uniform(obj_file_path, temp_obj_path, target_dims=(resolution, resolution, resolution//2))
        print("Mesh rescaled and centered")
        
        # Step 2: Voxelize the model
        voxels = voxelize_obj_trimesh(scaled_path, pitch=1.0)
        print(f"Voxelized model with shape: {voxels.shape}")
        
        # Step 3: Process voxels to bricks
        plan = process_3d_voxel_fully_connected(voxels)
        print(f"Generated {len(plan)} brick layers")
        
        # Step 4: Assign colors to bricks
        plan_with_colors = assign_colors_to_bricks(plan, mesh)
        print("Assigned colors to bricks")
        
        # Step 5: Save as LDR file
        save_ldr_file_vertical_flip_aligned(plan_with_colors, output_ldr_path)
        print(f"Saved LDR file to: {output_ldr_path}")
        
        # Clean up temporary files
        if os.path.exists(temp_obj_path):
            os.remove(temp_obj_path)
            print("Cleaned up temporary files")
        
        print("Conversion complete!")
        sys.exit(0)
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)