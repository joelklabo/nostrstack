import type { FastifyInstance } from 'fastify';
import { exec } from 'node:child_process';

export async function registerRegtestFaucetRoute(app: FastifyInstance) {
  app.post('/regtest/fund', async (_req, reply) => {
    const cmd = './scripts/regtest-fund.sh';
    try {
      const output = await new Promise<string>((resolve, reject) => {
        exec(cmd, { cwd: app.config.rootDir ?? process.cwd() }, (err, stdout, stderr) => {
          if (err) return reject(stderr || err.message);
          resolve(stdout || '');
        });
      });
      reply.send({ ok: true, output });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      reply.code(500).send({ ok: false, error: msg });
    }
  });
}
