/**
 * 初始化巷道/更新巷道
 * @typedef {Object} initialized - 用户信息对象
 * @property {number} id - 管道id,唯一标识
 * @property {string} branchName - 巷道名称
 * @property {number} direction - 巷道风向  [0进风 1出风 2其他]
 * @property {array} pList - 当前巷道点的集合 [{x:0,y:0,z:0},{x:0,y:0,z:0}]
 * @property {number} length - 长度
 * @property {number} crossSectional - 断面积
 * @property {number} speed - 风速
 * @property {number} resistance - 阻力
 * @property {number} volume - 风量
 */



/**
 * @typedef {Object} deviceManage
 * @property {deviceEdit[]} add - 新增设备数据，包含deviceEdit对象
 * @property {deviceEdit[]} update - 修改设备数据，包含deviceEdit对象
 * @property {deviceRemove[]} remove - 移除设备数据，包含deviceRemove对象
 */

/**
 * 新增/修改设备
 * @typedef {Object} deviceEdit - 新增/修改设备
 * @property {number} id - 设备id
 * @property {string} code - 设备编码/编号
 * @property {number} type - 设备类型（参照设备类型说明)
 * @property {string} name - 设备名称
 * @property {number} tunnelId - 巷道ID
 * @property {number} distance - 设备距离巷道起点的距离
 * @param {deviceParts[]} device - 部件列表
 */
/**
 * 删除设备
 * @typedef {Object} deviceRemove - 修改设备
 * @property {number} id - 设备id
 * @property {number} type - 设备类型（参照设备类型说明)
 */
