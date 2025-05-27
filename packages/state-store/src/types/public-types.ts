// Public types
export type ComputedDef<TState extends Record<string, any>> = Record<
  string,
  (state: Readonly<TState>) => any
>;

export type ActionResult<TState> = Partial<TState> | ((state: Readonly<TState>) => Partial<TState>);

export type ActionsDef<TState extends Record<string, any>> = Record<
  string,
  (...args: any[]) => ActionResult<TState>
>;

export type AsyncResult<TState> =
  | {
      success: true;
      state: Partial<TState>;
    }
  | {
      success: false;
      error: Error;
    };

export type AsyncActionsDef<TState extends Record<string, any>> = Record<
  string,
  (...args: any[]) => Promise<AsyncResult<TState>>
>;
