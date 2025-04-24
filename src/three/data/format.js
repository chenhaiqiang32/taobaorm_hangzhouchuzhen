function formatChildren(children) {
    if (!children) return;
    const res = [];
    if (Array.isArray(children)) {
        children.forEach(child => res.push(getSceneData(child)));
    } else {
        res.push(getSceneData(children));
    }
    return res;
}
export function getSceneData(target) {
    const item = {};

    item.name = target.name || target.type;
    item.id = target.uuid;
    item.type = target.type;

    if (item.type === "Mesh") {
        item.material = {
            roughness: target.material.roughness,
            metalness: target.material.metalness,
            transparent: target.material.transparent,
        };
    } else if (item.type === "AmbientLight") {
        const color = target.color.getHex();
        item.color = color;
        item.intensity = target.intensity;
    } else if (item.type === "DirectionalLight") {
        const color = target.color.getHex();
        item.color = color;
        item.intensity = target.intensity;
    }
    if (target.children.length) {
        item.children = formatChildren(target.children);
    }
    return item;
}

export function getCameraData(camera) {
    return {
        id: camera.uuid,
        type: camera.type,
        name: camera.name || camera.type,
        position: camera.position.toArray(),
    };
}

export function getRendererData(renderer) {
    return {
        name: "WebGLRenderer",
        type: "WebGLRenderer",
        shadow: renderer.shadowMap.enabled,
    };
}

export function getData(core) {
    const sceneData = getSceneData(core.scene);
    const cameraData = getCameraData(core.camera);
    const rendererData = getRendererData(core.renderer);

    return {
        scene: sceneData,
        camera: cameraData,
        renderer: rendererData,
    };
}
