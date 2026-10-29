#!/usr/bin/env -S node --experimental-strip-types

/*
Portless forwards plain HTTP, but DevResults forms auth requires HTTPS (`requireSSL`). This bridge
accepts Portless's plain connection on PORT and re-encrypts it to the environment's IIS port through
the local SSH forward, leaving the browser's Host header untouched.
*/

import { createServer } from "node:net"
import { connect } from "node:tls"

const [upstreamPort, servername] = process.argv.slice(2)
createServer(client => {
  const upstream = connect({
    host: "127.0.0.1",
    port: Number(upstreamPort),
    servername,
    ALPNProtocols: ["http/1.1"],
  })
  /** Close both halves when either side fails. */
  const close = () => {
    client.destroy()
    upstream.destroy()
  }
  client.on("error", close)
  upstream.on("error", close)
  client.pipe(upstream).pipe(client)
}).listen(Number(process.env.PORT), "127.0.0.1")
