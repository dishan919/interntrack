import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/register' })
globalThis.window = dom.window
globalThis.document = dom.window.document
const { createServer } = await import('vite')
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
try {
  for (const name of ['registerIntegration', 'loginIntegration', 'routerIntegration', 'authIntegration', 'profileIntegration', 'profileEditIntegration']) {
    const { default: verify } = await server.ssrLoadModule(`/tests/${name}.jsx`)
    console.log(await verify())
  }
} finally {
  await server.close()
  dom.window.close()
}
