import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { default: verify } = await server.ssrLoadModule('/tests/deadlineIntegration.jsx')
  console.log(verify())
} finally {
  await server.close()
}
