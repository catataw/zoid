/* @flow */

import { onCloseWindow } from 'cross-domain-utils/src';
import { once, getElement } from 'belter/src';

import { testComponent } from '../component';
import { onWindowOpen } from '../common';

describe('zoid render to parent', () => {

    it('should render a component to the parent as an iframe', done => {

        testComponent.render({
            foo: done,

            run: `
                zoid.getByTag('test-component2').renderTo(window.parent, {
                    onRendered: function() {
                        return window.xprops.foo();
                    }
                }, 'body');
            `
        }, document.body);
    });

    it('should render a component to the parent as a popup', done => {

        testComponent.render({
            foo: done,

            run: `
                zoid.getByTag('test-component2').renderTo(window.parent, {
                    onRendered: function() {
                        return window.xprops.foo();
                    }
                }, 'body', zoid.CONTEXT.POPUP);
            `
        }, document.body);
    });

    it('should render a component to the parent as an iframe', done => {

        testComponent.render({
            foo() {
                done();
            },

            run: `
                zoid.getByTag('test-component2').renderTo(window.parent, {
                    onRendered: function() {
                        return window.xprops.foo();
                    }
                }, 'body');
            `
        }, document.body);
    });

    it('should render a component to the parent as an iframe and call a prop', done => {

        testComponent.render({
            foo: done,

            run: `
                zoid.getByTag('test-component2').renderTo(window.parent, {
                    foo: function() {
                        window.xprops.foo();
                    },

                    run: 'window.xprops.foo();'

                }, 'body');
            `
        }, document.body);
    });

    it('should render a component to the parent as an iframe and call a prop', done => {

        testComponent.render({
            foo: done,

            run: `
                zoid.getByTag('test-component2').renderTo(window.parent, {
                    foo: function() {
                        window.xprops.foo();
                    },

                    run: 'window.xprops.foo();'

                }, 'body');
            `
        }, document.body);
    });


    it('should render a component to the parent as a popup and call a prop', done => {

        testComponent.render({
            foo: done,

            run: `
                zoid.getByTag('test-component2').renderTo(window.parent, {
                    foo: function() {
                        window.xprops.foo();
                    },

                    run: 'window.xprops.foo();'

                }, 'body', zoid.CONTEXT.POPUP);
            `
        }, document.body);
    });

    it('should render a component to the parent as an iframe and close on enter', done => {

        testComponent.render({
            onClose: () => done(),

            run: `
                zoid.getByTag('test-component2').renderTo(window.parent, {
                    onRendered: function() {
                        this.close();
                    },

                    onClose: function() {
                        window.xchild.close();
                    }
                }, 'body');
            `
        }, document.body);
    });

    it('should close a zoid renderToParent iframe on click of the overlay close button', done => {

        let win;

        testComponent.render({
            foo: () => {
                onWindowOpen().then(openedWin => {
                    win = openedWin;
                });
            },

            childEntered: () => {
                onCloseWindow(win, () => {
                    done();
                }, 50);

                getElement('#test-component2-test-close').click();
            },

            run: `
                window.xprops.foo().then(function() {
                    zoid.getByTag('test-component2').renderTo(window.parent, {

                        onRendered: function() {
                            return window.xprops.childEntered();
                        }
    
                    }, 'body');
                });
            `
        }, document.body);
    });

    it('should close a zoid renderToParent popup on click of the overlay close button', done => {

        testComponent.render({

            childEntered: () => {
                getElement('#test-component2-test-close').click();
            },

            foo: () => done(),

            run: `
                var win;

                onWindowOpen().then(function(openedWindow) {
                    win = openedWindow;
                });

                zoid.getByTag('test-component2').renderTo(window.parent, {

                    onRendered: function() {

                        var winClose = win.close;
                        win.close = function() {
                            winClose.apply(this, arguments);
                            window.xprops.foo();
                        };

                        return window.xprops.childEntered();
                    }

                }, 'body', zoid.CONTEXT.POPUP);
            `
        }, document.body);
    });

    it('should focus a zoid renderToParent popup on click of the overlay', done => {
        done = once(done);

        testComponent.render({

            childEntered: () => {
                getElement('#test-component2-test-focus').click();
            },

            foo: () => done(),

            run: `
                var win;

                onWindowOpen().then(function(openedWindow) {
                    win = openedWindow;
                });

                zoid.getByTag('test-component2').renderTo(window.parent, {

                    onRendered: function() {

                        win.focus = function() {
                            window.xprops.foo();
                        };

                        return window.xprops.childEntered();
                    }

                }, 'body', zoid.CONTEXT.POPUP);
            `
        }, document.body);
    });
});
