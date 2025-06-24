/** Global Configs */
// 动态检测协议，自动选择HTTP/HTTPS和WS/WSS
const protocol = window.location.protocol === "https:" ? "https:" : "http:";
const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";

// 如果您的服务器不支持HTTPS/WSS，可以：
// 1. 使用代理服务（如 Cloudflare）
// 2. 使用备用服务器
// 3. 或者暂时禁用WebSocket功能

window.configs = {
    baseUrl: `${protocol}//47.105.215.238:8099`,
    websocketUrl: `${wsProtocol}//47.105.215.238:8099/api/ws`,

    // 备用配置（如果主服务器不支持HTTPS）
    // baseUrl: "https://your-proxy-domain.com",
    // websocketUrl: "wss://your-proxy-domain.com/api/ws",
};
