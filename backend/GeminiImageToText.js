// GeminiImageToText.js
require('dotenv').config();
const fs = require('fs');
const axios = require('axios');

class GeminiImageToText {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        if (!this.apiKey) {
            throw new Error("GEMINI_API_KEY not found in environment variables");
        }

        this.baseUrl = "https://generativelanguage.googleapis.com/v1";
        this.modelName = "gemini-1.5-pro";
        this.imagePart = null;
        this.prompt = null;
    }

    attachImage(imagePath) {
        if (!fs.existsSync(imagePath)) {
            throw new Error(`Image file not found: ${imagePath}`);
        }

        try {
            const imageBuffer = fs.readFileSync(imagePath);
            const base64Image = imageBuffer.toString('base64');

            this.imagePart = {
                inlineData: {
                    data: base64Image,
                    mimeType: "image/jpeg"
                }
            };
            return "Image attached successfully";
        } catch (error) {
            throw new Error(`Failed to attach image: ${error.message}`);
        }
    }

    setPrompt(promptPath) {
        if (!fs.existsSync(promptPath)) {
            throw new Error(`Prompt file not found: ${promptPath}`);
        }

        try {
            this.prompt = fs.readFileSync(promptPath, 'utf8');
            return "Prompt set successfully";
        } catch (error) {
            throw new Error(`Failed to set prompt: ${error.message}`);
        }
    }

    async predict() {
        if (!this.imagePart) {
            throw new Error("No image attached. Please attach an image first.");
        }

        if (!this.prompt) {
            throw new Error("No prompt set. Please set a prompt first.");
        }

        try {
            const url = `${this.baseUrl}/models/${this.modelName}:generateContent?key=${this.apiKey}`;

            const requestBody = {
                contents: [{
                    parts: [
                        { text: this.prompt },
                        this.imagePart
                    ]
                }]
            };

            const response = await axios.post(url, requestBody);

            if (!response.data || !response.data.candidates || response.data.candidates.length === 0) {
                throw new Error("No response generated from the API");
            }

            return response.data.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error("Gemini API Error:", error.response?.data || error.message);

            if (error.response?.data?.error) {
                throw new Error(`Gemini API error: ${error.response.data.error.message}`);
            } else {
                throw new Error(`Failed to generate text: ${error.message}`);
            }
        }
    }
}

module.exports = GeminiImageToText;