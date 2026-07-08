import type { AssertTrue, AssertEqual } from '../compileTimeTypes';
import { FALLBACK_SCALAR_TYPE, LOOSE_OBJECT_TYPE } from '../typeUtils';

type _FallbackScalarIsUnknown = AssertTrue<
  AssertEqual<typeof FALLBACK_SCALAR_TYPE, 'unknown'>
>;

type _LooseObjectIsRecord = AssertTrue<
  AssertEqual<typeof LOOSE_OBJECT_TYPE, 'Record<string, unknown>'>
>;

export type CompileTimeTypeChecks = _FallbackScalarIsUnknown | _LooseObjectIsRecord;
