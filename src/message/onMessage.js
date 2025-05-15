import { Core3D } from "../three";
export const openMessage = Core3D => {
    window.onmessage = event => {
        if (event.data && event.data.cmd) {
            switch (event.data.cmd) {
                case "deviceManage": {
                    Core3D.deviceManage(event.data.param);
                    break;
                }
                case "changeScene": {
                    Core3D.changeSystem(event.data.param);
                    break;
                }
                case "resetCamera": {
                    // 拉近巷道距离
                    Core3D.resetCamera(event.data.param);
                    break;
                }
                case "close": {
                    Core3D.stopRender();
                    break;
                }
                case "open": {
                    Core3D.beginRender();
                    break;
                }
                case "switchScene": {
                    Core3D.heatSource.switchScene(event.data.param);
                    break;
                }
            }
        }
    };
};
