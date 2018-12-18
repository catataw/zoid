/* @flow */

import { assert } from 'chai';

import zoid, { CONTEXT } from '../../src';
import { testComponent, testComponent3 } from '../component';
import { onWindowOpen } from '../common';

describe('zoid error cases', () => {

    it('should error out when window.open returns a closed window', done => {

        let windowOpen = window.open;

        window.open = () => {
            return {
                closed: true,
                close() { /* pass */ }
            };
        };

        testComponent.render({
            onRendered: done

        }, 'body', CONTEXT.POPUP).catch(err => {
            assert.isTrue(err instanceof zoid.PopupOpenError, 'Expected PopupOpenError when popup is not opened');
            window.open = windowOpen;
            done();
        });
    });

    it('should enter a component, throw an integration error, and return the error to the parent with the original stack', done => {

        testComponent.render({

            onError(err) {
                // $FlowFixMe
                assert.isTrue(err && err.message.indexOf('xxxxx') !== -1, 'Expected error to contain original error');
                done();
            },

            run: `
                window.xchild.error(new Error('xxxxx'));
            `
        }, document.body, CONTEXT.IFRAME);
    });

    it('should enter a component and timeout, then call onError', done => {

        testComponent.render({
            timeout: 1,
            onError() {
                done();
            }
        }, document.body, CONTEXT.IFRAME);
    });

    it('should try to render a component to an unsupported context and error out', done => {

        // $FlowFixMe
        testComponent3.render(null, 'moo').catch(() => {
            done();
        });
    });

    it('should run validate function on props, and pass up error when thrown', done => {
        testComponent.render({
            validateProp: 'foo'
        }, 'body', CONTEXT.POPUP).catch(() => {
            done();
        });
    });

    it('should run validate function on props, and call onError when error is thrown', done => {
        testComponent.render({
            validateProp: 'foo',

            onError() {
                done();
            }
        }, 'body', CONTEXT.POPUP);
    });

    it('should run validate function on component, and pass up error when thrown', done => {
        testComponent.render({
            invalidate: true
        }, 'body', CONTEXT.POPUP).catch(() => {
            done();
        });
    });

    it('should run validate function on props, and call onError when error is thrown', done => {
        testComponent.render({
            invalidate: true,

            onError() {
                done();
            }
        }, 'body', CONTEXT.POPUP);
    });

    it('should call onclose when a popup is closed by someone other than zoid', done => {

        onWindowOpen().then(openedWindow => {
            setTimeout(() => {
                openedWindow.close();
            }, 200);
        });

        testComponent.render({
            onClose() {
                done();
            }
        }, 'body', CONTEXT.POPUP);
    });

    it('should call onclose when an iframe is closed by someone other tha zoid', done => {

        testComponent.render({

            onRendered() {
                setTimeout(() => {
                    this.iframe.parentNode.removeChild(this.iframe);
                }, 10);
            },

            onClose() {
                done();
            }
        }, document.body, CONTEXT.IFRAME);
    });
});
