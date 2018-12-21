/* @flow */
/* eslint max-lines: 0 */

import { isSameDomain, matchDomain, getDomain, getOpener, getTop, getParent,
    getNthParentFromTop, getAncestor, getAllFramesInWindow, type CrossDomainWindowType } from 'cross-domain-utils/src';
import { markWindowKnown, deserializeMessage } from 'post-robot/src';
import { ZalgoPromise } from 'zalgo-promise/src';
import { extend, getElement, noop, memoized, waitForDocumentBody, onResize } from 'belter/src';

import { parseChildWindowName, globalFor } from '../lib';
import { CONTEXT, CLOSE_REASONS, INITIAL_PROPS, WINDOW_REFERENCES } from '../constants';
import type { Component } from '../component';
import type { BuiltInPropsType } from '../component/props';
import type { WindowRef, PropRef, ParentExportsType } from '../parent';

import { normalizeChildProps } from './props';

export type ChildExportsType<P> = {
    updateProps : (props : (BuiltInPropsType & P)) => ZalgoPromise<void>,
    close : () => ZalgoPromise<void>
};

/*  Child Component
    ---------------

    This is the portion of code which runs inside the frame or popup window containing the component's implementation.

    When the component author calls myComponent.attach(), it creates a new instance of ChildComponent, which is then
    responsible for managing the state and messaging back up to the parent, and providing props for the component to
    utilize.
*/

export class ChildComponent<P> {

    component : Component<P>
    props : BuiltInPropsType & P
    context : string
    parentExports : ParentExportsType<P>
    parentComponentWindow : CrossDomainWindowType

    onPropHandlers : Array<(BuiltInPropsType & P) => void>
    onInit : ZalgoPromise<ChildComponent<P>>
    watchingForResize : boolean
    autoResize : { width : boolean, height : boolean, element? : string }

    constructor(component : Component<P>) {
        ZalgoPromise.try(() => {
            if (window.xchild || window.xprops) {
                throw this.component.createError(`Can not attach multiple components to the same window`);
            }

            this.component = component;
            this.onPropHandlers = [];
            
            let { parent, domain, exports, context, props } = parseChildWindowName();

            this.context = context;
            this.parentComponentWindow = this.getWindowByRef(parent);
            this.parentExports = deserializeMessage(this.parentComponentWindow, domain, exports);

            this.checkParentDomain(domain);

            window.xchild = this.component.xchild = this;
            let initialProps = this.getPropsByRef(this.parentComponentWindow, domain, props);
            this.setProps(initialProps, domain);
            markWindowKnown(this.parentComponentWindow);
            
            this.watchForClose();

            return this.parentExports.init(this.buildExports());

        }).then(() => {
            return this.watchForResize();

        }).catch(err => {
            this.error(err);
        });
    }

    checkParentDomain(domain : string) {
        if (!matchDomain(this.component.allowedParentDomains, domain)) {
            throw new Error(`Can not be rendered by domain: ${ domain }`);
        }
    }

    onProps(handler : Function) {
        this.onPropHandlers.push(handler);
    }

    getPropsByRef(parentComponentWindow : CrossDomainWindowType, domain : string, { type, value, uid } : PropRef) : (BuiltInPropsType & P) {
        let props;

        if (type === INITIAL_PROPS.RAW) {
            props = value;
        } else if (type === INITIAL_PROPS.UID) {

            if (!isSameDomain(parentComponentWindow)) {
                if (window.location.protocol === 'file:') {
                    throw new Error(`Can not get props from file:// domain`);
                }

                throw new Error(`Parent component window is on a different domain - expected ${ getDomain() } - can not retrieve props`);
            }

            let global = globalFor(parentComponentWindow);

            if (!global) {
                throw new Error(`Can not find global for parent component - can not retrieve props`);
            }

            props = global.props[uid];
        }

        if (!props) {
            throw new Error(`Initial props not found`);
        }

        return deserializeMessage(parentComponentWindow, domain, props);
    }

    getWindowByRef(ref : WindowRef) : CrossDomainWindowType {
        let { type } = ref;
        let result;
    
        if (type === WINDOW_REFERENCES.OPENER) {
            result = getOpener(window);
    
        } else if (type === WINDOW_REFERENCES.TOP) {
            result = getTop(window);
    
        } else if (type === WINDOW_REFERENCES.PARENT) {
            // $FlowFixMe
            let { distance } = ref;
    
            if (distance) {
                result = getNthParentFromTop(window, distance);
            } else {
                result = getParent(window);
            }
        }
    
        if (type === WINDOW_REFERENCES.GLOBAL) {
            // $FlowFixMe
            let { uid } = ref;
            let ancestor = getAncestor(window);
    
            if (ancestor) {
                for (let frame of getAllFramesInWindow(ancestor)) {
                    let global = globalFor(frame);
    
                    if (global && global.windows && global.windows[uid]) {
                        result = global.windows[uid];
                        break;
                    }
                }
            }
        }
    
        if (!result) {
            throw new Error(`Unable to find ${ type } window`);
        }
    
        return result;
    }


    setProps(props : (BuiltInPropsType & P), origin : string, required : boolean = true) {
        // $FlowFixMe
        this.props = this.props || {};
        let normalizedProps = normalizeChildProps(this.parentComponentWindow, this.component, props, origin, required);
        extend(this.props, normalizedProps);
        for (let handler of this.onPropHandlers) {
            handler.call(this, this.props);
        }
        window.xprops = this.component.xprops = this.props;
    }

    watchForClose() {
        window.addEventListener('unload', () => {
            return this.parentExports.checkClose.fireAndForget();
        });
    }

    enableAutoResize({ width = false, height = true, element = 'body' } : { width : boolean, height : boolean, element : string } = {}) {
        this.autoResize = { width, height, element };
        this.watchForResize();
    }

    getAutoResize() : { width : boolean, height : boolean, element : HTMLElement } {
        let { width = false, height = false, element = 'body' } = this.autoResize || this.component.autoResize || {};
        element = getElement(element);
        return { width, height, element };
    }

    @memoized
    watchForResize() : ?ZalgoPromise<void> {
        return waitForDocumentBody().then(() => {
            let { width, height, element } = this.getAutoResize();

            if (!width && !height) {
                return;
            }
    
            if (this.context === CONTEXT.POPUP) {
                return;
            }

            onResize(element, ({ width: newWidth, height: newHeight }) => {
                this.resize({
                    width:  width ? newWidth : undefined,
                    height: height ? newHeight : undefined
                });
            }, { width, height });
        });
    }

    buildExports() : ChildExportsType<P> {

        let self = this;

        return {
            updateProps(props : (BuiltInPropsType & P)) : ZalgoPromise<void> {
                return ZalgoPromise.try(() => self.setProps(props, this.origin, false));
            },

            close() : ZalgoPromise<void> {
                return ZalgoPromise.try(() => self.destroy());
            }
        };
    }

    resize({ width, height } : { width? : number, height? : number }) : ZalgoPromise<void> {
        return this.parentExports.resize.fireAndForget({ width, height });
    }

    hide() : ZalgoPromise<void> {
        return this.parentExports.hide();
    }

    show() : ZalgoPromise<void> {
        return this.parentExports.show();
    }

    userClose() : ZalgoPromise<void> {
        return this.close(CLOSE_REASONS.USER_CLOSED);
    }

    close(reason : string = CLOSE_REASONS.CHILD_CALL) : ZalgoPromise<void> {
        return this.parentExports.close(reason);
    }
    
    destroy() : ZalgoPromise<void> {
        return ZalgoPromise.try(() => {
            window.close();
        });
    }

    focus() {
        window.focus();
    }

    error(err : mixed) : ZalgoPromise<void> {
        // eslint-disable-next-line promise/no-promise-in-callback
        return ZalgoPromise.try(() => {
            if (this.parentExports && this.parentExports.error) {
                return this.parentExports.error(err);
            }
        }).catch(noop).then(() => {
            throw err;
        });
    }
}
