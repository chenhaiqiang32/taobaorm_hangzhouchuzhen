export function openWebsocket(core) {
    currentScene = core;
    connect(`${window.configs.websocketUrl}`);
}

let socket = null;
let keepaliveTimer = null;
let currentScene = null;

function connect(url) {
    socket = new WebSocket(url);

    socket.onopen = onopen; //socket连接成功处理事件
    socket.onclose = onclose; //socket连接关闭处理事件
    socket.onmessage = onmessage; //socket接收到新消息

    clearInterval(keepaliveTimer);

    keepaliveTimer = setInterval(() => {
        if (socket) {
            socket.send("keepalive");
        }
    }, 5000);
}

function onopen() {}

function onclose(event) {
    setTimeout(function () {
        connect(event.target.url);
    }, 5000);
}

function onmessage(event) {
    let data = JSON.parse(event.data); // 处理数据
    currentScene.createAnimate(data);
}
