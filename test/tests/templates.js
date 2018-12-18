/* @flow */

import { onCloseWindow } from 'cross-domain-utils/src';
import { once, getElement } from 'belter/src';

import { testComponent } from '../component';
import { onWindowOpen } from '../common';
import { CONTEXT } from '../../src';

describe('zoid templates and styles', () => {

    it('should focus a zoid popup on click of the overlay', done => {
        done = once(done);

        let win;

        onWindowOpen().then(openedWindow => {
            win = openedWindow;
        });

        testComponent.render({

            onRendered() {
                win.focus = () => {
                    done();
                };

                getElement('#test-component-test-focus').click();
            }
        }, 'body', CONTEXT.POPUP);
    });

    it('should close a zoid popup on click of the overlay close button', done => {
        let win;

        onWindowOpen().then(openedWindow => {
            win = openedWindow;
        });

        testComponent.render({

            onRendered() {
                onCloseWindow(win, () => {
                    done();
                }, 50);

                getElement('#test-component-test-close').click();
            }
        }, 'body', CONTEXT.POPUP);
    });


    it('should close a zoid iframe on click of the overlay close button', done => {
        let win;

        onWindowOpen().then(openedWindow => {
            win = openedWindow;
        });

        testComponent.render({

            onRendered() {
                onCloseWindow(win, () => {
                    done();
                }, 50);

                getElement('#test-component-test-close').click();
            }
        }, document.body);
    });
});
