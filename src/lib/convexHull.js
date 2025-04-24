import { Vector2 } from "three";

/**
 * 二维凸包算法
 * @param {Vector2[]} points
 * @returns {Vector2[]}
 */
export function convexHull(points) {
    points.sort(function (a, b) {
        return a.x != b.x ? a.x - b.x : a.y - b.y;
    });

    var n = points.length;
    var hull = [];

    for (var i = 0; i < 2 * n; i++) {
        var j = i < n ? i : 2 * n - 1 - i;
        while (hull.length >= 2 && removeMiddle(hull[hull.length - 2], hull[hull.length - 1], points[j])) hull.pop();
        hull.push(points[j]);
    }

    hull.pop();
    return hull;
}

/**
 * @param {Vector2} a
 * @param {Vector2} b
 * @param {Vector2} c
 * @returns
 */
function removeMiddle(a, b, c) {
    var cross = (a.x - b.x) * (c.y - b.y) - (a.y - b.y) * (c.x - b.x);
    var dot = (a.x - b.x) * (c.x - b.x) + (a.y - b.y) * (c.y - b.y);
    return cross < 0 || (cross == 0 && dot <= 0);
}
