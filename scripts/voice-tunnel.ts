/**
 * Public address for voice testing: npm run voice:tunnel
 *
 * Only POST /api/voice/* is reachable. The dashboard, sign-in and every other route
 * stay private, unlike a plain `ngrok http 3000`.
 */
import { createServer, request as httpRequest } from 'http';
import ngrok from '@ngrok/ngrok';

const APP_PORT = Number(process.env.PORT ?? 3000);
const FORWARDED_HEADERS = ['authorization', 'content-type', 'content-length', 'elevenlabs-signature', 'user-agent'];

function isAllowed(method: string | undefined, url: string | undefined): boolean {
  if (method !== 'POST' || !url) return false;
  // Compare the normalized path, so "/api/voice/../x" cannot slip through.
  const { pathname } = new URL(url, 'http://localhost');
  return /^\/api\/voice\/[a-z/-]+$/.test(pathname);
}

async function main() {
  const server = createServer((req, res) => {
    if (!isAllowed(req.method, req.url)) {
      res.writeHead(404).end();
      return;
    }
    const { pathname } = new URL(req.url!, 'http://localhost');
    const headers = Object.fromEntries(FORWARDED_HEADERS.flatMap((name) => (req.headers[name] ? [[name, req.headers[name]]] : [])));
    const upstream = httpRequest({ host: 'localhost', port: APP_PORT, path: pathname, method: 'POST', headers }, (reply) => {
      console.log(`${new Date().toISOString().slice(11, 19)} ${pathname} ${reply.statusCode}`);
      res.writeHead(reply.statusCode ?? 502, { 'content-type': reply.headers['content-type'] ?? 'application/json' });
      reply.pipe(res);
    });
    upstream.on('error', () => {
      console.error(`${pathname}: the app is not running on port ${APP_PORT}`);
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not open a local port');

  const listener = await ngrok.forward({
    addr: `127.0.0.1:${address.port}`,
    authtoken: process.env.NGROK_AUTHTOKEN,
    ...(process.env.NGROK_DOMAIN ? { domain: process.env.NGROK_DOMAIN } : {}),
  });

  console.log(`Public address: ${listener.url()}`);
  console.log('Only POST /api/voice/* is reachable. Press Ctrl+C to stop.');

  const stop = async () => {
    await listener.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  setInterval(() => {}, 60_000);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
