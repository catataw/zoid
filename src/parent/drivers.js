/* @flow */

import { ZalgoPromise } from 'zalgo-promise/src';
import { cleanUpWindow, ProxyWindow } from 'post-robot/src';
import { type CrossDomainWindowType, type SameDomainWindowType, assertSameDomain, isSameDomain } from 'cross-domain-utils/src';
import { iframe, popup, toCSS, showElement, hideElement,
    destroyElement, normalizeDimension, watchElementForClose,
    awaitFrameWindow, addClass, removeClass, uniqueID } from 'belter/src';

import { CONTEXT, CLOSE_REASONS, CLASS, DEFAULT_DIMENSIONS } from '../constants';


export type ContextDriverType = {

    renderedIntoContainer : boolean,
    callChildToClose : boolean,

    open : () => ZalgoPromise<ProxyWindow>,
    resize : ({ width? : ?(number | string), height? : ?(number | string) }) => void,
    show : () => void,
    hide : () => void,

    delegateOverrides : {
        [string] : boolean
    },

    openPrerender : (CrossDomainWindowType) => ZalgoPromise<?SameDomainWindowType>,
    switchPrerender? : () => void
};

/*  Render Drivers
    --------------

    There are various differences in how we treat:

    - Opening frames and windows
    - Rendering up to the parent
    - Resizing
    - etc.

    based on the context we're rendering to.

    These render drivers split this functionality out in a driver pattern, so our component code doesn't bunch up into a
    series of if-popup-then-else-if-iframe code.
*/

export let RENDER_DRIVERS : { [string] : ContextDriverType } = {};

// Iframe context is rendered inline on the page, without any kind of parent template. It's the one context that is designed
// to feel like a native element on the page.

RENDER_DRIVERS[CONTEXT.IFRAME] = {

    renderedIntoContainer: true,
    callChildToClose:      false,

    open() : ZalgoPromise<ProxyWindow> {

        let attributes = this.component.attributes.iframe || {};

        let frame = iframe({
            attributes: {
                title: this.component.name,
                ...attributes
            },
            class: [
                CLASS.COMPONENT_FRAME,
                CLASS.INVISIBLE
            ]
        }, this.element);

        this.clean.set('iframe', frame);

        return awaitFrameWindow(frame).then(win => {

            let detectClose = () => {
                return ZalgoPromise.try(() => {
                    return this.props.onClose(CLOSE_REASONS.CLOSE_DETECTED);
                }).finally(() => {
                    return this.destroy();
                });
            };

            let iframeWatcher = watchElementForClose(frame, detectClose);
            let elementWatcher = watchElementForClose(this.element, detectClose);

            this.clean.register(() => {
                iframeWatcher.cancel();
                elementWatcher.cancel();
                cleanUpWindow(win);
                destroyElement(frame);
            });

            return ProxyWindow.toProxyWindow(win);
        });
    },

    openPrerender() : ZalgoPromise<?SameDomainWindowType> {

        let attributes = this.component.attributes.iframe || {};

        let prerenderIframe = iframe({
            attributes: {
                name: `__zoid_prerender_frame__${ this.component.name }_${ uniqueID() }__`,
                ...attributes
            },
            class: [
                CLASS.PRERENDER_FRAME,
                CLASS.VISIBLE
            ]
        }, this.element);

        this.clean.set('prerenderIframe', prerenderIframe);

        return awaitFrameWindow(prerenderIframe).then(prerenderFrameWindow => {

            this.clean.register(() => {
                destroyElement(prerenderIframe);
            });

            return assertSameDomain(prerenderFrameWindow);
        });
    },

    switchPrerender() {

        addClass(this.prerenderIframe, CLASS.INVISIBLE);
        removeClass(this.prerenderIframe, CLASS.VISIBLE);
        addClass(this.iframe, CLASS.VISIBLE);
        removeClass(this.iframe, CLASS.INVISIBLE);

        setTimeout(() => {
            if (this.prerenderIframe) {
                destroyElement(this.prerenderIframe);
            }
        }, 1);
    },

    delegateOverrides: {
        openContainer:           true,
        destroyComponent:        true,
        destroyContainer:        true,
        cancelContainerEvents:   true,
        prerender:               true,
        elementReady:            true,
        showContainer:           true,
        showComponent:           true,
        hideContainer:           true,
        hideComponent:           true,
        hide:                    true,
        show:                    true,
        resize:                  true,
        loadUrl:                 true,
        openPrerender:           true,
        switchPrerender:         true,
        setWindowName:           true,
        open:                    true
    },

    resize({ width, height } : { width? : ?(number | string), height? : ?(number | string) }) {

        if (typeof width === 'number') {
            this.container.style.width = toCSS(width);
            this.element.style.width   = toCSS(width);
        }

        if (typeof height === 'number') {
            this.container.style.height = toCSS(height);
            this.element.style.height = toCSS(height);
        }
    },

    show() {
        showElement(this.element);
    },

    hide() {
        hideElement(this.element);
    }
};

if (__ZOID__.__POPUP_SUPPORT__) {

    // Popup context opens up a centered popup window on the page.

    RENDER_DRIVERS[CONTEXT.POPUP] = {
        
        renderedIntoContainer: false,
        callChildToClose:      true,

        open() : ZalgoPromise<ProxyWindow> {
            return ZalgoPromise.try(() => {

                let {
                    width = DEFAULT_DIMENSIONS.WIDTH,
                    height = DEFAULT_DIMENSIONS.HEIGHT
                } = this.component.dimensions || {};

                width = normalizeDimension(width, window.outerWidth);
                height = normalizeDimension(height, window.outerWidth);

                let attributes = this.component.attributes.popup || {};
                let win = popup('', { width, height, ...attributes });

                this.clean.register(() => {
                    win.close();
                    cleanUpWindow(win);
                });

                return ProxyWindow.toProxyWindow(win);
            });
        },

        openPrerender(win : CrossDomainWindowType) : ZalgoPromise<?SameDomainWindowType> {
            return ZalgoPromise.try(() => {
                if (isSameDomain(win)) {
                    return assertSameDomain(win);
                }
            });
        },

        resize() {
            // pass
        },

        hide() {
            throw new Error('Can not hide popup');
        },

        show() {
            throw new Error('Can not show popup');
        },

        delegateOverrides: {

            openContainer:          true,
            destroyContainer:       true,

            elementReady:           true,

            showContainer:          true,
            showComponent:          true,
            hideContainer:          true,
            hideComponent:          true,

            hide:                   true,
            show:                   true,

            cancelContainerEvents:  true
        }
    };
}
