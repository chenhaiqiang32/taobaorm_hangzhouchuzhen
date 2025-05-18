export const onLoaded = () => {
    window.parent.postMessage({ cmd: "onLoaded" }, "*");
};
export const onClickCallBack = (type, data) => {
    window.parent.postMessage(
        {
            // 调用前端弹窗
            cmd: "onClickObject",
            param: { data, type },
        },
        "*",
    );
};
export const postChangeScene = (id, type) => {
    window.parent.postMessage(
        {
            // 调用前端弹窗
            cmd: "changeSceneWeb",
            param: { id, type },
        },
        "*",
    );
};
export const postWeb3dDeviceCode = id => {
    window.parent.postMessage(
        {
            // 调用前端弹窗
            cmd: "web3dDeviceCode",
            param: id,
        },
        "*",
    );
};
