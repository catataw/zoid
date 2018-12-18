/* @flow */
/* eslint max-lines: 0 */

import { send, bridge, serializeMessage, ProxyWindow } from 'post-robot/src';
import { isSameDomain, matchDomain, getDomainFromUrl, isBlankDomain,
    onCloseWindow, getDomain, type CrossDomainWindowType, getDistanceFromTop, isTop, normalizeMockUrl } from 'cross-domain-utils/src';
import { ZalgoPromise } from 'zalgo-promise/src';
import { addEventListener, uniqueID, elementReady, writeElementToWindow,
    noop, showElement, hideElement, onResize,
    addClass, extend, extendUrl, getElement, memoized, appendChild,
    once, stringifyError, type EventEmitterType, destroyElement, isDefined } from 'belter/src';

import { POST_MESSAGE, CONTEXT, CLASS,
    CLOSE_REASONS, INITIAL_PROPS, WINDOW_REFERENCES } from '../constants';
import type { Component, onErrorPropType } from '../component';
import { global, cleanup, type CleanupType, buildChildWindowName } from '../lib';
import type { PropsType, BuiltInPropsType } from '../component/props';
import type { ChildExportsType } from '../child';
import type { DimensionsType, ElementRefType } from '../types';

import { RENDER_DRIVERS, type ContextDriverType } from './drivers';
import { propsToQuery, normalizeProps } from './props';

global.props = global.props || {};
global.windows = global.windows || {};

export type RenderOptionsType<P> = {|
    uid : string,
    props : PropsType & P,
    tag : string,
    context : string,
    outlet : HTMLElement,
    actions : {
        close : (?string) => ZalgoPromise<void>,
        focus : () => ZalgoPromise<ProxyWindow>
    },
    doc : Document,
    container? : HTMLElement,
    dimensions : DimensionsType,
    state : Object
|};

export type ParentExportsType<P> = {
    init : (ChildExportsType<P>) => ZalgoPromise<void>,
    close : (string) => ZalgoPromise<void>,
    checkClose : () => ZalgoPromise<void>,
    resize : ({ width? : ?number, height? : ?number }) => ZalgoPromise<void>,
    hide : () => ZalgoPromise<void>,
    show : () => ZalgoPromise<void>,
    error : (mixed) => ZalgoPromise<void>
};

export type PropRef =
    {| type : typeof INITIAL_PROPS.RAW, uid? : string, value? : string |};

export type WindowRef =
    {| type : typeof WINDOW_REFERENCES.OPENER |} |
    {| type : typeof WINDOW_REFERENCES.TOP |} |
    {| type : typeof WINDOW_REFERENCES.PARENT, distance : number |} |
    {| type : typeof WINDOW_REFERENCES.GLOBAL, uid : string |};

export type ChildPayload = {
    uid : string,
    tag : string,
    context : $Values<typeof CONTEXT>,
    domain : string,
    parent : WindowRef,
    props : PropRef,
    exports : string
};

export type StateType = Object;

export class ParentComponent<P> {

    component : Component<P>
    driver : ContextDriverType
    props : BuiltInPropsType & P
    initPromise : ZalgoPromise<ParentComponent<P>>
    errored : boolean
    event : EventEmitterType
    clean : CleanupType
    state : StateType

    container : HTMLElement
    element : HTMLElement
    iframe : HTMLIFrameElement
    prerenderIframe : HTMLIFrameElement

    childExports : ?ChildExportsType<P>
    timeout : ?TimeoutID // eslint-disable-line no-undef

    constructor(component : Component<P>, context : string, { props } : { props : (PropsType & P) }) {
        ZalgoPromise.try(() => {
            this.initPromise = new ZalgoPromise();
            this.clean = cleanup(this);
            this.state = {};

            this.component = component;
            this.driver = RENDER_DRIVERS[context];
    
            this.setProps(props);
            this.component.registerActiveComponent(this);
            this.clean.register(() => this.component.destroyActiveComponent(this));
            this.watchForUnload();
    
            return this.initPromise;

        }).catch(err => {
            return this.error(err, props.onError);
        });
    }

    render(target : CrossDomainWindowType, context : $Values<typeof CONTEXT>, element : ElementRefType) : ZalgoPromise<ParentComponent<P>> {
        return this.tryInit(() => {
            this.component.log(`render`);

            let uid = `${ this.component.tag }-${ uniqueID() }`;
            let domain = this.getDomain();
            let initialDomain = this.getInitialDomain();

            if (target !== window) {
                this.component.checkAllowRemoteRender(target, domain, element);
                this.delegate(context, target);
            }

            let tasks = {};

            tasks.buildUrl = this.buildUrl();
            tasks.onRender = this.props.onRender();

            tasks.openContainer = ZalgoPromise.try(() => {
                let focus = () => {
                    return tasks.open.then(proxyWin => proxyWin.focus());
                };

                return this.openContainer(element, { context, uid, focus });
            });

            tasks.open = this.driver.renderedIntoContainer
                ? tasks.openContainer.then(() => this.open())
                : this.open();

            tasks.buildWindowName = tasks.open.then(proxyWin => {
                return this.buildWindowName({ proxyWin, initialDomain, domain, target, context, uid });
            });

            tasks.setWindowName =  ZalgoPromise.all([ tasks.open, tasks.buildWindowName ]).then(([ proxyWin, windowName ]) => {
                return this.setWindowName(proxyWin, windowName);
            });

            tasks.watchForClose = tasks.open.then(proxyWin => {
                return this.watchForClose(proxyWin);
            });

            tasks.prerender = ZalgoPromise.all([ tasks.open, tasks.openContainer ]).then(([ proxyWin ]) => {
                return this.prerender(proxyWin, { context, uid });
            });

            tasks.showComponent = tasks.prerender.then(() => {
                return this.showComponent();
            });

            tasks.openBridge = ZalgoPromise.all([ tasks.open, tasks.buildUrl ]).then(([ proxyWin, url ]) => {
                return this.openBridge(proxyWin, getDomainFromUrl(url), context);
            });

            tasks.loadUrl = ZalgoPromise.all([ tasks.open, tasks.buildUrl, tasks.setWindowName ]).then(([ proxyWin, url ]) => {
                return this.loadUrl(proxyWin, url);
            });

            tasks.switchPrerender = ZalgoPromise.all([ tasks.prerender, this.initPromise ]).then(() => {
                return this.switchPrerender();
            });

            tasks.runTimeout = tasks.loadUrl.then(() => {
                return this.runTimeout();
            });

            return ZalgoPromise.hash(tasks);

        }).then(() => {
            return this.props.onRendered();
            
        }).then(() => {
            return this;
        });
    }

    getWindowRef(target : CrossDomainWindowType, domain : string, uid : string, context : $Values<typeof CONTEXT>) : WindowRef {
        
        if (domain === getDomain(window)) {
            global.windows[uid] = window;
            this.clean.register(() => {
                delete global.windows[uid];
            });
    
            return { type: WINDOW_REFERENCES.GLOBAL, uid };
        }

        if (target !== window) {
            throw new Error(`Can not currently create window reference for different target with a different domain`);
        }

        if (context === CONTEXT.POPUP) {
            return { type: WINDOW_REFERENCES.OPENER };
        }

        if (isTop(window)) {
            return { type: WINDOW_REFERENCES.TOP };
        }

        return { type: WINDOW_REFERENCES.PARENT, distance: getDistanceFromTop(window) };
    }

    buildWindowName({ proxyWin, initialDomain, domain, target, uid, context } : { proxyWin : ProxyWindow, initialDomain : string, domain : string | RegExp, target : CrossDomainWindowType, context : $Values<typeof CONTEXT>, uid : string }) : string {
        return buildChildWindowName(this.component.name, this.buildChildPayload({ proxyWin, initialDomain, domain, target, context, uid }));
    }

    getPropsRef(proxyWin : ProxyWindow, target : CrossDomainWindowType, domain : string | RegExp, uid : string) : PropRef {
        let value = serializeMessage(proxyWin, domain, this.getPropsForChild(domain));

        let propRef = isSameDomain(target)
            ? { type: INITIAL_PROPS.RAW, value }
            : { type: INITIAL_PROPS.UID, uid };

        if (propRef.type === INITIAL_PROPS.UID) {
            global.props[uid] = value;

            this.clean.register(() => {
                delete global.props[uid];
            });
        }

        return propRef;
    }

    buildChildPayload({ proxyWin, initialDomain, domain, target = window, context, uid } : { proxyWin : ProxyWindow, initialDomain : string, domain : string | RegExp, target : CrossDomainWindowType, context : $Values<typeof CONTEXT>, uid : string } = {}) : ChildPayload {

        let childPayload : ChildPayload = {
            uid,
            context,
            domain:  getDomain(window),
            tag:     this.component.tag,
            parent:  this.getWindowRef(target, initialDomain, uid, context),
            props:   this.getPropsRef(proxyWin, target, domain, uid),
            exports: serializeMessage(proxyWin, domain, this.buildParentExports(proxyWin))
        };

        return childPayload;
    }

    setProps(props : (PropsType & P)) {
        if (this.component.validate) {
            this.component.validate({ props });
        }

        // $FlowFixMe
        this.props = this.props || {};
        extend(this.props, normalizeProps(this.component, this, props, this.state));

        for (let key of this.component.getPropNames()) {
            let propDef = this.component.getProp(key);
            if (propDef.required !== false && !isDefined(this.props[key])) {
                throw new Error(`Expected prop "${ key }" to be defined`);
            }
        }
    }

    buildUrl() : ZalgoPromise<string> {
        return propsToQuery({ ...this.component.props, ...this.component.builtinProps }, this.props).then(query => {
            return extendUrl(normalizeMockUrl(this.component.getUrl(this.props)), { query });
        });
    }

    getDomain() : string | RegExp {
        return this.component.getDomain(this.props);
    }

    getInitialDomain() : string {
        return this.component.getInitialDomain(this.props);
    }

    getPropsForChild(domain : string | RegExp) : (BuiltInPropsType & P) {
        let result = {};

        for (let key of Object.keys(this.props)) {
            let prop = this.component.getProp(key);

            if (prop && prop.sendToChild === false) {
                continue;
            }

            if (prop && prop.sameDomain && !matchDomain(domain, getDomain(window))) {
                continue;
            }

            // $FlowFixMe
            result[key] = this.props[key];
        }

        // $FlowFixMe
        return result;
    }

    updateProps(props : (PropsType & P)) : ZalgoPromise<void> {
        this.setProps(props);

        return this.initPromise.then(() => {
            if (this.childExports) {
                return this.childExports.updateProps(this.getPropsForChild(this.getDomain()));
            } else {
                throw new Error(`Child exports were not available`);
            }
        });
    }
    
    open() : ZalgoPromise<ProxyWindow> {
        return ZalgoPromise.try(() => {
            this.component.log(`open`);

            let windowProp = this.props.window;

            if (windowProp) {
                this.clean.register(() => windowProp.close());
                // $FlowFixMe
                return windowProp;
            }

            return this.driver.open.call(this);
        });
    }

    setWindowName(proxyWin : ProxyWindow, name : string) : ZalgoPromise<ProxyWindow> {
        return proxyWin.setName(name);
    }

    switchPrerender() : ZalgoPromise<void> {
        return ZalgoPromise.try(() => {
            if (this.component.prerenderTemplate && this.driver.switchPrerender) {
                return this.driver.switchPrerender.call(this);
            }
        });
    }

    delegate(context : $Values<typeof CONTEXT>, target : CrossDomainWindowType) {
        this.component.log(`delegate`);

        let props = {};
        for (let propName of this.component.getPropNames()) {
            if (this.component.getProp(propName).allowDelegate) {
                props[propName] = this.props[propName];
            }
        }

        let delegateOverrides = send(target, `${ POST_MESSAGE.DELEGATE }_${ this.component.name }`, {
            context,
            props,
            overrides: {
                userClose: () => this.userClose(),
                error:     (err) => this.error(err)
            }

        }).then(({ data }) => {
            this.clean.register(data.destroy);
            return data.overrides;

        }).catch(err => {
            throw new Error(`Unable to delegate rendering. Possibly the component is not loaded in the target window.\n\n${ stringifyError(err) }`);
        });

        let overrides = this.driver.delegateOverrides;
        for (let key of Object.keys(overrides)) {
            if (overrides[key]) {
                // $FlowFixMe
                this[key] = function overridenFunction() : ZalgoPromise<mixed> {
                    return delegateOverrides.then(actualOverrides => {
                        return actualOverrides[key].apply(this, arguments);
                    });
                };
            }
        }
    }

    watchForClose(proxyWin : ProxyWindow) : ZalgoPromise<void> {
        return proxyWin.awaitWindow().then(win => {
            let closeWindowListener = onCloseWindow(win, () => {
                this.component.log(`detect_close_child`);

                return ZalgoPromise.all([
                    this.props.onClose(CLOSE_REASONS.CLOSE_DETECTED),
                    this.destroy()
                ]);
            }, 3000);

            this.clean.register(closeWindowListener.cancel);
        });
    }

    watchForUnload() {
        let unloadWindowListener = addEventListener(window, 'unload', once(() => {
            this.component.log(`navigate_away`);
            this.destroy();
        }));

        this.clean.register(unloadWindowListener.cancel);
    }

    loadUrl(proxyWin : ProxyWindow, url : string) : ZalgoPromise<ProxyWindow> {
        this.component.log(`load_url`);
        return proxyWin.setLocation(url);
    }

    runTimeout() {
        let timeout = this.props.timeout;

        if (timeout) {
            let id = this.timeout = setTimeout(() => {
                this.component.log(`timed_out`, { timeout: timeout.toString() });
                this.error(this.component.createError(`Loading component timed out after ${ timeout } milliseconds`));
            }, timeout);

            this.clean.register(() => {
                clearTimeout(id);
                delete this.timeout;
            });
        }
    }

    initChild(childExports : ChildExportsType<P>) : ZalgoPromise<void> {
        return ZalgoPromise.try(() => {
            this.childExports = childExports;
            this.initPromise.resolve(this);
    
            if (this.timeout) {
                clearTimeout(this.timeout);
            }
        });
    }

    buildParentExports(win : ProxyWindow) : ParentExportsType<P> {
        return {
            init:       (childExports) => this.initChild(childExports),
            close:      (reason) => this.close(reason),
            checkClose: () => this.checkClose(win),
            resize:     ({ width, height }) => this.resize({ width, height }),
            hide:       () => ZalgoPromise.try(() => this.hide()),
            show:       () => ZalgoPromise.try(() => this.show()),
            error:      (err) => this.error(err)
        };
    }

    resize({ width, height } : { width? : ?number, height? : ?number }) : ZalgoPromise<void> {
        return ZalgoPromise.try(() => {
            this.driver.resize.call(this, { width, height });
        });
    }

    hide() : void {

        if (this.container) {
            hideElement(this.container);
        }

        return this.driver.hide.call(this);
    }

    show() : void {

        if (this.container) {
            showElement(this.container);
        }

        return this.driver.show.call(this);
    }


    checkClose(win : ProxyWindow) : ZalgoPromise<void> {
        return win.isClosed().then(closed => {
            if (closed) {
                return this.userClose();
            }

            return ZalgoPromise.delay(200)
                .then(() => win.isClosed())
                .then(secondClosed => {
                    if (secondClosed) {
                        return this.userClose();
                    }
                });
        });
    }


    userClose() : ZalgoPromise<void> {
        return this.close(CLOSE_REASONS.USER_CLOSED);
    }

    @memoized
    close(reason? : string = CLOSE_REASONS.PARENT_CALL) : ZalgoPromise<void> {
        return ZalgoPromise.try(() => {
            this.component.log(`close`, { reason });
            return this.props.onClose(reason);
        }).then(() => {
            if (this.childExports && this.driver.callChildToClose) {
                this.childExports.close.fireAndForget().catch(noop);
            }

            return this.destroy();
        });
    }

    @memoized
    showComponent() : ZalgoPromise<void> {
        return ZalgoPromise.try(() => this.props.onDisplay());
    }

    prerender(proxyWin : ProxyWindow, { context, uid } : { context : $Values<typeof CONTEXT>, uid : string }) : ZalgoPromise<void> {
        return ZalgoPromise.try(() => {
            if (!this.component.prerenderTemplate) {
                return;
            }

            return ZalgoPromise.try(() => {
                return proxyWin.awaitWindow();

            }).then(win => {
                return this.driver.openPrerender.call(this, win);
                
            }).then(prerenderWindow => {
                if (!prerenderWindow || !isSameDomain(prerenderWindow) || !isBlankDomain(prerenderWindow)) {
                    return;
                }
        
                let doc = prerenderWindow.document;
                let el = this.renderTemplate(this.component.prerenderTemplate, { context, uid, document: doc });
    
                try {
                    writeElementToWindow(prerenderWindow, el);
                } catch (err) {
                    return;
                }

                let { width = false, height = false, element = 'body' } = this.component.autoResize || {};
                
                if (width || height) {
                    onResize(getElement(element, prerenderWindow.document), ({ width: newWidth, height: newHeight }) => {
                        this.resize({
                            width:  width ? newWidth : undefined,
                            height: height ? newHeight : undefined
                        });
                    }, { width, height, win: prerenderWindow });
                }
            });
        });
    }

    renderTemplate(renderer : (RenderOptionsType<P>) => HTMLElement, { context, uid, focus, container, document, outlet } : { context : $Values<typeof CONTEXT>, uid : string, focus? : () => ZalgoPromise<ProxyWindow>, container? : HTMLElement, document? : Document, outlet? : HTMLElement }) : HTMLElement {
        focus = focus || (() => ZalgoPromise.resolve());

        // $FlowFixMe
        return renderer.call(this, {
            context,
            uid,
            state:     this.state,
            props:     renderer.__xdomain__ ? null : this.props,
            tag:       this.component.tag,
            actions:   {
                focus,
                close: () => this.userClose()
            },
            doc:        document,
            dimensions: this.component.dimensions,
            container,
            outlet
        });
    }

    openContainer(element : HTMLElement, { context, uid, focus } : { context : $Values<typeof CONTEXT>, uid : string, focus : () => ZalgoPromise<ProxyWindow> }) : ZalgoPromise<void> {
        return ZalgoPromise.try(() => {
            return elementReady(element);

        }).then(() => {
            if (!this.component.containerTemplate) {
                if (this.driver.renderedIntoContainer) {
                    throw new Error(`containerTemplate needed to render ${ context }`);
                }

                return;
            }

            let el = getElement(element);

            let outlet = document.createElement('div');
            addClass(outlet, CLASS.OUTLET);

            this.container = this.renderTemplate(this.component.containerTemplate, { context, uid, container: el, focus, outlet });
            appendChild(el, this.container);

            if (this.driver.renderedIntoContainer) {
                this.element = outlet;
            }

            this.clean.register(() => {
                destroyElement(this.container);
                delete this.container;
            });
        });
    }

    destroy() : ZalgoPromise<void> {
        return ZalgoPromise.try(() => {
            if (this.clean.hasTasks()) {
                this.component.log(`destroy`);
                return this.clean.all();
            }
        });
    }

    tryInit(method : () => mixed) : ZalgoPromise<ParentComponent<P>> {
        return ZalgoPromise.try(method).catch(err => {
            this.initPromise.reject(err);
        }).then(() => {
            return this.initPromise;
        });
    }

    error(err : mixed, onError? : onErrorPropType) : ZalgoPromise<void> {
        if (this.errored) {
            return ZalgoPromise.resolve();
        }

        this.errored = true;

        if (!onError && this.props && this.props.onError) {
            onError = this.props.onError;
        }

        // eslint-disable-next-line promise/no-promise-in-callback
        return ZalgoPromise.try(() => {
            this.initPromise = this.initPromise || new ZalgoPromise();
            this.initPromise.reject(err);

            return this.destroy();

        }).then(() => {
            if (onError) {
                return onError(err);
            }

        }).catch(errErr => { // eslint-disable-line unicorn/catch-error-name
            throw new Error(`An error was encountered while handling error:\n\n ${ stringifyError(err) }\n\n${ stringifyError(errErr) }`);

        }).then(() => {
            if (!onError) {
                throw err;
            }
        });
    }

    openBridge(proxyWin : ProxyWindow, domain : string, context : $Values<typeof CONTEXT>) : ZalgoPromise<?CrossDomainWindowType> {
        return ZalgoPromise.try(() => {
            return proxyWin.awaitWindow();
            
        }).then(win => {
            if (!bridge || !bridge.needsBridge({ win, domain }) || bridge.hasBridge(domain, domain)) {
                return;
            }

            let bridgeUrl = this.component.getBridgeUrl();

            if (!bridgeUrl) {
                throw new Error(`Bridge url and domain needed to render ${ context }`);
            }

            let bridgeDomain = getDomainFromUrl(bridgeUrl);
            bridge.linkUrl(win, domain);
            return bridge.openBridge(bridgeUrl, bridgeDomain);
        });
    }
}
