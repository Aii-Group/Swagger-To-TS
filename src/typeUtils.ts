/** 无法精确推断标量类型时的回退类型 */
export const FALLBACK_SCALAR_TYPE = 'unknown';

/** 无法精确推断数组元素类型时的回退类型 */
export const FALLBACK_ARRAY_TYPE = 'unknown[]';

/** 松散 object / Map 类型（如 Java Object、Map<String, Object>） */
export const LOOSE_OBJECT_TYPE = 'Record<string, unknown>';
