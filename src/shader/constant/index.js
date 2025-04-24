/** 全局着色器公共参数。*/

export const uStyle = {
    value: 4,
};
export const uElapseTime = {
    value: 0,
};
export const uTime = {
    value: 0,
};

export function updateTime(delta) {
    uTime.value = delta;
    uElapseTime.value += delta;
}

export function updateStyle(style) {
    uStyle.value = style;
}
