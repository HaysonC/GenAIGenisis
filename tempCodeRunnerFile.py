def save_brick_to_voxels(brick_layers, output_file):
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