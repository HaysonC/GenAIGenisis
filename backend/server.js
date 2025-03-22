// server.js
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const GeminiImageToText = require("./GeminiImageToText");
const app = express();
app.use(express.json());
app.use(cors());


// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Initialize model
const model = new GeminiImageToText();

// Image upload endpoint
app.post('/upload-image', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No image provided' });
    }

    const imagePath = req.file.path;
    const result = model.attachImage(imagePath);
    res.json({ message: result, imagePath });
});

// Set prompt endpoint
app.post('/set-prompt', (req, res) => {
    const { text } = req.body;

    // Write prompt to file
    const promptPath = path.join(uploadsDir, 'prompt.txt');
    fs.writeFileSync(promptPath, text);

    const result = model.setPrompt(promptPath);
    res.json({ message: result });
});

// Prediction endpoint
app.get('/predict', async (req, res) => {
    try {
        const result = await model.predict();
        res.json({ text: result });
    } catch (error) {
        console.error('Error predicting:', error);
        res.status(500).json({ message: 'Error generating prediction' });
    }
});

// Serve static React app in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'app/build')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'app/build', 'index.html'));
    });
}

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});