/**
 * Vite dev middleware that serves /api/claude by running the real Vercel
 * handler (api/claude.ts), so local dev exercises the same auth gate,
 * allowlist check, daily cap, and streaming path as production.
 *
 * The handler reads server-only secrets from process.env at module load.
 * Put ANTHROPIC_API_KEY and SUPABASE_SERVICE_ROLE_KEY in .env.local — Vercel
 * marks them sensitive, so `vercel env pull` won't fetch them.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv, type Plugin } from 'vite';

type Handler = (req: unknown, res: unknown) => Promise<unknown>;

export function claudeProxyPlugin(): Plugin {
  return {
    name: 'claude-proxy',
    configureServer(server) {
      // Expose every .env* var (not just VITE_*) to the handler.
      const env = loadEnv(server.config.mode, server.config.root, '');
      for (const [key, value] of Object.entries(env)) {
        process.env[key] ??= value;
      }

      server.middlewares.use('/api/claude', async (req: IncomingMessage, res: ServerResponse) => {
        let raw = '';
        for await (const chunk of req) {
          raw += chunk;
        }

        // Minimal VercelRequest/VercelResponse shim over Node's req/res.
        const vReq = Object.assign(req, { body: raw ? JSON.parse(raw) : undefined });
        const vRes = Object.assign(res, {
          status(code: number) {
            res.statusCode = code;
            return vRes;
          },
          json(body: unknown) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(body));
            return vRes;
          },
        });

        try {
          // ssrLoadModule compiles the TS and picks up edits without a restart.
          const mod = await server.ssrLoadModule('/api/claude.ts');
          await (mod.default as Handler)(vReq, vRes);
        } catch (err) {
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
          }
          res.end(JSON.stringify({ error: (err as Error).message }));
        }
      });
    },
  };
}
