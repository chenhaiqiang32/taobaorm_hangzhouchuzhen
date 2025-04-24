let stompClient = null;
let currentScene = null;
export function openWebsocket(core) {
    currentScene = core;
    connect(`${window.configs.websocketUrl}`);
}
function connect(url) {
    const socket = new WebSocket(url);
    stompClient = Stomp.over(socket);

    stompClient.connect({}, function (frame) {
        console.log("Connected: " + frame);
        // 订阅消息
        stompClient.subscribe("/topic/deviceStatus", function (message) {
            console.log(message);
            showMessage(JSON.parse(message.body));
        });
    });
}
function disconnect() {
    if (stompClient !== null) {
        stompClient.disconnect();
    }
}
function showMessage(message) {
    currentScene.toDoDevice(message);
}
