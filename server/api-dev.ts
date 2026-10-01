/**
 * Vite dev middleware that serves /api/<name> by running the real Vercel
 * handler in api/<name>.ts, so local dev exercises the same auth gates,
 * allowlist checks, and streaming paths as production.
 *
 * The handler reads server-only secrets from process.env at module load.
 * Put ANTHROPIC_API_KEY and SUPABASE_SERVICE_ROLE_KEY in .env.local — Vercel
 * marks them sensitive, so `vercel env pull` won't fetch them.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv, type Plugin } from 'vite';

type Handler = (req: unknown, res: unknown) => Promise<unknown>;

export function apiDevPlugin(): Plugin {
  return {
    name: 'api-dev',
    configureServer(server) {
      // Expose every .env* var (not just VITE_*) to the handler.
      const env = loadEnv(server.config.mode, server.config.root, '');
      for (const [key, value] of Object.entries(env)) {
        process.env[key] ??= value;
      }

      server.middlewares.use('/api', async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        // req.url is relative to the mount point, e.g. "/claude?x=1".
        const name = (req.url ?? '').split('?')[0].replace(/^\/+|\/+$/g, '');
        const file = `/api/${name}.ts`;
        if (!/^[a-z][a-z0-9-]*$/.test(name) || !existsSync(path.join(server.config.root, file))) {
          return next();
        }

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
          const mod = await server.ssrLoadModule(file);
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
