import os
import base64
import google.generativeai as genai
from dotenv import load_dotenv
from PIL import Image
import io


class GeminiImageToText:
    def __init__(self):
        """Initialize the Gemini client for image-to-text processing."""
        # Load environment variables from .env file
        load_dotenv()

        # Get API key from environment variable
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables")

        # Configure the Gemini API
        genai.configure(api_key=api_key)

        # Use gemini-2.0-pro if available, fallback to gemini-1.0-pro-vision
        available_models = [model.name for model in genai.list_models()]
        if "gemini-2.0-pro" in available_models:
            self.model_name = "gemini-2.0-pro"
        else:
            self.model_name = "gemini-1.0-pro-vision"

        # Initialize the model
        self.model = genai.GenerativeModel(self.model_name)

    def attach_image(self, path: str, prompt: str = "Describe what you see in this image in detail"):
        """
        Process an image using Gemini vision capabilities.

        Args:
            path (str): Path to the image file
            prompt (str): Prompt to guide the model's analysis of the image

        Returns:
            str: Text description or information extracted from the image
        """
        try:
            # Open and process the image
            image = Image.open(path)

            # If image is not in RGB mode (like RGBA PNG), convert it
            if image.mode not in ("RGB"):
                image = image.convert("RGB")

            # Prepare image for the API
            with io.BytesIO() as output:
                image.save(output, format='JPEG')
                image_bytes = output.getvalue()

            # Generate content with both text prompt and image
            response = self.model.generate_content(
                [prompt, image_bytes]
            )

            return response.text

        except Exception as e:
            return f"Error processing image: {str(e)}"

    def extract_text_from_image(self, path: str):
        """Extract text content from an image (OCR functionality)."""
        prompt = "Extract all text visible in this image. Format it as plain text."
        return self.attach_image(path, prompt)

    def analyze_image_content(self, path: str, specific_query: str = None):
        """Analyze image content with optional specific query."""
        if specific_query:
            prompt = f"Analyze this image and answer the following: {specific_query}"
        else:
            prompt = "Analyze this image and describe what you see in detail."
        return self.attach_image(path, prompt)


if __name__ == "__main__":
    # Example usage
    gemini = GeminiImageToText()

    # Replace with your image path
    image_path = "example_image.jpg"

    # Basic image description
    print("Image Description:")
    description = gemini.attach_image(image_path)
    print(description)

    # Extract text from image (OCR)
    print("\nText Extraction:")
    text = gemini.extract_text_from_image(image_path)
    print(text)

    # Answer specific question about the image
    print("\nSpecific Analysis:")
    analysis = gemini.analyze_image_content(image_path, "What colors are dominant in this image?")
    print(analysis)