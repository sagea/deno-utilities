export type ExposableItems = Record<string, (...args: any[]) => any>;
export type MessageType = Worker | MessagePort;

export declare const call: <T extends ExposableItems = ExposableItems>(
  worker: MessageType,
  name: keyof T,
  content: Parameters<T[keyof T]>[0],
  transferables?: any[]
) => ReturnType<T[keyof T]> extends Promise<any> ? ReturnType<T[keyof T]> : Promise<ReturnType<T[keyof T]>>;

export declare const create: <T extends ExposableItems = ExposableItems>(
  worker: MessageType,
  items: T
) => void;
