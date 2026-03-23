/**
 * Vite dev middleware that proxies /api/claude to the Anthropic API.
 * In production, Vercel serverless functions handle this instead.
 */
import type { Plugin } from 'vite';

export function claudeProxyPlugin(): Plugin {
  return {
    name: 'claude-proxy',
    configureServer(server) {
      server.middlewares.use('/api/claude', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        let body = '';
        for await (const chunk of req) {
          body += chunk;
        }

        try {
          const { apiKey, systemPrompt, userPrompt, messages, model } = JSON.parse(body);

          if (!apiKey) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing API key' }));
            return;
          }

          // Support either simple text (userPrompt) or structured messages (for vision)
          const userMessages = messages ?? [{ role: 'user', content: userPrompt }];

          const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: model || 'claude-sonnet-4-6',
              max_tokens: 4096,
              system: systemPrompt,
              messages: userMessages,
            }),
          });

          if (!anthropicRes.ok) {
            const errText = await anthropicRes.text();
            res.statusCode = anthropicRes.status;
            res.end(errText);
            return;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = await anthropicRes.json() as any;
          const content = data.content?.[0]?.text ?? '';

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ content }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: (err as Error).message }));
        }
      });
    },
  };
}
