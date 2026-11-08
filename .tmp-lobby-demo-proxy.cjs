// Temporary local-only demo proxy. It does not write sample data to PostgreSQL.
const http = require('node:http')
const demoLobbies = Array.from({ length: 10 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  lobbyName: `[Demo] Lobby ${index + 1}`,
  details: 'Temporary sample for Lobby Feed layout testing.',
  host: { username: `DemoHost${index + 1}` },
  game: ['CS2', 'Valorant', 'Overwatch 2'][index % 3],
  skillLevel: ['Beginner', 'Intermediate', 'Advanced'][index % 3],
  visibility: 'public',
  memberCount: (index % 4) + 1,
  participantLimit: [5, 10, null][index % 3],
}))
http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/lobbies/db') {
    http.get('http://127.0.0.1:3000/lobbies/db', { headers: req.headers }, upstream => {
      const chunks = []
      upstream.on('data', chunk => chunks.push(chunk))
      upstream.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString())
          if (upstream.statusCode !== 200 || !Array.isArray(data)) throw new Error('Invalid upstream response')
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
          res.end(JSON.stringify([...data, ...demoLobbies]))
        } catch {
          res.writeHead(502, { 'Access-Control-Allow-Origin': '*' })
          res.end('Backend unavailable')
        }
      })
    }).on('error', () => { res.writeHead(502, { 'Access-Control-Allow-Origin': '*' }); res.end('Backend unavailable') })
    return
  }
  const upstream = http.request({ hostname: '127.0.0.1', port: 3000, method: req.method, path: req.url, headers: req.headers }, response => {
    res.writeHead(response.statusCode, response.headers)
    response.pipe(res)
  })
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(502, { 'Access-Control-Allow-Origin': '*' }); res.end('Backend unavailable') })
  req.pipe(upstream)
}).listen(3001, '127.0.0.1')
