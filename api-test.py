"""
Script to generate a 3D model by sending a request to the deployed Modal app
"""

import requests
import sys
import os
from pathlib import Path

API_ENDPOINT = "https://moulik-budhiraja--shape-text-to-3d-a100-40gb-generate.modal.run"

# Configuration variables - modify these instead of using command line arguments
PROMPT = "A LEGO brick castle with towers and a drawbridge"
GUIDANCE_SCALE = 15.0
NUM_STEPS = 64
SEED = None  # Set to an integer if you want a specific seed
OUTPUT_FILE = None  # Will be auto-generated based on prompt if None


def generate_3d_model(prompt, guidance_scale=15.0, num_steps=64, seed=None, output_file=None) -> bool:
    """
    Generate a 3D model from a text prompt by calling the deployed Modal app.

    Args:
        prompt (str): Text description of the 3D model
        guidance_scale (float): Guidance scale for model generation
        num_steps (int): Number of diffusion steps
        seed (int, optional): Random seed for reproducibility
        output_file (str, optional): Path to save the output STL file

    Returns:
        bool: True if generation was successful, False otherwise
    """
    print(f"Generating 3D model for prompt: '{prompt}'")
    print(f"Parameters: guidance_scale={guidance_scale}, num_steps={num_steps}, seed={seed}")

    # Prepare parameters
    params = {
        "prompt": prompt,
        "guidance_scale": guidance_scale,
        "num_steps": num_steps
    }

    if seed is not None:
        params["seed"] = seed

    # If no output file specified, create one based on the prompt
    if output_file is None:
        # Replace spaces and special characters with underscores
        safe_prompt = "".join(c if c.isalnum() else "_" for c in prompt)
        safe_prompt = safe_prompt[:30]  # Limit length
        output_file = f"{safe_prompt}.stl"

    print(f"Sending request to {API_ENDPOINT}")
    try:
        # Send POST request to the API
        response = requests.post(API_ENDPOINT, params=params, timeout=300)  # 5 minute timeout

        # Check if request was successful
        if response.status_code == 200:
            # Get content size
            content_size = len(response.content)
            print(f"Received response: {content_size / 1024:.1f} KB")

            # Ensure content is not empty
            if content_size < 100:  # Arbitrarily small size threshold
                print(f"Warning: Received very small file ({content_size} bytes)")
                print(f"Content: {response.content[:100]}")
                return False

            # Save the content to a file
            with open(output_file, 'wb') as f:
                f.write(response.content)

            print(f"Successfully saved 3D model to {output_file}")

            # Get file size
            file_size = os.path.getsize(output_file)
            print(f"File size: {file_size / 1024:.1f} KB")

            return True
        else:
            print(f"Error: Received status code {response.status_code}")
            print(f"Response: {response.text}")
            return False

    except requests.exceptions.Timeout:
        print("Error: Request timed out. The model generation is taking too long.")
        return False
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        return False


if __name__ == "__main__":
    success = generate_3d_model(
        prompt=PROMPT,
        guidance_scale=GUIDANCE_SCALE,
        num_steps=NUM_STEPS,
        seed=SEED,
        output_file=OUTPUT_FILE
    )

    if not success:
        sys.exit(1)