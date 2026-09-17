import { spawn } from 'node:child_process'

const children = []

function run(command, args) {
  const child = spawn(command, args, { stdio: 'inherit', shell: true })
  children.push(child)
  child.on('exit', (code, signal) => {
    if (signal) return
    if (code !== 0) shutdown(code ?? 1)
  })
  return child
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

run('npx', ['vite', '--host', 'localhost', '--port', '5173', '--strictPort'])
run('npx', [
  'cap',
  'run',
  'android',
  '-l',
  '--host=localhost',
  '--port=5173',
  '--forwardPorts',
  '5173:5173',
])
