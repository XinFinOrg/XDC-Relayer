# How to add new processors?

1. Read our `lite.ts`(simple version) or the `full.ts`(more complex version) as examples
2. Assume you plan to add a new processor called `XXX`. First create the file `XXX.ts` under current directory.
3. Add `export class XXX extends BaseProcessor` where all our processors has some common methods such as `init` and `reset`. Implement those methods.
4. Go to `index.ts` in this directory, register your processors with `enum Mode`, `private processors` (class property), `reset` method and add your custom start up condition in `getRunningModes` method
5. Done