# LEGO Model Generator (Final Refined Version)

import os
import sys
import numpy as np
from pathlib import Path
import trimesh
from scipy.ndimage import label
from scipy.spatial import distance

# Step 0: Uniform Rescale with Centering
def rescale_obj_uniform(input_path, output_path, target_dims=(32, 32, 30)):
    mesh = trimesh.load(input_path, force='mesh')
    bounds = mesh.bounds
    scale_factors = np.array(target_dims) / (bounds[1] - bounds[0])
    uniform_scale = min(scale_factors)
    mesh.apply_scale(uniform_scale)
    new_bounds = mesh.bounds
    translation = (np.array(target_dims) - (new_bounds[1] - new_bounds[0])) / 2 - new_bounds[0]
    mesh.apply_translation(translation)
    mesh.export(output_path)
    return output_path

# Step 1: Trimesh-based Voxelization
def voxelize_obj_trimesh(path, pitch=1.0):
    mesh = trimesh.load(path, force='mesh')
    voxelized = mesh.voxelized(pitch=pitch)
    return voxelized.matrix.astype(int)

# Step 2: Component Connectivity Enforcement
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

# Step 3: Brick Placement with Gap Filling
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

# Step 4: Bounding Box
def bounding_box(mask):
    coords = np.argwhere(mask)
    if coords.size == 0:
        return None
    min_coords = coords.min(axis=0)
    max_coords = coords.max(axis=0) + 1
    return tuple(slice(min_, max_) for min_, max_ in zip(min_coords, max_coords))

# Step 5: Process Voxel Layers to Bricks
def process_3d_voxel_fully_connected(voxels, max_layers=30):
    voxels = connect_components_minimal(voxels)
    z_layers = voxels.shape[2]
    all_bricks = []
    for z in range(min(z_layers, max_layers)):
        layer = voxels[:, :, z]
        bbox = bounding_box(layer)
        if bbox is None:
            continue
        slice_mask = layer[bbox]
        if np.sum(slice_mask) == 0:
            continue
        brick_plan = optimized_brick_placement_full_integrity(slice_mask)
        all_bricks.append({'z': z, 'bricks': brick_plan, 'offset': bbox})
    return all_bricks

# Step 6: Save Brick Plan (.txt)
def save_brick_plan(brick_layers, output_file):
    with open(output_file, 'w') as f:
        for layer in brick_layers:
            z = layer['z']
            y_offset, x_offset = layer['offset'][0].start, layer['offset'][1].start
            f.write(f"Layer {z}:\n")
            for i, j, bw, bh in layer['bricks']:
                f.write(f"  Brick at (x={j + x_offset}, y={i + y_offset}, z={z}) size=({bw}x{bh})\n")

# Step 7: Save LDraw Model (.ldr) with Proper Alignment
def save_ldr_file_vertical_flip_aligned(brick_layers, output_file):
    part_id_map = {
        (1, 1): '3005.dat', (1, 2): '3004.dat', (2, 1): '3004.dat',
        (2, 2): '3003.dat', (2, 4): '3001.dat', (4, 2): '87079.dat',
        (4, 1): '3010.dat', (1, 4): '3010.dat'
    }
    color_code = 14
    brick_height_ldu = 24
    brick_length_ldu = 20
    with open(output_file, 'w') as f:
        f.write("0 LEGO Model Generated from OBJ\n")
        f.write("0 Name: LEGOFIKS Model\n")
        f.write("0 Author: LEGOFIKS AI\n")
        f.write("0 !LDRAW_ORG Unofficial_Model\n")
        f.write("0 !LICENSE Redistributable under CCAL version 2.0 : see CAreadme.txt\n\n")
        
        for layer in brick_layers:
            z = layer['z']
            y_offset, x_offset = layer['offset'][0].start, layer['offset'][1].start
            for i, j, bw, bh in layer['bricks']:
                part = part_id_map.get((bh, bw), '3001.dat')
                x_pos = (j + x_offset) * brick_length_ldu
                y_pos = -z * brick_height_ldu
                z_pos = (i + y_offset) * brick_length_ldu
                f.write(f"1 {color_code} {x_pos} {y_pos} {z_pos} 1 0 0 0 1 0 0 0 1 {part}\n")

def main():
    if len(sys.argv) < 3:
        print("Usage: python obj_to_ldr.py <obj_file_path> <output_ldr_path> [resolution]")
        sys.exit(1)
    
    obj_file_path = sys.argv[1]
    output_ldr_path = sys.argv[2]
    resolution = int(sys.argv[3]) if len(sys.argv) > 3 else 32
    
    try:
        print(f"Processing OBJ file: {obj_file_path}")
        print(f"Resolution: {resolution}")
        
        # Step 1: Rescale and center the model
        temp_obj_path = obj_file_path + ".rescaled.obj"
        rescale_obj_uniform(obj_file_path, temp_obj_path)
        print(f"Rescaled model to: {temp_obj_path}")
        
        # Step 2: Voxelize the model
        voxels = voxelize_obj_trimesh(temp_obj_path, pitch=1.0)
        print(f"Voxelized model with shape: {voxels.shape}")
        
        # Step 3: Process voxels to bricks
        brick_layers = process_3d_voxel_fully_connected(voxels)
        print(f"Generated {len(brick_layers)} brick layers")
        
        # Step 4: Save as LDR file
        save_ldr_file_vertical_flip_aligned(brick_layers, output_ldr_path)
        print(f"Saved LDR file to: {output_ldr_path}")
        
        # Clean up temporary files
        if os.path.exists(temp_obj_path):
            os.remove(temp_obj_path)
            
        print("Conversion complete!")
        sys.exit(0)
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()