/// <reference types="./basic.d.ts" />
const TAG = 'port-wrapper'
const STEP_CALL = 0;
const STEP_RETURN = 1;
const STEP_THROWN = 2;
const wrappers = new WeakMap();

const uid = ((i = 0) => () => i++)();

const createCallMessage = (id, name, content) => {
  return {
    tag: TAG,
    id,
    name,
    content,
    step: STEP_CALL,
  }
}

const createReturnMessage = (id, content) => {
  return {
    tag: TAG,
    id,
    name: null,
    content,
    step: STEP_RETURN,
  }
}

const createThrownMessage = (id, content) => {
  return {
    tag: TAG,
    id,
    name: null,
    content,
    step: STEP_THROWN,
  }
}

class Wrapper {
  constructor(worker) {
    this.worker = worker;
    this.responseListeners = new Map()
    this.registeredMethods = new Map()
    this.worker.addEventListener('message', event => this.listener(event));
  }
  listener({ data }) {
    if (!isMessage(data)) return;
    if (data.step === STEP_CALL) {
      const method = this.registeredMethods.get(data.name);
      if (!method) {
        throw new Error(`Method "${data.name}" not registered`)
      }
      Promise.resolve(method(data.content))
        .then(content => createReturnMessage(
          data.id,
          content,
        ))
        .catch(err => createThrownMessage(
          data.id,
          err,
        ))
        .then(message => this.worker.postMessage(message));
    } else if (data.step === STEP_RETURN) {
      this.responseListeners.get(data.id)?.resolve(data.content);
    } else if (data.step === STEP_THROWN) {
      this.responseListeners.get(data.id)?.reject(data.content);
    }
  }
}

const getWrapper = (worker) => {
  let wrapper = wrappers.get(worker);
  if (!wrapper) {
    wrapper = new Wrapper(worker)
    wrappers.set(worker, wrapper);
  }
  return wrapper;
}

const isMessage = (data) => {
  return data && typeof data === 'object' && data.tag === TAG;
}

export const call = (worker, name, data, transferables=[]) => {
	return new Promise((resolve, reject) => {
    const id = uid();
    const wrapper = getWrapper(worker);
    const remove = () => wrapper.responseListeners.delete(id);
    wrapper.responseListeners.set(id, {
      resolve: (content) => {
      	resolve(content);
        remove()
      },
      reject: (content) => {
      	reject(content)
        remove();
      }
    });
    worker.postMessage(createCallMessage(id, name, data), transferables);
  })
}

export const create = (worker, methods) => {
	const wrapper = getWrapper(worker);
	for (const [name, method] of Object.entries(methods)) {
  	wrapper.registeredMethods.set(name, method);
  }
}
