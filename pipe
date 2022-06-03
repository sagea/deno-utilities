export const pipe = <V>(value: V) => {
  return {
    value: (): V => value,
    n: <RT>(callback: (last: V) => RT) => {
      const result = callback(value);
      return pipe(result);
    },
  }
}
