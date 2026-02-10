import { Effect, Either } from 'effect';

export const runEffectOrThrow = async <A, E extends { readonly message: string }>(
  operation: Effect.Effect<A, E, never>
): Promise<A> => {
  const result = await Effect.runPromise(operation.pipe(Effect.either));

  if (Either.isLeft(result)) {
    throw new Error(result.left.message);
  }

  return result.right;
};
