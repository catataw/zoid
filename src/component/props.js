/* @flow */

import { ZalgoPromise } from 'zalgo-promise/src';
import { once, memoize, noop, promisify } from 'belter/src';
import { isWindow, type CrossDomainWindowType } from 'cross-domain-utils/src';
import { ProxyWindow } from 'post-robot/src/serialize/window';

import { PROP_SERIALIZATION } from '../constants';

type PropDefinitionType<T, P, S : string> = {|
    type : S,
    alias? : string,
    value? : ({ props : P, state : Object }) => ?T,
    required? : boolean,
    queryParam? : boolean | string | ({ value : T }) => (string | ZalgoPromise<string>),
    queryValue? : ({ value : T }) => (ZalgoPromise<mixed> | mixed),
    sendToChild? : boolean,
    allowDelegate? : boolean,
    validate? : ({ value : T, props : PropsType & P }) => void,
    decorate? : ({ value : T, props : BuiltInPropsType & P, state : Object }) => T,
    def? : ({ props : P, state : Object }) => ?T,
    sameDomain? : boolean,
    serialization? : $Values<typeof PROP_SERIALIZATION>,
    childDecorate? : ({ value : T }) => ?T
|};

export type BooleanPropDefinitionType<T : boolean, P> = PropDefinitionType<T, P, 'boolean'>;
export type StringPropDefinitionType<T : string, P> = PropDefinitionType<T, P, 'string'>;
export type NumberPropDefinitionType<T : number, P> = PropDefinitionType<T, P, 'number'>;
export type FunctionPropDefinitionType<T : Function, P> = PropDefinitionType<T, P, 'function'>;
export type ArrayPropDefinitionType<T : Array<*>, P> = PropDefinitionType<T, P, 'array'>;
export type ObjectPropDefinitionType<T : Object, P> = PropDefinitionType<T, P, 'object'>;

export type MixedPropDefinitionType<P> = BooleanPropDefinitionType<*, P> | StringPropDefinitionType<*, P> | NumberPropDefinitionType<*, P> | FunctionPropDefinitionType<*, P> | ObjectPropDefinitionType<*, P> | ArrayPropDefinitionType<*, P>;

export type UserPropsDefinitionType<P> = {
    [string] : MixedPropDefinitionType<P>
};

export type EventHandlerType<T> = (T) => void | ZalgoPromise<void>;

export type timeoutPropType = number;
export type windowPropType = CrossDomainWindowType | ProxyWindow;

export type onDisplayPropType = EventHandlerType<void>;
export type onRenderedPropType = EventHandlerType<void>;
export type onRenderPropType = EventHandlerType<void>;
export type onClosePropType = EventHandlerType<string>;
export type onErrorPropType = EventHandlerType<mixed>;

export type BuiltInPropsType = {
    timeout? : timeoutPropType,
    window? : ?windowPropType,

    onDisplay : onDisplayPropType,
    onRendered : onRenderedPropType,
    onRender : onRenderPropType,
    onClose : onClosePropType,
    onError : onErrorPropType
};

export type PropsType = {
    timeout? : timeoutPropType,
    window? : windowPropType,

    onDisplay? : onDisplayPropType,
    onRendered? : onRenderedPropType,
    onRender? : onRenderPropType,
    onClose? : onClosePropType,
    onError? : onErrorPropType
};

export type BuiltInPropsDefinitionType<P> = {
    timeout : NumberPropDefinitionType<timeoutPropType, P>,
    window : ObjectPropDefinitionType<windowPropType, P>,

    onDisplay : FunctionPropDefinitionType<onDisplayPropType, P>,
    onRendered : FunctionPropDefinitionType<onRenderedPropType, P>,
    onRender : FunctionPropDefinitionType<onRenderPropType, P>,
    onClose : FunctionPropDefinitionType<onClosePropType, P>,
    onError : FunctionPropDefinitionType<onErrorPropType, P>
};

/*  Internal Props
    --------------

    We define and use certain props by default, for configuration and events that are used at the framework level.
    These follow the same format as regular props, and are classed as reserved words that may not be overriden by users.
*/

export function getInternalProps<P>() : BuiltInPropsDefinitionType<P> {
    return {
        window: {
            type:          'object',
            sendToChild:   false,
            required:      false,
            allowDelegate: true,
            validate({ value } : { value : CrossDomainWindowType | ProxyWindow }) {
                if (!isWindow(value) && !ProxyWindow.isProxyWindow(value)) {
                    throw new Error(`Expected Window or ProxyWindow`);
                }
            },
            decorate({ value } : { value : CrossDomainWindowType | ProxyWindow }) : ProxyWindow {
                return ProxyWindow.toProxyWindow(value);
            }
        },

        timeout: {
            type:        'number',
            required:    false,
            sendToChild: false
        },

        onDisplay: {
            type:          'function',
            required:      false,
            sendToChild:   false,
            allowDelegate: true,

            def: () => noop,

            decorate({ value } : { value : Function }) : Function {
                return memoize(promisify(value));
            }
        },

        onRendered: {
            type:        'function',
            required:    false,
            sendToChild: false,

            def: () => noop,

            decorate({ value } : { value : Function }) : Function {
                return promisify(value);
            }
        },

        // When we get an INIT message from the child

        onRender: {
            type:        'function',
            required:    false,
            sendToChild: false,

            def() : Function {
                return noop;
            },

            decorate({ value } : { value : Function }) : Function {
                return promisify(value);
            }
        },

        // When the user closes the component.

        onClose: {
            type:          'function',
            required:      false,
            sendToChild:   false,
            allowDelegate: true,

            def: () => noop,

            decorate({ value } : { value : Function }) : Function {
                return once(promisify(value));
            }
        },

        // When the component experiences an error

        onError: {
            type:        'function',
            required:    false,
            sendToChild: true,
            def() : (() => void) {
                return function onError(err : mixed) {
                    setTimeout(() => {
                        throw err;
                    });
                };
            },

            decorate({ value } : { value : Function }) : Function {
                return once(promisify(value));
            }
        }
    };
}
