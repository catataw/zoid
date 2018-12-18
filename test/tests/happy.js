/* @flow */

import { assert } from 'chai';

import { testComponent } from '../component';
import { CONTEXT } from '../../src';

describe('zoid happy cases', () => {

    it('should enter a component rendered as an iframe', done => {

        testComponent.render({
            onRendered: done
        }, document.body);
    });

    it('should enter a component rendered as an iframe and call a prop', done => {

        testComponent.render({

            foo(bar) {
                assert.equal(bar, 'bar');
                done();
            },

            run: `
                window.xprops.foo('bar');
            `
        }, document.body);
    });

    it('should enter a component rendered as an iframe', done => {

        testComponent.render({
            onRendered: done
        }, document.body);
    });

    it('should enter a component rendered as an iframe and call a prop', done => {

        testComponent.render({

            foo(bar) {
                assert.equal(bar, 'bar');
                done();
            },

            run: `
                window.xprops.foo('bar');
            `
        }, document.body);
    });

    it('should enter a component rendered as a popup', done => {

        testComponent.render({
            onRendered: done
        }, 'body', CONTEXT.POPUP);
    });

    it('should enter a component rendered as a popup and call a prop', done => {

        testComponent.render({

            foo(bar) {
                assert.equal(bar, 'bar');
                done();
            },

            run: `
                window.xprops.foo('bar');
            `
        }, 'body', CONTEXT.POPUP);
    });

    it('should enter a component, update a prop, and call a prop', done => {

        let isDone = false;

        testComponent.render({

            foo() {
                this.updateProps({
                    foo(bar) {
                        if (!isDone) {
                            isDone = true;
                            assert.equal(bar, 'bar');
                            done();
                        }
                    }
                });
            },

            run: `
                window.xprops.foo();

                window.xchild.onProps(function() {
                    window.xprops.foo('bar');
                });
            `
        }, document.body);
    });

    it('should try to render by passing in an element', done => {

        testComponent.render({
            onRendered: done
        }, document.body);
    });

    it('should try to render to defaultContext iframe', done => {

        let originalDefaultContext = testComponent.defaultContext;
        testComponent.defaultContext = 'iframe';

        testComponent.render({
            onRendered() {
                testComponent.defaultContext = originalDefaultContext;
                done();
            }
        }, document.body);
    });

    it('should try to render to defaultContext iframe using renderTo', done => {
        
        let originalDefaultContext = testComponent.defaultContext;
        testComponent.defaultContext = 'iframe';

        testComponent.renderTo(window, {
            onRendered() {
                testComponent.defaultContext = originalDefaultContext;
                done();
            }
        }, 'body');
    });

    it('should try to render to defaultContext popup', done => {

        let originalDefaultContext = testComponent.defaultContext;
        testComponent.defaultContext = 'popup';

        testComponent.render({
            onRendered() {
                testComponent.defaultContext = originalDefaultContext;
                done();
            }
        });
    });

    it('should enter a component and call back with a string prop', done => {

        testComponent.render({

            stringProp: 'bar',

            foo(result) {
                assert.equal(result, 'bar');
                done();
            },

            run: `
                window.xprops.foo(window.xprops.stringProp);
            `
        }, document.body);
    });

    it('should enter a component and call back with a number prop', done => {

        testComponent.render({

            numberProp: 123,

            foo(result) {
                assert.equal(result, 123);
                done();
            },

            run: `
                window.xprops.foo(window.xprops.numberProp);
            `
        }, document.body);
    });

    it('should enter a component and call back with a boolean prop', done => {

        testComponent.render({

            booleanProp: true,

            foo(result) {
                assert.equal(result, true);
                done();
            },

            run: `
                window.xprops.foo(window.xprops.booleanProp);
            `
        }, document.body);
    });

    it('should enter a component and call back with an object prop', done => {

        testComponent.render({

            objectProp: { foo: 'bar', x: 12345, fn() { done(); }, obj: { bar: 'baz' } },

            foo(result) {
                assert.equal(result.foo, 'bar');
                assert.equal(result.obj.bar, 'baz');
                assert.equal(result.x, 12345);
                assert.isTrue(result.fn instanceof Function);
                result.fn();
            },

            run: `
                window.xprops.foo(window.xprops.objectProp);
            `
        }, document.body);
    });

    it('should enter a component and call back with a function prop', done => {

        testComponent.render({

            functionProp: done,

            foo(result) {
                assert.isTrue(result instanceof Function);
                result();
            },

            run: `
                window.xprops.foo(window.xprops.functionProp);
            `
        }, document.body);
    });
});
