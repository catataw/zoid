/* @flow */

import { extend } from 'belter/src';

import type { Component, ComponentDriverType } from '../component';
import { CONTEXT } from '../constants';

type VueComponent = {
    render : (Function) => Element,
    inheritAttrs : boolean,
    mounted : () => void,
    beforeUpdate : () => void
};

export let vue : ComponentDriverType<*, void> = {

    global() {
        // pass
    },

    register<P>(component : Component<P>) : VueComponent {

        return {
            render(createElement) : Element {
                return createElement('div');
            },

            inheritAttrs: false,

            mounted() {
                let el = this.$el;

                // $FlowFixMe
                this.renderPromise = component.render(extend({}, this.$attrs), el, CONTEXT.IFRAME);
            },

            beforeUpdate() {
                
                if (this.renderPromise && this.$attrs) {
                    this.renderPromise.then(parent => parent.updateProps(extend({}, this.$attrs)));
                }
            }
        };
    }
};
