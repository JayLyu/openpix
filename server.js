require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// List available models
app.get('/api/models', (_req, res) => {
  res.json({
    models: [
      { id: 'openai/gpt-image-2', name: 'GPT Image 2', provider: 'OpenAI' },
      // Add more models here as they become available
    ]
  });
});

// Generate image via OpenRouter
app.post('/api/generate', async (req, res) => {
  const { apiKey, model, prompt, size, n } = req.body;

  if (!apiKey || !prompt) {
    return res.status(400).json({ error: 'API key and prompt are required' });
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'openai/gpt-image-2',
        prompt,
        n: n || 1,
        ...(size ? { size } : {}),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Generation failed', details: data });
    }

    res.json(data);
  } catch (err) {
    console.error('Generation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`OpenPix running at http://localhost:${PORT}`);
});
