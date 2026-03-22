import dgram from "node:dgram";

const PORT = 3478;

const server = dgram.createSocket("udp4");

server.on("listening", () => {
    const addr = server.address();
    console.log(`stun server listening on UDP ${addr.address}:${addr.port}`);
});

server.on("message", (msg, rinfo) => {
    console.log(`<- ${rinfo.address}:${rinfo.port} (${msg.length} bytes)`);
    console.log(`   raw bytes: ${msg.toString("hex")}`);
});

server.on("error", (err) => {
    console.error(`socket error:`, err);
    server.close();
});

server.bind(PORT);
