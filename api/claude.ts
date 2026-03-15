import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey, systemPrompt, userPrompt } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'Missing API key' });
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return res.status(anthropicRes.status).end(errText);
    }

    const data = await anthropicRes.json();
    const content = (data as { content: { text: string }[] }).content?.[0]?.text ?? '';

    return res.status(200).json({ content });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
}
