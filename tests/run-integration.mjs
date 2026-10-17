import { createServer } from 'vite'
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
