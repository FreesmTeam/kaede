export const ApplicationName = "Kaede";
export const DefaultLocale = "en";

/*
 * JavaScript allows 'AsyncFunction' constructors.
 * see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncFunction
 */
export const AsyncFunction = async function (): Promise<void> {}.constructor as FunctionConstructor;
