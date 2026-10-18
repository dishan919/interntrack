import { createServer } from 'vite'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
try {
  for (const name of ['deadlineIntegration', 'interviewIntegration', 'kanbanIntegration', 'kanbanDragIntegration', 'skillIntegration', 'searchIntegration', 'apiIntegration']) {
    const { default: verify } = await server.ssrLoadModule('/tests/' + name + '.jsx')
    console.log(await verify())
  }
} finally {
  const { cleanupContext } = await server.ssrLoadModule('/tests/contextHarness.jsx')
  await cleanupContext()
  await server.close()
}

// Initialize browser globals before React DOM for real input/change event tests.
execFileSync(process.execPath, [fileURLToPath(new URL('./run-register-integration.mjs', import.meta.url))], { stdio: 'inherit', windowsHide: true })
