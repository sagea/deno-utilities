/// <reference types="./anim.d.ts" />
export const promise = () => new Promise(r => requestAnimationFrame(r));
export async function* iter() {
	while(true) {
  	yield await promise();
  }
}
