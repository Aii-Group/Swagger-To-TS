/** 编译期类型断言工具 */
export type AssertTrue<T extends true> = T;

export type AssertEqual<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false;
