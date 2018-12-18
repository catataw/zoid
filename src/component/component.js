/* @flow */
/* eslint max-lines: 0 */

import { on, send } from 'post-robot/src';
import { ZalgoPromise } from 'zalgo-promise/src';
import { getDomainFromUrl, type CrossDomainWindowType, isSameTopWindow, getDomain, matchDomain, isSameDomain } from 'cross-domain-utils/src';
import { memoize, isRegex, noop, isElement } from 'belter/src';

import { ChildComponent } from '../child';
import { ParentComponent, type RenderOptionsType } from '../parent';
import { DelegateComponent, type DelegateOptionsType } from '../delegate';
import { CONTEXT, POST_MESSAGE, WILDCARD, DEFAULT_DIMENSIONS } from '../constants';
import { info, error, warn, isZoidComponentWindow, parseChildWindowName } from '../lib';
import type { CssDimensionsType, StringMatcherType, ElementRefType } from '../types';

import { validate } from './validate';
import { defaultContainerTemplate, defaultPrerenderTemplate } from './templates';
import { getInternalProps, type UserPropsDefinitionType, type BuiltInPropsDefinitionType, type PropsType, type BuiltInPropsType, type MixedPropDefinitionType } from './props';


const drivers = __ZOID__.__FRAMEWORK_SUPPORT__
    ? require('../drivers')
    : {};

/*  Component
    ---------

    This is the spec for the component. The idea is, when I call zoid.create(), it will create a new instance
    of Component with the blueprint needed to set up ParentComponents and ChildComponents.

    This is the one portion of code which is required by -- and shared to -- both the parent and child windows, and
    contains all of the configuration needed for them to set themselves up.
*/

export type ComponentOptionsType<P> = {

    tag : string,

    url : string | ({ props : BuiltInPropsType & P }) => string,
    domain? : string | RegExp,
    bridgeUrl? : string,

    props? : UserPropsDefinitionType<P>,

    dimensions? : CssDimensionsType,
    autoResize? : { width? : boolean, height? : boolean, element? : string },

    allowedParentDomains? : StringMatcherType,

    attributes? : {
        iframe? : { [string] : string },
        popup? : { [string] : string }
    },

    defaultContext? : $Values<typeof CONTEXT>,

    containerTemplate? : (RenderOptionsType<P>) => HTMLElement,
    prerenderTemplate? : (RenderOptionsType<P>) => HTMLElement,

    validate? : ({ props : (PropsType & P) }) => void
};

export type ComponentDriverType<P, T : mixed> = {
    global : () => ?T,
    register : (Component<P>, T) => mixed
};

export class Component<P> {

    tag : string
    name : string
    
    url : string | ({ props : BuiltInPropsType & P }) => string
    domain : void | string | RegExp
    bridgeUrl : void | string

    props : UserPropsDefinitionType<P>
    builtinProps : BuiltInPropsDefinitionType<P>

    dimensions : void | CssDimensionsType
    autoResize : void | { width? : boolean, height? : boolean, element? : string }

    allowedParentDomains : StringMatcherType

    defaultContext : $Values<typeof CONTEXT>
    
    attributes : {
        iframe? : { [string] : string },
        popup? : { [string] : string }
    }

    containerTemplate : (RenderOptionsType<P>) => HTMLElement
    prerenderTemplate : (RenderOptionsType<P>) => HTMLElement

    validate : void | ({ props : (PropsType & P) }) => void

    driverCache : { [string] : mixed }

    xchild : ?ChildComponent<P>
    xprops : ?P

    constructor(options : ComponentOptionsType<P>) {
        validate(options);

        // The tag name of the component. Used by some drivers (e.g. angular) to turn the component into an html element,
        // e.g. <my-component>

        this.tag = options.tag;
        this.name = this.tag.replace(/-/g, '_');

        this.allowedParentDomains = options.allowedParentDomains || WILDCARD;

        if (Component.components[this.tag]) {
            throw new Error(`Can not register multiple components with the same tag`);
        }

        // A json based spec describing what kind of props the component accepts. This is used to validate any props before
        // they are passed down to the child.

        this.builtinProps = getInternalProps();
        this.props = options.props || {};

        // The dimensions of the component, e.g. { width: '300px', height: '150px' }

        let { width = DEFAULT_DIMENSIONS.WIDTH, height = DEFAULT_DIMENSIONS.HEIGHT } = options.dimensions || {};
        this.dimensions = { width, height };

        this.url = options.url;
        this.domain = options.domain;
        this.bridgeUrl = options.bridgeUrl;

        this.attributes = options.attributes || {};
        this.defaultContext = options.defaultContext || CONTEXT.IFRAME;

        this.autoResize = options.autoResize;

        this.containerTemplate = options.containerTemplate || defaultContainerTemplate;
        this.prerenderTemplate = options.prerenderTemplate || defaultPrerenderTemplate;

        this.validate = options.validate;

        Component.components[this.tag] = this;

        // Register all of the drivers for instantiating components. The model used is -- there's a standard javascript
        // way of rendering a component, then each other technology (e.g. react) needs to hook into that interface.
        // This makes us a little more pluggable and loosely coupled.
        this.registerDrivers();
        this.registerChild();
        this.listenDelegate();
    }

    @memoize
    getPropNames() : Array<string> {
        let props = Object.keys(this.props);

        for (let key of Object.keys(this.builtinProps)) {
            if (props.indexOf(key) === -1) {
                props.push(key);
            }
        }

        return props;
    }

    // $FlowFixMe
    getProp(name : string) : MixedPropDefinitionType<P> {
        // $FlowFixMe
        return this.props[name] || this.builtinProps[name];
    }

    registerDrivers() {
        this.driverCache = {};

        for (let driverName of Object.keys(drivers)) {
            if (driverName.indexOf('_') === 0) {
                continue;
            }

            let driver = drivers[driverName];
            let glob = driver.global();
            if (glob) {
                this.driver(driverName, glob);
            }
        }
    }

    driver(name : string, dep : mixed) : mixed {
        if (!drivers[name]) {
            throw new Error(`Could not find driver for framework: ${ name }`);
        }

        if (!this.driverCache[name]) {
            this.driverCache[name] = drivers[name].register(this, dep);
        }

        return this.driverCache[name];
    }

    registerChild() : ZalgoPromise<?ChildComponent<P>> {
        return ZalgoPromise.try(() => {
            if (this.isChild()) {
                return new ChildComponent(this);
            }
        });
    }

    listenDelegate() {
        on(`${ POST_MESSAGE.ALLOW_DELEGATE }_${ this.name }`, () => {
            return true;
        });

        on(`${ POST_MESSAGE.DELEGATE }_${ this.name }`, ({ source, data: { context, props, overrides } }) => {
            return this.delegate(source, { context, props, overrides }).getDelegate();
        });
    }

    canRenderTo(win : CrossDomainWindowType) : ZalgoPromise<boolean> {
        return send(win, `${ POST_MESSAGE.ALLOW_DELEGATE }_${ this.name }`).then(({ data }) => {
            return data;
        }).catch(() => {
            return false;
        });
    }

    getUrl(props : BuiltInPropsType & P) : string {
        if (typeof this.url === 'function') {
            return this.url({ props });
        } else if (typeof this.url === 'string') {
            return this.url;
        }

        throw new Error(`Can not find url`);
    }

    getInitialDomain(props : BuiltInPropsType & P) : string {
        if (this.domain && typeof this.domain === 'string') {
            return this.domain;
        }

        return getDomainFromUrl(this.getUrl(props));
    }

    getDomain(props : BuiltInPropsType & P) : string | RegExp {
        if (isRegex(this.domain)) {
            // $FlowFixMe
            return this.domain;
        }

        return this.getInitialDomain(props);
    }

    getBridgeUrl() : ?string {
        if (this.bridgeUrl) {
            return this.bridgeUrl;
        }
    }

    isZoidComponent() : boolean {
        return isZoidComponentWindow();
    }

    isChild() : boolean {
        return isZoidComponentWindow() && parseChildWindowName().tag === this.tag;
    }


    createError(message : string, tag : ?string) : Error {
        return new Error(`[${ tag || this.tag  }] ${ message }`);
    }

    delegate(source : CrossDomainWindowType, options : DelegateOptionsType) : DelegateComponent<P> {
        return new DelegateComponent(this, source, options);
    }

    getDefaultElement(context : $Values<typeof CONTEXT>, element : ?ElementRefType) : ElementRefType {
        if (element) {
            if (!isElement(element) && typeof element !== 'string') {
                throw new Error(`Expected element to be passed`);
            }

            return element;
        }

        if (context === CONTEXT.POPUP) {
            return 'body';
        }

        throw new Error(`Expected element to be passed to render iframe`);
    }

    getDefaultContext(context : ?$Values<typeof CONTEXT>) : $Values<typeof CONTEXT> {
        if (context) {
            if (context !== CONTEXT.IFRAME && context !== CONTEXT.POPUP) {
                throw new Error(`Unrecognized context: ${ context }`);
            }
            
            return context;
        }

        return this.defaultContext;
    }

    render(props : (PropsType & P), element? : ElementRefType, context? : $Values<typeof CONTEXT>) : ZalgoPromise<ParentComponent<P>> {
        return ZalgoPromise.try(() => {
            context = this.getDefaultContext(context);
            element = this.getDefaultElement(context, element);
            return new ParentComponent(this, context, { props }).render(window, context, element);
        });
    }

    renderTo(target : CrossDomainWindowType, props : (PropsType & P), element? : ElementRefType, context? : $Values<typeof CONTEXT>) : ZalgoPromise<ParentComponent<P>> {
        return ZalgoPromise.try(() => {
            context = this.getDefaultContext(context);
            element = this.getDefaultElement(context, element);
            return new ParentComponent(this, context, { props }).render(target, context, element);
        });
    }

    checkAllowRemoteRender(target : CrossDomainWindowType, domain : string | RegExp, element : ElementRefType) {
        if (!target) {
            throw this.createError(`Must pass window to renderTo`);
        }

        if (target === window) {
            return;
        }

        if (!isSameTopWindow(window, target)) {
            throw new Error(`Can only renderTo an adjacent frame`);
        }

        let origin = getDomain();

        if (!matchDomain(domain, origin) && !isSameDomain(target)) {
            throw new Error(`Can not render remotely to ${ domain.toString() } - can only render to ${ origin }`);
        }

        if (element && typeof element !== 'string') {
            throw new Error(`Element passed to renderTo must be a string selector, got ${ typeof element } ${ element }`);
        }
    }

    /*  Log
        ---

        Log an event using the component name
    */

    log(event : string, payload : { [ string ] : string } = {}) {
        info(this.name, event, payload);
    }


    /*  Log Warning
        -----------

        Log a warning
    */

    logWarning(event : string, payload : { [ string ] : string }) {
        warn(this.name, event, payload);
    }


    /*  Log Error
        ---------

        Log an error
    */

    logError(event : string, payload : { [ string ] : string }) {
        error(this.name, event, payload);
    }

    static components : { [string] : Component<*> } = {}

    static getByTag<T>(tag : string) : Component<T> {
        return Component.components[tag];
    }

    static activeComponents : Array<ParentComponent<*> | DelegateComponent<*>> = []

    registerActiveComponent<Q>(instance : ParentComponent<Q> | DelegateComponent<Q>) {
        Component.activeComponents.push(instance);
    }

    destroyActiveComponent<Q>(instance : ParentComponent<Q> | DelegateComponent<Q>) {
        Component.activeComponents.splice(Component.activeComponents.indexOf(instance), 1);
    }

    static destroyAll() : ZalgoPromise<void> {
        let results = [];

        while (Component.activeComponents.length) {
            results.push(Component.activeComponents[0].destroy());
        }

        return ZalgoPromise.all(results).then(noop);
    }
}
