import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  for (const name of ['deadlineIntegration', 'interviewIntegration', 'kanbanIntegration', 'kanbanDragIntegration', 'skillIntegration']) {
    const { default: verify } = await server.ssrLoadModule('/tests/' + name + '.jsx')
    console.log(verify())
  }
} finally {
  await server.close()
}
