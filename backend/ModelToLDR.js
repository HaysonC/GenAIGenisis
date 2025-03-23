require("dotenv").config()
const fs = require("fs")
const path = require("path")
const { execSync, spawn } = require("child_process")
const util = require("util")
const exec = util.promisify(require("child_process").exec)
const os = require("os")

class ModelToLDR {
  constructor() {
    this.outputDir = path.join(__dirname, "ldr_output")
    this.tempDir = path.join(os.tmpdir(), "model_to_ldr_temp")
    this.binvoxPath = process.env.BINVOX_PATH || "binvox" // Path to binvox executable
    this.pythonPath = process.env.PYTHON_PATH || "python" // Path to Python executable

    // Create necessary directories
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true })
    }

    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true })
    }

    // Create scripts directory and write Python scripts
    this.scriptsDir = path.join(__dirname, "scripts")
    if (!fs.existsSync(this.scriptsDir)) {
      fs.mkdirSync(this.scriptsDir, { recursive: true })
    }

    // Write the binvox_rw.py script
    this.binvoxRwPath = path.join(this.scriptsDir, "binvox_rw.py")
    if (!fs.existsSync(this.binvoxRwPath)) {
      fs.writeFileSync(this.binvoxRwPath, this.getBinvoxRwScript())
    }

    // Write the obj_to_ldr.py script
    this.objToLdrPath = path.join(this.scriptsDir, "obj_to_ldr.py")
    if (!fs.existsSync(this.objToLdrPath)) {
      fs.writeFileSync(this.objToLdrPath, this.getObjToLdrScript())
    }

    console.log(`ModelToLDR initialized with output directory: ${this.outputDir}`)
  }

  /**
   * Convert a 3D model (OBJ/GLB) to LDR format
   * @param {string} modelPath - Path to the 3D model file
   * @param {Object} options - Conversion options
   * @param {number} options.resolution - Voxel resolution (default: 80)
   * @returns {Promise<Object>} - Object containing the path to the LDR file and other metadata
   */
  async convertToLDR(modelPath, options = {}) {
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model file not found: ${modelPath}`)
    }

    console.log(`Converting model to LDR: ${modelPath}`)

    // Get the file extension
    const fileExt = path.extname(modelPath).toLowerCase()
    console.log(`File extension: ${fileExt}`)

    // Check if the file is an OBJ, STL, or GLB
    if (fileExt === ".obj") {
      return await this.convertOBJToLDR(modelPath, options)
    } else if (fileExt === ".stl") {
      console.log("STL file detected. Attempting to convert to OBJ first...")
      // Create a temporary OBJ file path
      const objPath = modelPath.replace(/\.stl$/i, ".obj")

      // Log the conversion attempt
      console.log(`Converting STL to OBJ: ${modelPath} -> ${objPath}`)

      try {
        // Use trimesh to convert STL to OBJ
        const stlToObjScript = `
import trimesh
mesh = trimesh.load('${modelPath.replace(/\\/g, "\\\\")}')
mesh.export('${objPath.replace(/\\/g, "\\\\")}')
print('Conversion successful')
        `
        const tempScriptPath = path.join(this.tempDir, "stl_to_obj.py")
        fs.writeFileSync(tempScriptPath, stlToObjScript)

        const { stdout, stderr } = await exec(`${this.pythonPath} ${tempScriptPath}`)
        console.log("STL to OBJ conversion output:", stdout)

        if (fs.existsSync(objPath)) {
          console.log("STL to OBJ conversion successful")
          return await this.convertOBJToLDR(objPath, options)
        } else {
          throw new Error("STL to OBJ conversion failed: Output file not created")
        }
      } catch (error) {
        console.error("STL to OBJ conversion error:", error)
        throw new Error(`Failed to convert STL to OBJ: ${error.message}`)
      }
    } else if (fileExt === ".glb") {
      throw new Error("GLB to LDR conversion is not implemented yet. This is a placeholder for future functionality.")
    } else {
      throw new Error(`Unsupported file format: ${fileExt}. Only OBJ and STL files are supported.`)
    }
  }

  /**
   * Convert an OBJ file to LDR format
   * @param {string} objPath - Path to the OBJ file
   * @param {Object} options - Conversion options
   * @param {number} options.resolution - Voxel resolution (default: 80)
   * @returns {Promise<Object>} - Object containing the path to the LDR file and other metadata
   */
  async convertOBJToLDR(objPath, options = {}) {
    if (!fs.existsSync(objPath)) {
      throw new Error(`OBJ file not found: ${objPath}`)
    }

    console.log(`Converting OBJ to LDR: ${objPath}`)

    const resolution = options.resolution || 32
    const modelId = Date.now().toString()
    const outputLdrPath = path.join(this.outputDir, `${modelId}.ldr`)

    try {
      // Check if required Python packages are installed
      try {
        await exec(`${this.pythonPath} -c "import numpy, trimesh, scipy"`)
        console.log("Required Python packages are available")
      } catch (error) {
        console.warn("Some required Python packages may be missing. Attempting to install...")
        try {
          await exec(`${this.pythonPath} -m pip install numpy trimesh scipy`)
          console.log("Successfully installed required Python packages")
        } catch (pipError) {
          console.error("Failed to install required packages:", pipError)
          throw new Error(
            "Failed to install required Python packages. Please install numpy, trimesh, and scipy manually.",
          )
        }
      }

      // Create a simplified direct Python script for OBJ to LDR conversion
      const directConversionScript = `
import os
import sys
import numpy as np
from pathlib import Path
import trimesh
from scipy.ndimage import label
from scipy.spatial import distance

def rescale_obj_uniform(input_path, output_path, target_dims=(32, 32, 30)):
    mesh = trimesh.load(input_path, force='mesh')
    bounds = mesh.bounds
    scale_factors = np.array(target_dims) / (bounds[1] - bounds[0])
    uniform_scale = min(scale_factors)
    mesh.apply_scale(uniform_scale)
    new_bounds = mesh.bounds
    translation = (np.array(target_dims) - (new_bounds[1] - new_bounds[0])) / 2 - new_bounds[0]
    mesh.apply_translation(translation)
    return mesh

def voxelize_mesh(mesh, pitch=1.0):
    voxelized = mesh.voxelized(pitch=pitch)
    return voxelized.matrix.astype(int)

def generate_ldr_file(voxels, output_file):
    with open(output_file, "w") as f:
        f.write("0 LEGO Model Generated from OBJ\\n")
        f.write("0 Name: LEGOFIKS Model\\n")
        f.write("0 Author: LEGOFIKS AI\\n")
        f.write("0 !LDRAW_ORG Unofficial_Model\\n")
        f.write("0 !LICENSE Redistributable under CCAL version 2.0 : see CAreadme.txt\\n\\n")
        
        # Simple voxel to brick conversion
        for z in range(voxels.shape[2]):
            for y in range(voxels.shape[1]):
                for x in range(voxels.shape[0]):
                    if voxels[x, y, z]:
                        # Place a 1x1 brick at each voxel position
                        # Color code 14 is yellow
                        x_pos = x * 20
                        y_pos = -z * 24
                        z_pos = y * 20
                        f.write(f"1 14 {x_pos} {y_pos} {z_pos} 1 0 0 0 1 0 0 0 1 3005.dat\\n")

try:
    obj_path = '${objPath.replace(/\\/g, "\\\\")}'
    output_ldr_path = '${outputLdrPath.replace(/\\/g, "\\\\")}'
    resolution = ${resolution}
    
    print(f"Processing OBJ file: {obj_path}")
    print(f"Output LDR path: {output_ldr_path}")
    print(f"Resolution: {resolution}")
    
    # Rescale and center the mesh
    mesh = rescale_obj_uniform(obj_path, None)
    print("Mesh rescaled and centered")
    
    # Voxelize the mesh
    voxels = voxelize_mesh(mesh)
    print(f"Mesh voxelized with shape: {voxels.shape}")
    
    # Generate LDR file
    generate_ldr_file(voxels, output_ldr_path)
    print(f"LDR file generated: {output_ldr_path}")
    
    print("Conversion complete!")
except Exception as e:
    print(f"Error: {str(e)}")
    sys.exit(1)
      `

      const tempScriptPath = path.join(this.tempDir, `obj_to_ldr_${modelId}.py`)
      fs.writeFileSync(tempScriptPath, directConversionScript)
      console.log(`Created temporary conversion script: ${tempScriptPath}`)

      // Run the direct conversion script
      console.log(`Running direct OBJ to LDR conversion with resolution: ${resolution}`)
      const { stdout, stderr } = await exec(`${this.pythonPath} ${tempScriptPath}`)
      console.log("Python script output:", stdout)
      if (stderr) {
        console.error("Python script error:", stderr)
      }

      // Check if the LDR file was created
      if (!fs.existsSync(outputLdrPath)) {
        console.error("LDR file was not created. Generating placeholder instead.")
        throw new Error("LDR file was not created")
      }

      const fileSize = fs.statSync(outputLdrPath).size
      console.log(`LDR file created: ${outputLdrPath} (${fileSize} bytes)`)

      // Clean up temporary script
      try {
        fs.unlinkSync(tempScriptPath)
      } catch (cleanupError) {
        console.warn("Failed to clean up temporary script:", cleanupError)
      }

      return {
        ldrFilePath: outputLdrPath,
        url: `/ldr_output/${path.basename(outputLdrPath)}`,
        modelId,
        fileSize,
      }
    } catch (error) {
      console.error("Error converting OBJ to LDR:", error)

      // If conversion fails, generate a placeholder LDR file
      console.log("Generating placeholder LDR file instead")
      const placeholderContent = this.generatePlaceholderLDR(modelId)
      fs.writeFileSync(outputLdrPath, placeholderContent)

      const fileSize = fs.statSync(outputLdrPath).size

      return {
        ldrFilePath: outputLdrPath,
        url: `/ldr_output/${path.basename(outputLdrPath)}`,
        modelId,
        fileSize,
        isPlaceholder: true,
        conversionError: error.message,
      }
    }
  }

  /**
   * Generate a placeholder LDR file with a simple brick
   * @param {string} modelId - Unique ID for the model
   * @returns {string} - LDR file content
   */
  generatePlaceholderLDR(modelId) {
    // This is a very simple LDR file with a 2x4 brick
    // In a real implementation, you would generate this based on the actual 3D model
    return `0 Converted Model ${modelId}
0 Name: model_${modelId}.ldr
0 Author: LEGOFIKS AI Model Converter
0 !LDRAW_ORG Unofficial_Model
0 !LICENSE Redistributable under CCAL version 2.0 : see CAreadme.txt

0 !HISTORY ${new Date().toISOString()} [AI] Generated from 3D model

1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
1 14 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat
1 14 0 -48 0 1 0 0 0 1 0 0 0 1 3003.dat
1 4 0 -72 0 1 0 0 0 1 0 0 0 1 3003.dat
1 14 0 -96 0 1 0 0 0 1 0 0 0 1 3002.dat
1 4 0 -120 0 1 0 0 0 1 0 0 0 1 3002.dat
1 14 0 -144 0 1 0 0 0 1 0 0 0 1 3004.dat
1 4 0 -168 0 1 0 0 0 1 0 0 0 1 3004.dat
`
  }

  /**
   * Optimize an LDR file by simplifying the model and reducing part count
   * @param {string} ldrPath - Path to the LDR file
   * @returns {Promise<Object>} - Object containing the path to the optimized LDR file and other metadata
   */
  async optimizeLDR(ldrPath) {
    if (!fs.existsSync(ldrPath)) {
      throw new Error(`LDR file not found: ${ldrPath}`)
    }

    console.log(`Optimizing LDR file: ${ldrPath}`)

    // Create a new file path for the optimized LDR
    const optimizedLdrPath = ldrPath.replace(/\.ldr$/i, "_optimized.ldr")

    try {
      // Read the original LDR file
      const ldrContent = fs.readFileSync(ldrPath, "utf8")
      const lines = ldrContent.split("\n")

      // Simple optimization: remove duplicate bricks at the same position
      const uniqueBricks = new Map()
      const headerLines = []
      const brickLines = []

      lines.forEach((line) => {
        if (line.startsWith("1 ")) {
          // This is a brick line
          const parts = line.split(" ")
          // Use position and part type as a unique key
          const key = `${parts[2]}_${parts[3]}_${parts[4]}_${parts[14]}`
          uniqueBricks.set(key, line)
        } else {
          // This is a header or comment line
          headerLines.push(line)
        }
      })

      // Combine header and unique bricks
      const optimizedContent = [...headerLines, ...Array.from(uniqueBricks.values())].join("\n")

      // Write the optimized file
      fs.writeFileSync(optimizedLdrPath, optimizedContent)

      const fileSize = fs.statSync(optimizedLdrPath).size
      console.log(`Optimized LDR file created: ${optimizedLdrPath} (${fileSize} bytes)`)

      return {
        ldrFilePath: optimizedLdrPath,
        url: `/ldr_output/${path.basename(optimizedLdrPath)}`,
        fileSize,
        originalSize: fs.statSync(ldrPath).size,
        reductionPercent: (((fs.statSync(ldrPath).size - fileSize) / fs.statSync(ldrPath).size) * 100).toFixed(2),
      }
    } catch (error) {
      console.error("Error optimizing LDR file:", error)
      throw new Error(`Failed to optimize LDR file: ${error.message}`)
    }
  }

  /**
   * Get the binvox_rw.py script content
   * @returns {string} - The script content
   */
  getBinvoxRwScript() {
    return `#  Copyright (C) 2012 Daniel Maturana
#  This file is part of binvox-rw-py.
#
#  binvox-rw-py is free software: you can redistribute it and/or modify
#  it under the terms of the GNU General Public License as published by
#  the Free Software Foundation, either version 3 of the License, or
#  (at your option) any later version.
#
#  binvox-rw-py is distributed in the hope that it will be useful,
#  but WITHOUT ANY WARRANTY; without even the implied warranty of
#  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#  GNU General Public License for more details.
#
#  You should have received a copy of the GNU General Public License
#  along with binvox-rw-py. If not, see <http://www.gnu.org/licenses/>.
#

"""
Binvox to Numpy and back.


>>> import numpy as np
>>> import binvox_rw
>>> with open('chair.binvox', 'rb') as f:
...     m1 = binvox_rw.read_as_3d_array(f)
...
>>> m1.dims
[32, 32, 32]
>>> m1.scale
41.133000000000003
>>> m1.translate
[0.0, 0.0, 0.0]
>>> with open('chair_out.binvox', 'wb') as f:
...     m1.write(f)
...
>>> with open('chair_out.binvox', 'rb') as f:
...     m2 = binvox_rw.read_as_3d_array(f)
...
>>> m1.dims==m2.dims
True
>>> m1.scale==m2.scale
True
>>> m1.translate==m2.translate
True
>>> np.all(m1.data==m2.data)
True

>>> with open('chair.binvox', 'rb') as f:
...     md = binvox_rw.read_as_3d_array(f)
...
>>> with open('chair.binvox', 'rb') as f:
...     ms = binvox_rw.read_as_coord_array(f)
...
>>> data_ds = binvox_rw.dense_to_sparse(md.data)
>>> data_sd = binvox_rw.sparse_to_dense(ms.data, 32)
>>> np.all(data_sd==md.data)
True
>>> # the ordering of elements returned by numpy.nonzero changes with axis
>>> # ordering, so to compare for equality we first lexically sort the voxels.
>>> np.all(ms.data[:, np.lexsort(ms.data)] == data_ds[:, np.lexsort(data_ds)])
True
"""

import numpy as np

class Voxels(object):
    """ Holds a binvox model.
    data is either a three-dimensional numpy boolean array (dense representation)
    or a two-dimensional numpy float array (coordinate representation).

    dims, translate and scale are the model metadata.

    dims are the voxel dimensions, e.g. [32, 32, 32] for a 32x32x32 model.

    scale and translate relate the voxels to the original model coordinates.

    To translate voxel coordinates i, j, k to original coordinates x, y, z:

    x_n = (i+.5)/dims[0]
    y_n = (j+.5)/dims[1]
    z_n = (k+.5)/dims[2]
    x = scale*x_n + translate[0]
    y = scale*y_n + translate[1]
    z = scale*z_n + translate[2]

    """

    def __init__(self, data, dims, translate, scale, axis_order):
        self.data = data
        self.dims = dims
        self.translate = translate
        self.scale = scale
        assert (axis_order in ('xzy', 'xyz'))
        self.axis_order = axis_order

    def clone(self):
        data = self.data.copy()
        dims = self.dims[:]
        translate = self.translate[:]
        return Voxels(data, dims, translate, self.scale, self.axis_order)

    def write(self, fp):
        write(self, fp)

def read_header(fp):
    """ Read binvox header. Mostly meant for internal use.
    """
    line = fp.readline().strip()
    if not line.startswith(b'#binvox'):
        raise IOError('Not a binvox file')
    dims = list(map(int, fp.readline().strip().split(b' ')[1:]))
    translate = list(map(float, fp.readline().strip().split(b' ')[1:]))
    scale = list(map(float, fp.readline().strip().split(b' ')[1:]))[0]
    line = fp.readline()
    return dims, translate, scale

def read_as_3d_array(fp, fix_coords=True):
    """ Read binary binvox format as array.

    Returns the model with accompanying metadata.

    Voxels are stored in a three-dimensional numpy array, which is simple and
    direct, but may use a lot of memory for large models. (Storage requirements
    are 8*(d^3) bytes, where d is the dimensions of the binvox model. Numpy
    boolean arrays use a byte per element).

    Doesn't do any checks on input except for the '#binvox' line.
    """
    dims, translate, scale = read_header(fp)
    raw_data = np.frombuffer(fp.read(), dtype=np.uint8)
    # if just using reshape() on the raw data:
    # indexing the array as array[i,j,k], the indices map into the
    # coords as:
    # i -> x
    # j -> z
    # k -> y
    # if fix_coords is true, then data is rearranged so that
    # mapping is
    # i -> x
    # j -> y
    # k -> z
    values, counts = raw_data[::2], raw_data[1::2]
    data = np.repeat(values, counts).astype(np.bool)
    data = data.reshape(dims)
    if fix_coords:
        # xzy to xyz TODO the right thing
        data = np.transpose(data, (0, 2, 1))
        axis_order = 'xyz'
    else:
        axis_order = 'xzy'
    return Voxels(data, dims, translate, scale, axis_order)

def read_as_coord_array(fp, fix_coords=True):
    """ Read binary binvox format as coordinates.

    Returns binvox model with voxels in a "coordinate" representation, i.e.  an
    3 x N array where N is the number of nonzero voxels. Each column
    corresponds to a nonzero voxel and the 3 rows are the (x, z, y) coordinates
    of the voxel.  (The odd ordering is due to the way binvox format lays out
    data).  Note that coordinates refer to the binvox voxels, without any
    scaling or translation.

    Use this to save memory if your model is very sparse (mostly empty).

    Doesn't do any checks on input except for the '#binvox' line.
    """
    dims, translate, scale = read_header(fp)
    raw_data = np.frombuffer(fp.read(), dtype=np.uint8)

    values, counts = raw_data[::2], raw_data[1::2]

    sz = np.prod(dims)
    index, end_index = 0, 0
    end_indices = np.cumsum(counts)
    indices = np.concatenate(([0], end_indices[:-1])).astype(end_indices.dtype)

    values = values.astype(np.bool)
    indices = indices[values]
    end_indices = end_indices[values]

    nz_voxels = []
    for index, end_index in zip(indices, end_indices):
        nz_voxels.extend(range(index, end_index))
    nz_voxels = np.array(nz_voxels)
    # TODO are these dims correct?
    # according to docs,
    # index = x * wxh + z * width + y; // wxh = width * height = d * d

    x = nz_voxels / (dims[0]*dims[1])
    zwpy = nz_voxels % (dims[0]*dims[1]) # z*w + y
    z = zwpy / dims[0]
    y = zwpy % dims[0]
    if fix_coords:
        data = np.vstack((x, y, z))
        axis_order = 'xyz'
    else:
        data = np.vstack((x, z, y))
        axis_order = 'xzy'

    #return Voxels(data, dims, translate, scale, axis_order)
    return Voxels(np.ascontiguousarray(data), dims, translate, scale, axis_order)

def dense_to_sparse(voxel_data, dtype=int):
    """ From dense representation to sparse (coordinate) representation.
    No coordinate reordering.
    """
    if voxel_data.ndim!=3:
        raise ValueError('voxel_data is wrong shape; should be 3D array.')
    return np.asarray(np.nonzero(voxel_data), dtype)

def sparse_to_dense(voxel_data, dims, dtype=bool):
    if voxel_data.ndim!=2 or voxel_data.shape[0]!=3:
        raise ValueError('voxel_data is wrong shape; should be 3xN array.')
    if np.isscalar(dims):
        dims = [dims]*3
    dims = np.atleast_2d(dims).T
    # truncate to integers
    xyz = voxel_data.astype(np.int)
    # discard voxels that fall outside dims
    valid_ix = ~np.any((xyz < 0) | (xyz >= dims), 0)
    xyz = xyz[:,valid_ix]
    out = np.zeros(dims.flatten(), dtype=dtype)
    out[tuple(xyz)] = True
    return out

#def get_linear_index(x, y, z, dims):
    #""" Assuming xzy order. (y increasing fastest.
    #TODO ensure this is right when dims are not all same
    #"""
    #return x*(dims[1]*dims[2]) + z*dims[1] + y

def write(voxel_model, fp):
    """ Write binary binvox format.

    Note that when saving a model in sparse (coordinate) format, it is first
    converted to dense format.

    Doesn't check if the model is 'sane'.

    """
    if voxel_model.data.ndim==2:
        # TODO avoid conversion to dense
        dense_voxel_data = sparse_to_dense(voxel_model.data, voxel_model.dims)
    else:
        dense_voxel_data = voxel_model.data

    fp.write('#binvox 1\\n')
    fp.write('dim '+' '.join(map(str, voxel_model.dims))+'\\n')
    fp.write('translate '+' '.join(map(str, voxel_model.translate))+'\\n')
    fp.write('scale '+str(voxel_model.scale)+'\\n')
    fp.write('data\\n')
    if not voxel_model.axis_order in ('xzy', 'xyz'):
        raise ValueError('Unsupported voxel model axis order')

    if voxel_model.axis_order=='xzy':
        voxels_flat = dense_voxel_data.flatten()
    elif voxel_model.axis_order=='xyz':
        voxels_flat = np.transpose(dense_voxel_data, (0, 2, 1)).flatten()

    # keep a sort of state machine for writing run length encoding
    state = voxels_flat[0]
    ctr = 0
    for c in voxels_flat:
        if c==state:
            ctr += 1
            # if ctr hits max, dump
            if ctr==255:
                fp.write(chr(state))
                fp.write(chr(ctr))
                ctr = 0
        else:
            # if switch state, dump
            fp.write(chr(state))
            fp.write(chr(ctr))
            state = c
            ctr = 1
    # flush out remainders
    if ctr > 0:
        fp.write(chr(state))
        fp.write(chr(ctr))

if __name__ == '__main__':
    import doctest
    doctest.testmod()`
  }

  /**
   * Get the obj_to_ldr.py script content
   * @returns {string} - The script content
   */
  getObjToLdrScript() {
    return `# LEGO Model Generator (Final Refined Version)

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
            f.write(f"Layer {z}:\\n")
            for i, j, bw, bh in layer['bricks']:
                f.write(f"  Brick at (x={j + x_offset}, y={i + y_offset}, z={z}) size=({bw}x{bh})\\n")

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
        f.write("0 LEGO Model Generated from OBJ\\n")
        f.write("0 Name: LEGOFIKS Model\\n")
        f.write("0 Author: LEGOFIKS AI\\n")
        f.write("0 !LDRAW_ORG Unofficial_Model\\n")
        f.write("0 !LICENSE Redistributable under CCAL version 2.0 : see CAreadme.txt\\n\\n")
        
        for layer in brick_layers:
            z = layer['z']
            y_offset, x_offset = layer['offset'][0].start, layer['offset'][1].start
            for i, j, bw, bh in layer['bricks']:
                part = part_id_map.get((bh, bw), '3001.dat')
                x_pos = (j + x_offset) * brick_length_ldu
                y_pos = -z * brick_height_ldu
                z_pos = (i + y_offset) * brick_length_ldu
                f.write(f"1 {color_code} {x_pos} {y_pos} {z_pos} 1 0 0 0 1 0 0 0 1 {part}\\n")

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
    main()`
  }
}

module.exports = ModelToLDR

