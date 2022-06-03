import { pipe } from './pipe.ts';

const registeredCommands = new Map<string, CommandItem[]>();
const registeredPreCommands = new Map<string, CommandItem[]>();

type CommandReference = { type: 'ref', commandName: string };
type CommandString = { type: 'string', command: string };
type FillIn = { type: 'fillIn', value: 'inherit' | string | string[] };
type CommandItem = CommandString | CommandReference;
type TemplateItems = string | FillIn | CommandItem;
type RawCommandItem = string | CommandItem;

const commandReference = (commandName: string): CommandReference => ({ type: 'ref', commandName })
const commandString = (command: string): CommandString => ({ type: 'string', command })
const fillIn = (value: 'inherit' | string | string[]): FillIn => ({ type: 'fillIn', value });

const isCommandReference = (commandItem: RawCommandItem): commandItem is CommandReference => {
  if (!commandItem) return false;
  if (typeof commandItem !== 'object') return false;
  return commandItem.type === 'ref'
}
const isCommandString = (commandItem: RawCommandItem): commandItem is CommandString => {
  if (!commandItem) return false;
  if (typeof commandItem !== 'object') return false;
  return commandItem.type === 'string'
}

const isFillIn = (commandItem: TemplateItems): commandItem is FillIn => {
  if (!commandItem) return false;
  if (typeof commandItem !== 'object') return false;
  return commandItem.type === 'fillIn'
}

const getLast = <T extends any[]>(array: T): T[number] => {
  if (array.length === 0) return undefined;
  return array[array.length - 1];
}
const setLast = <T extends any[]>(array: T, item: T[number]) => {
  array[array.length - 1] = item;
}

const mergeFillIns = (list: TemplateItems[]): RawCommandItem[] => {
  const l: RawCommandItem[] = []
  list.forEach((item, index, originalList) => {
    if (index === 0) {
      l.push(item as RawCommandItem);
      return;
    }
    if (isFillIn(item)) {
      const last = getLast(l);
      const fill = Array.isArray(item.value) ? item.value : [item.value];
      setLast(l, [last, ...fill].join(' '));
      return;
    }
    if (isFillIn(originalList[index - 1])) {
      const last = getLast(l);
      console.log('last', l, index)
      setLast(l, [last, item].join(' '));
      return;
    }
    l.push(item);
  })
  return l;
}
const isString = (item: unknown): item is string => typeof item === 'string';

const filterOutItems = <TArrItem, TRemoveItem>(arr: TArrItem[], ...removeItems: TRemoveItem[]): Exclude<TArrItem, TRemoveItem>[] => {
  return arr.filter((item: any) => !removeItems.includes(item)) as any;
}

const processCommands = (
  templateStringArray: TemplateStringsArray,
  items: TemplateItems[]
): CommandItem[] => {
  const length = Math.max(templateStringArray.length, items.length);
  const union: Array<TemplateItems | undefined> = []
  for (let i = 0; i < length; i++) {
    union.push(templateStringArray[i], items[i]);
  }
  return pipe(union)
    .n(arr => filterOutItems(arr, undefined))
    .n(arr => arr.map(item => isString(item) ? item.trim() : item))
    .n(arr => filterOutItems(arr, ''))
    .n(arr => mergeFillIns(arr))
    .n(arr => arr.map(item => isString(item) ? commandString(item) : item))
    .value();
}

const pre = (...commandLabels: string[]) => {
  for (const label of commandLabels) {
    if (registeredPreCommands.has(label)) {
      throw new Error(`Pre Command with the name "${label}" already exists`);
    }
  }
  return (commandStrings: TemplateStringsArray, ...items: TemplateItems[]) => {
    const filtered = processCommands(commandStrings, items);
    for (const label of commandLabels) {
      registeredPreCommands.set(label, filtered);
    }
  }
}

const command = (...commandLabels: string[]) => {
  for (const label of commandLabels) {
    if (registeredCommands.has(label)) {
      throw new Error(`Command with the name "${label}" already exists`);
    }
  }
  return (commandStrings: TemplateStringsArray, ...items: TemplateItems[]) => {
    const filtered = processCommands(commandStrings, items);
    for (let label of commandLabels) {
      registeredCommands.set(label, filtered);
    }
  }
}

const runCommand = async ([commandName]: string[]) => {
  if (!commandName) {
    console.error(`Command name not provided. Allowed: ${[...registeredCommands.keys()].join(', ')}`)
    Deno.exit(1);
  }
  if (!registeredCommands.has(commandName)) {
    console.error(`Unknown command "${commandName}". Allowed: ${[...registeredCommands.keys()].join(', ')}`)
    Deno.exit(1);
  }
  const run = async (commandItems: CommandItem[]) => {
    for (const item of commandItems) {
      if (isCommandReference(item)) {
        await runCommand([item.commandName]);
      } else if (isCommandString(item)) {
        const result = Deno.run({
          cmd: ['/bin/sh', '-c', item.command]
        })
        await result.status();
      }
    }
  }
  const preCommand = registeredPreCommands.get(commandName);
  if (preCommand) {
    console.log('Running pre command', commandName);
    await run(preCommand);
  }
  console.log('Running command', commandName);
  const command = registeredCommands.get(commandName) as CommandItem[];
  await run(command);
}

const run = (commandName: string): CommandReference => commandReference(commandName);
const args = (value: 'inherit' | string | string[] = 'inherit'): FillIn => fillIn(value);
/**
 * features A/C:
 * 1. Must be able to register commands
 * 2. No duplicate commands allowed
 * 3. Command to run is a template string
 * 4. multiple commands can be defined with the same template string
 * 5. pre utility should exist to run any pre commands
 * 6. Commands should be able to execute other commands via template string variables
 * 7. parallel utility should exist for sub command command execution
 * 8 args utility should be created to place array or string at anywhere in the command
 */
// command('@pre:build')
// pre('build', 'build:watch') ``

export { run, args, command, pre, runCommand }
