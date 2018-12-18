/* @flow */

import { ZalgoPromise } from 'zalgo-promise/src';

export type CleanupType = {
    set : <T : mixed>(string, T) => T, // eslint-disable-line no-undef
    register : (Function) => void,
    hasTasks : () => boolean,
    all : () => ZalgoPromise<void>
};

export function cleanup(obj : Object) : CleanupType {

    let tasks = [];
    let cleaned = false;

    return {

        set<T : mixed>(name : string, item : T) : T {

            if (cleaned) {
                return item;
            }

            obj[name] = item;
            this.register(() => {
                delete obj[name];
            });
            return item;
        },

        register(method : Function) {

            if (cleaned) {
                method();
                return;
            }

            tasks.push({
                complete: false,

                run() {

                    if (this.complete) {
                        return;
                    }

                    this.complete = true;

                    if (method) {
                        method();
                    }
                }
            });
        },

        hasTasks() : boolean {
            return Boolean(tasks.filter(item => !item.complete).length);
        },

        all() : ZalgoPromise<void> {
            let results = [];

            cleaned = true;

            while (tasks.length) {
                results.push(tasks.pop().run());
            }

            return ZalgoPromise.all(results).then(() => { /* pass */ });
        }
    };
}
